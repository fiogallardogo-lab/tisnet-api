import { describe, expect, it, beforeEach } from 'vitest';
import { BusinessDaysService } from './business-days.service';
import { getPeruvianHolidaysForYear } from './peruvian-holidays';

describe('BusinessDaysService', () => {
  let service: BusinessDaysService;

  beforeEach(() => {
    service = new BusinessDaysService();
  });

  describe('isWeekend', () => {
    it('identifica correctamente sábados y domingos', () => {
      const saturday = new Date(2026, 8, 26); // Sábado 26 de septiembre 2026
      const sunday = new Date(2026, 8, 27); // Domingo 27 de septiembre 2026
      const monday = new Date(2026, 8, 28); // Lunes 28 de septiembre 2026

      expect(service.isWeekend(saturday)).toBe(true);
      expect(service.isWeekend(sunday)).toBe(true);
      expect(service.isWeekend(monday)).toBe(false);
    });
  });

  describe('isHoliday', () => {
    it('reconoce feriados fijos peruanos (ej. 28 y 29 de julio, 1 de mayo)', () => {
      const fiestasPatrias1 = new Date(2026, 6, 28); // 28 de Julio
      const fiestasPatrias2 = new Date(2026, 6, 29); // 29 de Julio
      const diaTrabajo = new Date(2026, 4, 1); // 1 de Mayo
      const unDiaComun = new Date(2026, 6, 20); // 20 de Julio (Lunes normal)

      expect(service.isHoliday(fiestasPatrias1)).toBe(true);
      expect(service.isHoliday(fiestasPatrias2)).toBe(true);
      expect(service.isHoliday(diaTrabajo)).toBe(true);
      expect(service.isHoliday(unDiaComun)).toBe(false);
    });

    it('reconoce feriados móviles de Semana Santa en 2026 (Jueves 2 y Viernes 3 de Abril)', () => {
      const juevesSanto = new Date(2026, 3, 2); // 2 de abril 2026
      const viernesSanto = new Date(2026, 3, 3); // 3 de abril 2026
      const sabadoSanto = new Date(2026, 3, 4); // 4 de abril (no es feriado oficial, es fin de semana)
      const miercolesPrevio = new Date(2026, 3, 1); // 1 de abril (día hábil normal)

      expect(service.isHoliday(juevesSanto)).toBe(true);
      expect(service.isHoliday(viernesSanto)).toBe(true);
      expect(service.isHoliday(miercolesPrevio)).toBe(false);
    });
  });

  describe('isBusinessDay', () => {
    it('retorna true solo para días que no sean fines de semana ni feriados', () => {
      const miercolesNormal = new Date(2026, 8, 23); // Miércoles 23 de septiembre 2026
      const domingo = new Date(2026, 8, 27); // Domingo
      const navidad = new Date(2026, 11, 25); // 25 de Diciembre

      expect(service.isBusinessDay(miercolesNormal)).toBe(true);
      expect(service.isBusinessDay(domingo)).toBe(false);
      expect(service.isBusinessDay(navidad)).toBe(false);
    });
  });

  describe('addBusinessDays', () => {
    it('suma días hábiles saltando fines de semana', () => {
      // Viernes 25 de septiembre de 2026 + 1 día hábil = Lunes 28 de septiembre
      const viernes = new Date(2026, 8, 25);
      const resultado = service.addBusinessDays(viernes, 1);

      expect(resultado.getDate()).toBe(28);
      expect(resultado.getMonth()).toBe(8); // Septiembre
      expect(resultado.getDay()).toBe(1); // Lunes
    });

    it('salta fines de semana y feriados consecutivos correctamente', () => {
      // Semana de Fiestas Patrias 2026:
      // 28 de Julio 2026 (Martes - Feriado)
      // 29 de Julio 2026 (Miércoles - Feriado)
      // Lunes 27 de Julio 2026 + 1 día hábil = Jueves 30 de Julio 2026
      const lunes27Julio = new Date(2026, 6, 27);
      const resultado = service.addBusinessDays(lunes27Julio, 1);

      expect(resultado.getDate()).toBe(30);
      expect(resultado.getMonth()).toBe(6); // Julio
    });

    it('lanza error si el número de días es negativo', () => {
      expect(() => service.addBusinessDays(new Date(), -1)).toThrow(
        'businessDaysToAdd debe ser mayor o igual a cero',
      );
    });
  });

  describe('countBusinessDaysBetween', () => {
    it('cuenta únicamente días hábiles entre dos fechas', () => {
      const lunes = new Date(2026, 8, 21);
      const viernes = new Date(2026, 8, 25);

      // Martes, Miércoles, Jueves, Viernes = 4 días
      const dias = service.countBusinessDaysBetween(lunes, viernes);
      expect(dias).toBe(4);
    });
  });

  describe('calculateSlaDeadline', () => {
    it('calcula fecha límite y días restantes con SLA', () => {
      const lunes = new Date(2026, 8, 21, 10, 0, 0);
      const miercolesMismaSemana = new Date(2026, 8, 23, 10, 0, 0);

      const sla = service.calculateSlaDeadline(lunes, 5, miercolesMismaSemana);

      expect(sla.totalBusinessDays).toBe(5);
      expect(sla.isExpired).toBe(false);
      expect(sla.remainingBusinessDays).toBe(3);
    });

    it('identifica cuándo el SLA ya ha vencido', () => {
      const haceUnMes = new Date(2026, 7, 1);
      const hoy = new Date(2026, 8, 25);

      const sla = service.calculateSlaDeadline(haceUnMes, 3, hoy);
      expect(sla.isExpired).toBe(true);
      expect(sla.remainingBusinessDays).toBe(0);
    });
  });

  describe('getHolidaysList', () => {
    it('retorna la lista ordenada de feriados del año incluyendo fijos y móviles', () => {
      const holidays = service.getHolidaysList(2026);
      expect(holidays.length).toBeGreaterThanOrEqual(16); // 14 fijos + 2 móviles
      expect(holidays.some((h) => h.name === 'Jueves Santo')).toBe(true);
      expect(holidays.some((h) => h.name === 'Viernes Santo')).toBe(true);
      expect(holidays.some((h) => h.name === 'Fiestas Patrias (Independencia)')).toBe(true);
    });
  });
});
