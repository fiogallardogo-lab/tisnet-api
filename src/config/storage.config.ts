import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  driver: 'memory' | 'disk';
  diskPath?: string;
  baseUrl?: string;
}

export function validateStorageConfig(
  env: Record<string, string | undefined>,
): StorageConfig {
  const driver = (env.STORAGE_DRIVER ?? 'memory').trim();

  if (driver !== 'memory' && driver !== 'disk') {
    throw new Error(
      '[Storage] Unknown STORAGE_DRIVER="' + driver + '". Valid values: memory | disk',
    );
  }

  return {
    driver: driver as 'memory' | 'disk',
    diskPath: env.STORAGE_DISK_PATH,
    baseUrl: env.STORAGE_BASE_URL,
  };
}

export const storageConfig = registerAs('storage', () =>
  validateStorageConfig(process.env),
);