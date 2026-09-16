import { randomBytes } from 'node:crypto';

export const QUOTE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const QUOTE_CODE_RANDOM_LENGTH = 8;

type RandomBytesProvider = (size: number) => Buffer;

export function generateQuoteCode(
  bytesProvider: RandomBytesProvider = randomBytes,
): string {
  const bytes = bytesProvider(QUOTE_CODE_RANDOM_LENGTH);

  if (bytes.length < QUOTE_CODE_RANDOM_LENGTH) {
    throw new Error('El proveedor aleatorio devolvió bytes insuficientes');
  }

  let suffix = '';
  for (let index = 0; index < QUOTE_CODE_RANDOM_LENGTH; index += 1) {
    suffix += QUOTE_CODE_ALPHABET[bytes[index] & 31];
  }

  return `Q-${suffix}`;
}
