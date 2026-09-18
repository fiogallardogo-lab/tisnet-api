import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryStorageProvider } from './in-memory-storage.provider';
import { StorageProviderError } from './storage-provider.interface';

describe('InMemoryStorageProvider', () => {
    let provider: InMemoryStorageProvider;

    beforeEach(() => {
        provider = new InMemoryStorageProvider();
    });

    it('guarda y recupera un archivo', async () => {
        const content = Buffer.from('archivo de prueba');

        const reference = await provider.save({
            key: 'quote-test.pdf',
            content,
            mimeType: 'application/pdf',
            metadata: {
                quoteCode: 'Q-TEST1234',
            },
        });

        expect(reference.storageKey).toBe('quote-test.pdf');
        expect(reference.url).toBe('memory://quote-test.pdf');
        expect(reference.sizeBytes).toBe(content.byteLength);
        expect(reference.mimeType).toBe('application/pdf');

        const stored = await provider.get('quote-test.pdf');

        expect(stored).not.toBeNull();
        expect(stored?.content.equals(content)).toBe(true);
        expect(stored?.metadata).toEqual({
            quoteCode: 'Q-TEST1234',
        });
    });

    it('genera una clave cuando no se proporciona una', async () => {
        const reference = await provider.save({
            content: Buffer.from('contenido'),
            mimeType: 'application/pdf',
        });

        expect(reference.storageKey).toBeTruthy();
        expect(reference.url).toBe(`memory://${reference.storageKey}`);
    });

    it('comprueba la existencia de un archivo', async () => {
        expect(await provider.exists('missing.pdf')).toBe(false);

        await provider.save({
            key: 'existing.pdf',
            content: Buffer.from('contenido'),
            mimeType: 'application/pdf',
        });

        expect(await provider.exists('existing.pdf')).toBe(true);
    });

    it('elimina un archivo existente', async () => {
        await provider.save({
            key: 'delete-me.pdf',
            content: Buffer.from('contenido'),
            mimeType: 'application/pdf',
        });

        expect(provider.count()).toBe(1);

        const deleted = await provider.delete('delete-me.pdf');

        expect(deleted).toBe(true);
        expect(provider.count()).toBe(0);
        expect(await provider.get('delete-me.pdf')).toBeNull();
    });

    it('devuelve false al eliminar un archivo inexistente', async () => {
        expect(await provider.delete('unknown.pdf')).toBe(false);
    });

    it('permite consultar las claves almacenadas', async () => {
        await provider.save({
            key: 'first.pdf',
            content: Buffer.from('1'),
            mimeType: 'application/pdf',
        });

        await provider.save({
            key: 'second.pdf',
            content: Buffer.from('2'),
            mimeType: 'application/pdf',
        });

        expect(provider.getAllKeys()).toEqual(['first.pdf', 'second.pdf']);
        expect(provider.count()).toBe(2);
    });

    it('limpia el almacenamiento y reinicia el estado de fallo', async () => {
        await provider.save({
            key: 'test.pdf',
            content: Buffer.from('contenido'),
            mimeType: 'application/pdf',
        });

        provider.simulateFailure(true);

        provider.clear();

        expect(provider.count()).toBe(0);

        await expect(provider.exists('test.pdf')).resolves.toBe(false);
    });

    it('permite simular un fallo del proveedor', async () => {
        provider.simulateFailure(
            true,
            new StorageProviderError('storage unavailable'),
        );

        await expect(
            provider.save({
                content: Buffer.from('contenido'),
                mimeType: 'application/pdf',
            }),
        ).rejects.toThrow('storage unavailable');
    });

    it('no comparte la misma referencia de Buffer al recuperar archivos', async () => {
        const original = Buffer.from('contenido original');

        await provider.save({
            key: 'safe.pdf',
            content: original,
            mimeType: 'application/pdf',
        });

        const stored = await provider.get('safe.pdf');

        expect(stored).not.toBeNull();

        if (!stored) {
            throw new Error('Expected stored file');
        }

        stored.content[0] = 0;

        const recoveredAgain = await provider.get('safe.pdf');

        expect(recoveredAgain?.content.equals(original)).toBe(true);
    });
});