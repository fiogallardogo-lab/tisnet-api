import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { auditRecord } from '../audit/audit.service';
import { PublicTeamDto } from './operations.dto';
const allowedRoles = ['DEVELOPER', 'PRODUCT_OWNER', 'ADMIN'];
@Injectable()
export class PublicTeamService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}
  publicPhoto(url?: string | null) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const hosts = (this.config.get<string>('PUBLIC_TEAM_MEDIA_HOSTS') || '')
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
      if (
        parsed.protocol !== 'https:' ||
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash ||
        !hosts.includes(parsed.hostname.toLowerCase()) ||
        /cv|curriculum|team-applications|private|token/i.test(
          decodeURIComponent(parsed.pathname),
        )
      )
        throw new Error();
      return parsed.href;
    } catch {
      throw new BadRequestException(
        'La foto pública debe usar un dominio de medios aprobado, HTTPS y sin tokens ni parámetros.',
      );
    }
  }
  async publish(userId: number, actorId: number, dto: PublicTeamDto) {
    const photoUrl = this.publicPhoto(dto.photoUrl);
    if (dto.approved && !dto.consentRecorded)
      throw new BadRequestException(
        'Registra el consentimiento para publicar este perfil.',
      );
    return this.db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT id FROM User WHERE id = ? FOR UPDATE',
        userId,
      );
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });
      if (!user) throw new NotFoundException('Usuario no encontrado.');
      if (
        !allowedRoles.includes(user.role.name) ||
        (dto.approved && !user.isActive)
      )
        throw new ConflictException(
          'Solo Developers, PO y asesores activos pueden publicarse.',
        );
      const data = {
        displayName: dto.displayName,
        biography: dto.biography,
        specialty: dto.specialty,
        photoUrl,
        approved: dto.approved,
        consentRecorded: dto.consentRecorded,
        approvedById: actorId,
        approvedAt: dto.approved ? new Date() : null,
      };
      const result = await tx.publicTeamProfile.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
      await auditRecord(tx, {
        actorId,
        action: dto.approved ? 'PUBLIC_TEAM_APPROVED' : 'PUBLIC_TEAM_WITHDRAWN',
        entityType: 'USER',
        entityId: String(userId),
      });
      return {
        id: result.id,
        approved: result.approved,
        updatedAt: result.updatedAt,
      };
    });
  }
  async list(page: number, limit: number) {
    const rows = await this.db.publicTeamProfile.findMany({
      where: {
        approved: true,
        consentRecorded: true,
        user: { isActive: true, role: { name: { in: allowedRoles } } },
      },
      select: {
        id: true,
        displayName: true,
        biography: true,
        specialty: true,
        photoUrl: true,
        user: {
          select: {
            role: { select: { name: true } },
            adminProfile: { select: { id: true, isPublicAdvisor: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
      skip: (page - 1) * limit,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map(({ user, ...row }) => {
        let photoUrl: string | null = null;
        try {
          photoUrl = this.publicPhoto(row.photoUrl);
        } catch {
          /* withdrawn host is not published */
        }
        return {
          ...row,
          photoUrl,
          role: user.role.name,
          advisorId: user.adminProfile?.isPublicAdvisor
            ? user.adminProfile.id
            : null,
          cta: { label: 'Agendar asesoría', path: '/quote' },
        };
      }),
      page,
      hasMore: rows.length > limit,
    };
  }
}
