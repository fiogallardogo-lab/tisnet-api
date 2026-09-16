import { describe, expect, it } from 'vitest';
import {
  generateQuoteCode,
  QUOTE_CODE_RANDOM_LENGTH,
} from './quote-code.generator';

describe('generateQuoteCode', () => {
  it('debe generar el formato público acordado', () => {
    const code = generateQuoteCode(() => Buffer.alloc(8, 0));

    expect(code).toBe('Q-AAAAAAAA');
    expect(code).toMatch(/^Q-[A-HJ-NP-Z2-9]{8}$/);
  });

  it('debe solicitar ocho bytes aleatorios y mapear todo el alfabeto', () => {
    const code = generateQuoteCode((size) => {
      expect(size).toBe(QUOTE_CODE_RANDOM_LENGTH);
      return Buffer.from([0, 1, 2, 3, 28, 29, 30, 31]);
    });

    expect(code).toBe('Q-ABCD6789');
  });

  it('debe fallar si el proveedor devuelve bytes insuficientes', () => {
    expect(() => generateQuoteCode(() => Buffer.alloc(7))).toThrow(
      'El proveedor aleatorio devolvió bytes insuficientes',
    );
  });
});
