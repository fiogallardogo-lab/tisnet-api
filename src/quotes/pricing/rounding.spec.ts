import { describe, expect, it } from 'vitest';
import { roundHalfAwayFromZero } from './rounding';

describe('roundHalfAwayFromZero', () => {
  it('debe redondear valores positivos correctamente', () => {
    expect(roundHalfAwayFromZero(2.0)).toBe(2);
    expect(roundHalfAwayFromZero(2.4)).toBe(2);
    expect(roundHalfAwayFromZero(2.49)).toBe(2);
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(2.6)).toBe(3);
    expect(roundHalfAwayFromZero(2.99)).toBe(3);
  });

  it('debe redondear valores negativos alejándose de cero para mitades', () => {
    expect(roundHalfAwayFromZero(-2.0)).toBe(-2);
    expect(roundHalfAwayFromZero(-2.4)).toBe(-2);
    expect(roundHalfAwayFromZero(-2.49)).toBe(-2);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(roundHalfAwayFromZero(-2.6)).toBe(-3);
    expect(roundHalfAwayFromZero(-2.99)).toBe(-3);
  });

  it('debe manejar cero y mitades elementales', () => {
    expect(roundHalfAwayFromZero(0)).toBe(0);
    expect(roundHalfAwayFromZero(-0)).toBe(0);
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(1.5)).toBe(2);
    expect(roundHalfAwayFromZero(-1.5)).toBe(-2);
  });

  it('debe comportarse consistentemente en cálculos porcentuales', () => {
    // 333 * 0.3 = 99.9 => 100
    expect(roundHalfAwayFromZero(333 * 0.3)).toBe(100);
    // 333 * (-0.1) = -33.3 => -33
    expect(roundHalfAwayFromZero(333 * -0.1)).toBe(-33);
    // 400000 * 0.3 = 120000
    expect(roundHalfAwayFromZero(400000 * 0.3)).toBe(120000);
    // 400000 * (-0.1) = -40000
    expect(roundHalfAwayFromZero(400000 * -0.1)).toBe(-40000);
  });
});
