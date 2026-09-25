export interface PeruvianHoliday {
  name: string;
  month: number; // 1-12
  day: number; // 1-31
}

/**
 * Feriados nacionales oficiales del Perú (D. Leg. 713 y leyes complementarias).
 * Feriados de fecha fija anual.
 */
export const PERUVIAN_FIXED_HOLIDAYS: readonly PeruvianHoliday[] = [
  { name: 'Año Nuevo', month: 1, day: 1 },
  { name: 'Día del Trabajo', month: 5, day: 1 },
  { name: 'Batalla de Arica y Día de la Bandera', month: 6, day: 7 },
  { name: 'San Pedro y San Pablo', month: 6, day: 29 },
  { name: 'Día de la Fuerza Aérea del Perú', month: 7, day: 23 },
  { name: 'Fiestas Patrias (Independencia)', month: 7, day: 28 },
  { name: 'Fiestas Patrias (Fuerzas Armadas)', month: 7, day: 29 },
  { name: 'Batalla de Junín', month: 8, day: 6 },
  { name: 'Santa Rosa de Lima', month: 8, day: 30 },
  { name: 'Combate de Angamos', month: 10, day: 8 },
  { name: 'Día de Todos los Santos', month: 11, day: 1 },
  { name: 'Inmaculada Concepción', month: 12, day: 8 },
  { name: 'Batalla de Ayacucho', month: 12, day: 9 },
  { name: 'Navidad', month: 12, day: 25 },
];

/**
 * Algoritmo Computus gregoriano (Meeus/Jones/Butcher)
 * Calcula el Domingo de Resurrección para cualquier año del calendario gregoriano.
 */
export function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Retorna todos los feriados de un año determinado (fijos + Semana Santa móvil).
 */
export function getPeruvianHolidaysForYear(year: number): Array<{
  name: string;
  dateKey: string; // YYYY-MM-DD
}> {
  const result: Array<{ name: string; dateKey: string }> = [];

  // 1. Feriados fijos
  for (const h of PERUVIAN_FIXED_HOLIDAYS) {
    const mm = String(h.month).padStart(2, '0');
    const dd = String(h.day).padStart(2, '0');
    result.push({
      name: h.name,
      dateKey: `${year}-${mm}-${dd}`,
    });
  }

  // 2. Feriados móviles: Jueves Santo (-3 días) y Viernes Santo (-2 días)
  const easter = getEasterSunday(year);

  const juevesSanto = new Date(easter.getTime() - 3 * 24 * 60 * 60 * 1000);
  const viernesSanto = new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);

  const formatKey = (d: Date) => {
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  result.push({
    name: 'Jueves Santo',
    dateKey: formatKey(juevesSanto),
  });

  result.push({
    name: 'Viernes Santo',
    dateKey: formatKey(viernesSanto),
  });

  return result.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}
