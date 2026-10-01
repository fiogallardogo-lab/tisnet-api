import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage-provider.interface';
import { WorkService, WorkActor } from './work.service';
export interface WorkUpload {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}
@Injectable()
export class PrivateFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly work: WorkService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}
  async upload(
    actor: WorkActor,
    file: WorkUpload | undefined,
    projectId?: number,
  ) {
    if (projectId !== undefined) {
      if (
        !['DEVELOPER', 'PRODUCT_OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(
          actor.role,
        )
      )
        throw new ForbiddenException();
      await this.work.access(projectId, actor, true);
    } else if (actor.role !== 'DEVELOPER') throw new ForbiddenException();
    if (
      !file ||
      file.mimetype !== 'application/pdf' ||
      file.buffer.subarray(0, 5).toString() !== '%PDF-' ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024
    )
      throw new BadRequestException('Se requiere PDF válido de hasta 5 MiB');
    const id = randomUUID(),
      key = randomUUID() + '.pdf';
    const filename =
      file.originalname.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180) ||
      'document.pdf';
    await this.storage.save({
      key,
      content: file.buffer,
      mimeType: 'application/pdf',
    });
    const url =
      projectId !== undefined
        ? `/api/v1/projects/${projectId}/files/${id}/download`
        : `/api/v1/users/me/cv/${id}`;
    try {
      await this.prisma.$transaction(async (db) => {
        await db.privateFile.create({
          data: {
            id,
            ownerId: actor.id,
            projectId,
            kind: projectId !== undefined ? 'PROJECT' : 'CV',
            storageKey: key,
            filename,
            mimeType: 'application/pdf',
            sizeBytes: file.size,
          },
        });
        if (projectId === undefined)
          await db.developerProfile.upsert({
            where: { userId: actor.id },
            create: { userId: actor.id, cvUrl: url },
            update: { cvUrl: url },
          });
        await db.auditEvent.create({
          data: {
            actorId: actor.id,
            action: 'PRIVATE_FILE_UPLOADED',
            entityType: 'PRIVATE_FILE',
            entityId: id,
            metadata: {
              kind: projectId !== undefined ? 'PROJECT' : 'CV',
              projectId: projectId ?? null,
            },
          },
        });
      });
    } catch (e) {
      await this.storage.delete(key).catch(() => undefined);
      throw e;
    }
    return {
      id,
      url,
      ...(projectId === undefined ? { cvUrl: url } : {}),
      filename,
      mimeType: 'application/pdf',
      sizeBytes: file.size,
    };
  }
  async download(actor: WorkActor, id: string, projectId?: number) {
    if (projectId !== undefined) await this.work.access(projectId, actor);
    const record = await this.prisma.privateFile.findFirst({
      where: {
        id,
        ...(projectId !== undefined
          ? { projectId, kind: 'PROJECT' }
          : { ownerId: actor.id, kind: 'CV' }),
      },
    });
    if (!record) throw new NotFoundException('Archivo no encontrado');
    const file = await this.storage.get(record.storageKey);
    if (!file) throw new NotFoundException('Contenido no disponible');
    return new StreamableFile(file.content, {
      type: record.mimeType,
      disposition: `attachment; filename="${record.filename}"`,
      length: file.content.length,
    });
  }
}
