import { randomUUID } from 'node:crypto';
import * as fsNode from 'node:fs/promises';
import * as nodePath from 'node:path';
import { Injectable, Logger } from '@nestjs/common';

import {
  SaveFileInput,
  StorageProvider,
  StorageProviderError,
  StoredFile,
  StoredFileReference,
} from './storage-provider.interface';

@Injectable()
export class DiskStorageProvider implements StorageProvider {
  private readonly logger = new Logger(DiskStorageProvider.name);
  private readonly basePath: string;
  private readonly baseUrl: string;

  constructor(options?: { basePath?: string; baseUrl?: string }) {
    this.basePath =
      options?.basePath ??
      process.env.STORAGE_DISK_PATH ??
      nodePath.join(process.cwd(), 'storage-data');
    this.baseUrl =
      options?.baseUrl ??
      process.env.STORAGE_BASE_URL ??
      ('file://' + this.basePath.replace(/\\/g, '/'));
  }

  async save(input: SaveFileInput): Promise<StoredFileReference> {
    await this.ensureDir();
    // Sanitize the key so path traversal attacks are neutralized.
    const sanitizedKey = nodePath.basename(input.key ?? randomUUID());
    const filePath = nodePath.join(this.basePath, sanitizedKey);
    try {
      await fsNode.writeFile(filePath, input.content);
    } catch (cause) {
      throw new StorageProviderError(
        'DiskStorageProvider: failed to write file "' + sanitizedKey + '": ' + String(cause),
      );
    }
    const sidecar = {
      storageKey: sanitizedKey,
      mimeType: input.mimeType,
      sizeBytes: input.content.byteLength,
      storedAt: new Date().toISOString(),
      metadata: input.metadata ?? {},
    };
    try {
      await fsNode.writeFile(
        nodePath.join(this.basePath, sanitizedKey + '.meta.json'),
        JSON.stringify(sidecar, null, 2),
      );
    } catch (cause) {
      this.logger.warn(
        'DiskStorageProvider: failed to write sidecar for "' + sanitizedKey + '": ' + String(cause),
      );
    }
    return {
      storageKey: sanitizedKey,
      url: this.baseUrl + '/' + sanitizedKey,
      sizeBytes: input.content.byteLength,
      mimeType: input.mimeType,
      storedAt: new Date(sidecar.storedAt),
    };
  }

  async get(storageKey: string): Promise<StoredFile | null> {
    const sanitizedKey = nodePath.basename(storageKey);
    const filePath = nodePath.join(this.basePath, sanitizedKey);
    let content: Buffer;
    try {
      content = await fsNode.readFile(filePath);
    } catch (cause: unknown) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new StorageProviderError(
        'DiskStorageProvider: failed to read file "' + sanitizedKey + '": ' + String(cause),
      );
    }
    const sidecar = await this.readSidecar(sanitizedKey);
    return {
      storageKey: sanitizedKey,
      url: this.baseUrl + '/' + sanitizedKey,
      sizeBytes: content.byteLength,
      mimeType: sidecar?.mimeType ?? 'application/octet-stream',
      storedAt: sidecar ? new Date(sidecar.storedAt) : new Date(0),
      content,
      metadata: sidecar?.metadata,
    };
  }

  async exists(storageKey: string): Promise<boolean> {
    const sanitizedKey = nodePath.basename(storageKey);
    try {
      await fsNode.access(nodePath.join(this.basePath, sanitizedKey));
      return true;
    } catch {
      return false;
    }
  }

  async delete(storageKey: string): Promise<boolean> {
    const sanitizedKey = nodePath.basename(storageKey);
    const filePath = nodePath.join(this.basePath, sanitizedKey);
    try {
      await fsNode.unlink(filePath);
    } catch (cause: unknown) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw new StorageProviderError(
        'DiskStorageProvider: failed to delete file "' + sanitizedKey + '": ' + String(cause),
      );
    }
    try {
      await fsNode.unlink(nodePath.join(this.basePath, sanitizedKey + '.meta.json'));
    } catch { /* ignore missing sidecar */ }
    return true;
  }

  private async ensureDir(): Promise<void> {
    try {
      await fsNode.mkdir(this.basePath, { recursive: true });
    } catch (cause) {
      throw new StorageProviderError(
        'DiskStorageProvider: cannot create storage directory "' + this.basePath + '": ' + String(cause),
      );
    }
  }

  private async readSidecar(sanitizedKey: string): Promise<{
    mimeType: string;
    sizeBytes: number;
    storedAt: string;
    metadata?: Record<string, string>;
  } | null> {
    try {
      const raw = await fsNode.readFile(
        nodePath.join(this.basePath, sanitizedKey + '.meta.json'),
        'utf8',
      );
      return JSON.parse(raw) as {
        mimeType: string;
        sizeBytes: number;
        storedAt: string;
        metadata?: Record<string, string>;
      };
    } catch {
      return null;
    }
  }
}