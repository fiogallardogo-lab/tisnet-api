import * as path from 'node:path';
import * as fsNode from 'node:fs/promises';
import * as os from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DiskStorageProvider } from './disk-storage.provider';
import { StorageProviderError } from './storage-provider.interface';

describe('DiskStorageProvider', () => {
  let tmpDir: string;
  let provider: DiskStorageProvider;

  beforeEach(async () => {
    tmpDir = await fsNode.mkdtemp(path.join(os.tmpdir(), 'tisnet-storage-test-'));
    provider = new DiskStorageProvider({ basePath: tmpDir, baseUrl: 'http://storage.local' });
  });

  afterEach(async () => {
    await fsNode.rm(tmpDir, { recursive: true, force: true });
  });

  describe('save()', () => {
    it('persists content to disk and returns a reference', async () => {
      const content = Buffer.from('hello world');
      const ref = await provider.save({ key: 'test-file.txt', content, mimeType: 'text/plain' });
      expect(ref.storageKey).toBe('test-file.txt');
      expect(ref.mimeType).toBe('text/plain');
      expect(ref.sizeBytes).toBe(content.byteLength);
      expect(ref.url).toBe('http://storage.local/test-file.txt');
      expect(ref.storedAt).toBeInstanceOf(Date);
    });

    it('generates a random storageKey when key is not provided', async () => {
      const ref = await provider.save({ content: Buffer.from('no key'), mimeType: 'text/plain' });
      expect(ref.storageKey).toBeTruthy();
      expect(ref.storageKey.length).toBeGreaterThan(8);
    });

    it('writes a sidecar metadata file', async () => {
      await provider.save({
        key: 'doc.pdf',
        content: Buffer.from('%PDF'),
        mimeType: 'application/pdf',
        metadata: { quoteCode: 'Q-00000001' },
      });
      const sidecarRaw = await fsNode.readFile(path.join(tmpDir, 'doc.pdf.meta.json'), 'utf8');
      const sidecar = JSON.parse(sidecarRaw) as { mimeType: string; metadata: Record<string, string> };
      expect(sidecar.mimeType).toBe('application/pdf');
      expect(sidecar.metadata.quoteCode).toBe('Q-00000001');
    });
  });

  describe('get()', () => {
    it('returns the stored file with original content', async () => {
      const content = Buffer.from('file content');
      await provider.save({ key: 'myfile.bin', content, mimeType: 'application/octet-stream' });
      const file = await provider.get('myfile.bin');
      expect(file).not.toBeNull();
      expect(file!.content.toString()).toBe('file content');
      expect(file!.mimeType).toBe('application/octet-stream');
    });

    it('returns null when file does not exist', async () => {
      const result = await provider.get('nonexistent.txt');
      expect(result).toBeNull();
    });
  });

  describe('exists()', () => {
    it('returns true after saving a file', async () => {
      await provider.save({ key: 'present.txt', content: Buffer.from('x'), mimeType: 'text/plain' });
      expect(await provider.exists('present.txt')).toBe(true);
    });

    it('returns false for a missing file', async () => {
      expect(await provider.exists('missing.txt')).toBe(false);
    });
  });

  describe('delete()', () => {
    it('removes the file and returns true', async () => {
      await provider.save({ key: 'todelete.txt', content: Buffer.from('bye'), mimeType: 'text/plain' });
      expect(await provider.delete('todelete.txt')).toBe(true);
      expect(await provider.exists('todelete.txt')).toBe(false);
    });

    it('returns false when file does not exist', async () => {
      expect(await provider.delete('ghost.txt')).toBe(false);
    });

    it('also removes the sidecar file', async () => {
      await provider.save({ key: 'withsidecar.txt', content: Buffer.from('a'), mimeType: 'text/plain' });
      await provider.delete('withsidecar.txt');
      await expect(fsNode.access(path.join(tmpDir, 'withsidecar.txt.meta.json'))).rejects.toThrow();
    });
  });

  describe('path safety', () => {
    it('sanitizes path traversal in storageKey (uses basename only)', async () => {
      const ref = await provider.save({ key: '../etc/passwd', content: Buffer.from('safe'), mimeType: 'text/plain' });
      const file = await provider.get('../etc/passwd');
      expect(file?.content.toString()).toBe('safe');
      expect(ref.url).not.toContain('/etc/');
    });
  });

  describe('StorageProviderError', () => {
    it('is a subclass of Error with the correct name', () => {
      const err = new StorageProviderError('test');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('StorageProviderError');
    });
  });
});