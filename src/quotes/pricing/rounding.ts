/**
 * Redondeo aritmético estándar (Round half away from zero).
 * Para valores positivos, mitades (.5) redondean hacia +infinito.
 * Para valores negativos, mitades (.5) redondean hacia -infinito.
 * Siempre normaliza -0 a 0.
 *
 * Ejemplos:
 *  2.5  =>  3
 *  2.4  =>  2
 * -2.5  => -3
 * -2.4  => -2
 *  0.0  =>  0
 */
export function roundHalfAwayFromZero(value: number): number {
  if (value === 0) return 0;
  const result = value < 0 ? -Math.round(-value) : Math.round(value);
  return result === 0 ? 0 : result;
}
