import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { validateLegalVersions } from '../common/legal/legal-versions';
import { auditRecord } from '../audit/audit.service';
import { CommercialMailService } from './commercial-mail.service';
import { escapeHtml } from '../notifications/templates/escape-html';
import { ActivationDto, InviteClientDto } from './commercial.dto';
@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: CommercialMailService,
  ) {}
  private options() {
    return {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      audience: 'tisnet-activation',
      issuer: 'tisnet-api',
      algorithm: 'HS256' as const,
    };
  }
  async invite(dto: InviteClientDto, actorId: number) {
    if (!this.mail.isRealDeliveryConfigured()) {
      throw new ServiceUnavailableException(
        'El correo real no está configurado. Configure SMTP o Resend antes de crear la cuenta.',
      );
    }
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    let user;
    try {
      user = await this.db.$transaction(async (tx) => {
        let activationRequest: {
          id: number;
          prospectId: number;
          status: string;
          prospect: { email: string; userId: number | null };
        } | null = null;
        if (dto.activationRequestId !== undefined) {
          activationRequest = await tx.clientActivationRequest.findUnique({
            where: { id: dto.activationRequestId },
            select: {
              id: true,
              prospectId: true,
              status: true,
              prospect: { select: { email: true, userId: true } },
            },
          });
          if (!activationRequest) {
            throw new BadRequestException(
              'Solicitud de activación no encontrada.',
            );
          }
          if (activationRequest.status !== 'PENDING') {
            throw new ConflictException(
              'La solicitud de activación ya fue atendida.',
            );
          }
          if (
            activationRequest.prospect.email.toLowerCase() !==
            dto.email.toLowerCase()
          ) {
            throw new BadRequestException(
              'El correo debe coincidir con el registrado en la solicitud del visitante.',
            );
          }
          if (activationRequest.prospect.userId !== null) {
            throw new ConflictException(
              'El visitante ya tiene una cuenta vinculada.',
            );
          }
        }

        const role = await tx.role.findUnique({ where: { name: 'CLIENT' } });
        if (!role) {
          throw new ServiceUnavailableException(
            'El rol CLIENT no está configurado.',
          );
        }
        const created = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash,
            roleId: role.id,
            isActive: false,
            clientProfile: { create: {} },
          },
        });
        await auditRecord(tx, {
          actorId,
          action: 'CLIENT_INVITED',
          entityType: 'USER',
          entityId: String(created.id),
        });

        if (activationRequest) {
          const claimed = await tx.clientActivationRequest.updateMany({
            where: { id: activationRequest.id, status: 'PENDING' },
            data: {
              status: 'APPROVED',
              reviewerId: actorId,
              clientUserId: created.id,
              reviewedAt: new Date(),
            },
          });
          if (claimed.count !== 1) {
            throw new ConflictException(
              'La solicitud fue atendida por otra persona.',
            );
          }
          await tx.prospect.update({
            where: { id: activationRequest.prospectId },
            data: { userId: created.id, status: 'CONVERTED' },
          });
          await auditRecord(tx, {
            actorId,
            action: 'CLIENT_ACTIVATION_REQUEST_APPROVED',
            entityType: 'CLIENT_ACTIVATION_REQUEST',
            entityId: String(activationRequest.id),
          });
        }
        return created;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('El correo ya está registrado.');
      }
      throw e;
    }
    const delivery = await this.sendToken(user);
    return {
      id: user.id,
      email: user.email,
      isActive: false,
      ...(dto.activationRequestId !== undefined
        ? { activationRequestId: dto.activationRequestId }
        : {}),
      ...delivery,
    };
  }
  private async sendToken(user: {
    id: number;
    email: string;
    tokenVersion: number;
  }) {
    const token = this.jwt.sign(
      { sub: user.id, tokenVersion: user.tokenVersion, purpose: 'activate' },
      { ...this.options(), expiresIn: '24h' },
    );
    const url =
      this.mail.links().activate + '?token=' + encodeURIComponent(token);
    return this.mail.send(
      {
        recipient: user.email,
        subject: 'Activa tu cuenta TISNET',
        text:
          'Tu usuario para TISNET es ' +
          user.email +
          '. Define tu contraseña desde este enlace en las próximas 24 horas: ' +
          url,
        html:
          '<p>Tu usuario para TISNET es <strong>' +
          escapeHtml(user.email) +
          '</strong>.</p><p>Usa el enlace para definir tu contraseña y activar la cuenta. El enlace vence en 24 horas.</p><p><a href="' +
          escapeHtml(url) +
          '">Activar cuenta</a></p>',
      },
      'USER',
      user.id,
    );
  }
  async request(email: string) {
    const user = await this.db.user.findFirst({
      where: {
        email,
        isActive: false,
        acceptedTermsAt: null,
        role: { name: 'CLIENT' },
      },
    });
    if (user) {
      try {
        await this.sendToken(user);
      } catch {
        this.logger.error('No se pudo enviar el correo de activación.');
      }
    }
    return {
      requested: true,
      message:
        'Si tu cuenta está pendiente de activación, recibirás las instrucciones.',
    };
  }
  async activate(dto: ActivationDto) {
    if (dto.acceptedTerms !== true)
      throw new BadRequestException('Debes aceptar los documentos legales.');
    const versions = validateLegalVersions(this.config, dto);
    if (Buffer.byteLength(dto.password, 'utf8') > 72)
      throw new BadRequestException('Contraseña demasiado larga.');
    let payload: { sub: number; tokenVersion: number; purpose: string };
    try {
      payload = this.jwt.verify(dto.token, {
        ...this.options(),
        algorithms: ['HS256'],
      });
    } catch {
      throw new BadRequestException('Token inválido o vencido.');
    }
    if (
      payload.purpose !== 'activate' ||
      !Number.isSafeInteger(payload.sub) ||
      !Number.isSafeInteger(payload.tokenVersion)
    )
      throw new BadRequestException('Token inválido.');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: {
          id: payload.sub,
          tokenVersion: payload.tokenVersion,
          isActive: false,
          acceptedTermsAt: null,
          role: { name: 'CLIENT' },
        },
        data: {
          passwordHash,
          isActive: true,
          acceptedTermsAt: new Date(),
          ...versions,
          tokenVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          'Token utilizado o cuenta no habilitada para activación.',
        );
      await auditRecord(tx, {
        actorId: payload.sub,
        action: 'ACCOUNT_ACTIVATED',
        entityType: 'USER',
        entityId: String(payload.sub),
      });
      return { activated: true };
    });
  }
}
