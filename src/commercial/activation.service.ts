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
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    let user;
    try {
      user = await this.db.$transaction(async (tx) => {
        const role = await tx.role.findUnique({ where: { name: 'CLIENT' } });
        if (!role)
          throw new ServiceUnavailableException(
            'El rol CLIENT no está configurado.',
          );
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
        return created;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException('El correo ya está registrado.');
      throw e;
    }
    const delivery = await this.sendToken(user);
    return { id: user.id, email: user.email, isActive: false, ...delivery };
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
        text: 'Activa tu cuenta en las próximas 24 horas: ' + url,
        html:
          '<p>Activa tu cuenta y revisa los documentos legales vigentes.</p><p><a href="' +
          url +
          '">Activar cuenta</a></p><p>Enlace de un solo uso. Expira en 24 horas.</p>',
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
