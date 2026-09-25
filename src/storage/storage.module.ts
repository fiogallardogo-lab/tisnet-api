import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { storageConfig, validateStorageConfig } from '../config/storage.config';
import type { StorageConfig } from '../config/storage.config';

import { InMemoryStorageProvider } from './in-memory-storage.provider';
import { DiskStorageProvider } from './disk-storage.provider';
import { STORAGE_PROVIDER } from './storage-provider.interface';

@Module({
  imports: [ConfigModule.forFeature(storageConfig)],
  providers: [
    InMemoryStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, InMemoryStorageProvider],
      useFactory: (
        configService: ConfigService,
        memory: InMemoryStorageProvider,
      ) => {
        // Safely read config — fall back to memory if ConfigModule is not loaded
        // (e.g. in unit tests that don't bootstrap the full module graph).
        let config: StorageConfig;
        try {
          config = configService.get<StorageConfig>('storage') ??
            validateStorageConfig(process.env);
        } catch {
          config = { driver: 'memory' };
        }
        if (config.driver === 'disk') {
          return new DiskStorageProvider({
            basePath: config.diskPath,
            baseUrl: config.baseUrl,
          });
        }
        return memory;
      },
    },
  ],
  exports: [STORAGE_PROVIDER, InMemoryStorageProvider],
})
export class StorageModule {}