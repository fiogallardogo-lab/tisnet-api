import { Module } from '@nestjs/common';

import { InMemoryStorageProvider } from './in-memory-storage.provider';
import { STORAGE_PROVIDER } from './storage-provider.interface';

@Module({
    providers: [
        {
            provide: STORAGE_PROVIDER,
            useClass: InMemoryStorageProvider,
        },
    ],
    exports: [STORAGE_PROVIDER],
})
export class StorageModule { }