import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Optional,
  Param,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage-provider.interface';
import { ProspectsService } from './prospects.service';

@ApiTags('Public Advisors')
@Controller('public/advisors')
export class PublicAdvisorsController {
  constructor(
    private readonly prospectsService: ProspectsService,
    private readonly prisma: PrismaService,
    @Optional() @Inject(STORAGE_PROVIDER) private readonly storage?: StorageProvider,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar asesores públicos activos' })
  findAll() {
    return this.prospectsService.findPublicAdvisors();
  }

  @Get(':id/photo')
  @ApiOperation({ summary: 'Servir la fotografía pública del asesor' })
  async photo(@Param('id', ParseIntPipe) id: number, @Res() response: Response) {
    if (!this.storage) throw new NotFoundException('Fotografía no disponible');
    const profile = await this.prisma.adminProfile.findFirst({
      where: {
        id,
        isPublicAdvisor: true,
        user: { isActive: true },
        executiveTitle: { not: null },
        specialty: { not: null },
      },
      select: { photoUrl: true },
    });
    if (!profile?.photoUrl) throw new NotFoundException('Fotografía no disponible');
    let key: string;
    try {
      key = decodeURIComponent(new URL(profile.photoUrl).pathname.split('/').filter(Boolean).at(-1) ?? '');
    } catch {
      throw new NotFoundException('Fotografía no disponible');
    }
    if (!new RegExp(`^profile-${id}-[0-9a-f-]+\\.(?:png|jpe?g|webp)$`, 'i').test(key)) {
      throw new NotFoundException('Fotografía no disponible');
    }
    const file = await this.storage.get(key);
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType)) {
      throw new NotFoundException('Fotografía no disponible');
    }
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return response.send(file.content);
  }
}
