import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
    SaveFileInput,
    StorageProvider,
    StorageProviderError,
    StoredFile,
    StoredFileReference,
} from './storage-provider.interface';

@Injectable()
export class InMemoryStorageProvider implements StorageProvider {
    private readonly files = new Map<string, StoredFile>();

    private shouldFail = false;
    private failureError: Error | null = null;

    async save(input: SaveFileInput): Promise<StoredFileReference> {
        this.throwIfFailure();

        const storageKey = input.key ?? randomUUID();

        const storedFile: StoredFile = {
            storageKey,
            url: `memory://${storageKey}`,
            sizeBytes: input.content.byteLength,
            mimeType: input.mimeType,
            storedAt: new Date(),
            content: Buffer.from(input.content),
            metadata: input.metadata ? { ...input.metadata } : undefined,
        };

        this.files.set(storageKey, storedFile);

        return this.toReference(storedFile);
    }

    async get(storageKey: string): Promise<StoredFile | null> {
        this.throwIfFailure();

        const file = this.files.get(storageKey);

        if (!file) {
            return null;
        }

        return {
            ...file,
            content: Buffer.from(file.content),
            metadata: file.metadata ? { ...file.metadata } : undefined,
        };
    }

    async exists(storageKey: string): Promise<boolean> {
        this.throwIfFailure();

        return this.files.has(storageKey);
    }

    async delete(storageKey: string): Promise<boolean> {
        this.throwIfFailure();

        return this.files.delete(storageKey);
    }

    simulateFailure(shouldFail: boolean, error?: Error): void {
        this.shouldFail = shouldFail;
        this.failureError = shouldFail
            ? (error ?? new StorageProviderError('Simulated storage provider failure'))
            : null;
    }

    clear(): void {
        this.files.clear();
        this.shouldFail = false;
        this.failureError = null;
    }

    getAllKeys(): string[] {
        return [...this.files.keys()];
    }

    count(): number {
        return this.files.size;
    }

    private throwIfFailure(): void {
        if (!this.shouldFail) {
            return;
        }

        throw (
            this.failureError ??
            new StorageProviderError('Simulated storage provider failure')
        );
    }

    private toReference(file: StoredFile): StoredFileReference {
        return {
            storageKey: file.storageKey,
            url: file.url,
            sizeBytes: file.sizeBytes,
            mimeType: file.mimeType,
            storedAt: file.storedAt,
        };
    }
}