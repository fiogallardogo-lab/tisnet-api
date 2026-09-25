import { Injectable, Logger } from '@nestjs/common';
import { getPeruvianHolidaysForYear } from './peruvian-holidays';

export interface SlaCalculationResult {
  startDate: Date;
  deadline: Date;
  totalBusinessDays: number;
  remainingBusinessDays: number;
  isExpired: boolean;
}

@Injectable()
export class BusinessDaysService {
  private readonly logger = new Logger(BusinessDaysService.name);
  private readonly holidayCache = new Map<number, Set<string>>();

  /**
   * Obtiene el Set de claves "YYYY-MM-DD" de feriados para un año dado con caché.
   */
  private getHolidayKeysForYear(year: number): Set<string> {
    let keys = this.holidayCache.get(year);
    if (!keys) {
      const holidays = getPeruvianHolidaysForYear(year);
      keys = new Set(holidays.map((h) => h.dateKey));
      this.holidayCache.set(year, keys);
    }
    return keys;
  }

  /**
   * Formatea una fecha local en 'YYYY-MM-DD'
   */
  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Determina si una fecha cae en sábado o domingo.
   */
  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 = Domingo, 6 = Sábado
  }

  /**
   * Determina si una fecha es un feriado oficial en el Perú.
   */
  isHoliday(date: Date): boolean {
    const year = date.getFullYear();
    const dateKey = this.toDateKey(date);
    return this.getHolidayKeysForYear(year).has(dateKey);
  }

  /**
   * Determina si un día es hábil laborable (ni fin de semana ni feriado).
   */
  isBusinessDay(date: Date): boolean {
    return !this.isWeekend(date) && !this.isHoliday(date);
  }

  /**
   * Suma una cantidad de días hábiles a una fecha dada.
   * Si la fecha inicial no es hábil, el conteo comienza a partir del siguiente día hábil.
   */
  addBusinessDays(startDate: Date, businessDaysToAdd: number): Date {
    if (businessDaysToAdd < 0) {
      throw new Error('businessDaysToAdd debe ser mayor o igual a cero');
    }

    const current = new Date(startDate.getTime());

    let added = 0;
    while (added < businessDaysToAdd) {
      current.setDate(current.getDate() + 1);
      if (this.isBusinessDay(current)) {
        added++;
      }
    }

    return current;
  }

  /**
   * Cuenta cuántos días hábiles hay entre dos fechas (excluyendo la fecha de inicio, incluyendo la de fin).
   */
  countBusinessDaysBetween(startDate: Date, endDate: Date): number {
    if (startDate >= endDate) return 0;

    const current = new Date(startDate.getTime());
    let count = 0;

    while (current < endDate) {
      current.setDate(current.getDate() + 1);
      if (this.isBusinessDay(current) && current <= endDate) {
        count++;
      }
    }

    return count;
  }

  /**
   * Calcula el SLA y fecha límite exacta para una cotización o solicitud,
   * evaluando si ya expiró con respecto a la fecha actual.
   */
  calculateSlaDeadline(
    createdAt: Date,
    slaBusinessDays: number,
    referenceDate: Date = new Date(),
  ): SlaCalculationResult {
    const deadline = this.addBusinessDays(createdAt, slaBusinessDays);
    const isExpired = referenceDate > deadline;

    let remainingBusinessDays = 0;
    if (!isExpired) {
      remainingBusinessDays = this.countBusinessDaysBetween(referenceDate, deadline);
    }

    return {
      startDate: createdAt,
      deadline,
      totalBusinessDays: slaBusinessDays,
      remainingBusinessDays,
      isExpired,
    };
  }

  /**
   * Retorna la lista legible de feriados de un año (útil para auditoría o visualización en UI).
   */
  getHolidaysList(year: number = new Date().getFullYear()) {
    return getPeruvianHolidaysForYear(year);
  }
}
