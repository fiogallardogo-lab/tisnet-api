import { describe, expect, it } from 'vitest';
import { validateStorageConfig } from '../config/storage.config';

describe('Storage configuration', () => {
  it('defaults to memory when STORAGE_DRIVER is absent', () => {
    expect(validateStorageConfig({})).toMatchObject({ driver: 'memory' });
  });

  it('accepts STORAGE_DRIVER=memory explicitly', () => {
    expect(validateStorageConfig({ STORAGE_DRIVER: 'memory' })).toMatchObject({ driver: 'memory' });
  });

  it('accepts STORAGE_DRIVER=disk', () => {
    expect(
      validateStorageConfig({ STORAGE_DRIVER: 'disk', STORAGE_DISK_PATH: '/data/storage' }),
    ).toMatchObject({ driver: 'disk', diskPath: '/data/storage' });
  });

  it('includes baseUrl when provided', () => {
    const config = validateStorageConfig({
      STORAGE_DRIVER: 'disk',
      STORAGE_BASE_URL: 'https://cdn.tisnet.pe/files',
    });
    expect(config.baseUrl).toBe('https://cdn.tisnet.pe/files');
  });

  it.each(['s3', 'gcs', 'cloudinary', 'DISK', 'MEMORY'])(
    'throws on unknown driver "%s"',
    (driver) => {
      expect(() => validateStorageConfig({ STORAGE_DRIVER: driver })).toThrow(
        'Unknown STORAGE_DRIVER',
      );
    },
  );
});