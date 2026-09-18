export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface SaveFileInput {
  /** Optional unique key for the file. If not provided, a random UUID should be generated. */
  key?: string;
  content: Buffer;
  mimeType: string;
  metadata?: Record<string, string>;
}

export interface StoredFileReference {
  storageKey: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  storedAt: Date;
}

export interface StoredFile extends StoredFileReference {
  content: Buffer;
  metadata?: Record<string, string>;
}

export interface StorageProvider {
  /** Saves a file and returns its storage reference. */
  save(input: SaveFileInput): Promise<StoredFileReference>;
  
  /** Retrieves a file by its storage key. Returns null if not found. */
  get(storageKey: string): Promise<StoredFile | null>;
  
  /** Checks if a file exists. */
  exists(storageKey: string): Promise<boolean>;
  
  /** Deletes a file. Returns true if deleted, false if not found. */
  delete(storageKey: string): Promise<boolean>;
}

export class StorageProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageProviderError';
  }
}
