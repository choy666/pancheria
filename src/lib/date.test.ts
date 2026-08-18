import {
  formatDateTime,
  safeFormatDuration,
  formatLastUpdated,
  formatTime,
  startOfDayUTC,
  endOfDayUTC,
  parseDateStringUTC,
  nowUTC,
} from './date';

describe('date helpers', () => {
  describe('formatDateTime', () => {
    test('formatea una fecha como dd/MM/yyyy HH:mm', () => {
      const date = new Date('2025-06-15T14:30:00');
      const result = formatDateTime(date);
      expect(result).toMatch(/^15\/06\/2025 14:30$/);
    });

    test('formatea una fecha pasada como string', () => {
      const result = formatDateTime('2025-06-15T09:05:00');
      expect(result).toMatch(/^15\/06\/2025 09:05$/);
    });

    test('devuelve guión para fechas nulas', () => {
      expect(formatDateTime(null)).toBe('-');
      expect(formatDateTime(undefined as unknown as null)).toBe('-');
    });
  });

  describe('safeFormatDuration', () => {
    test('formatea una duración en horas y minutos', () => {
      const result = safeFormatDuration({ hours: 1, minutes: 5 });
      expect(result).toMatch(/1 hora/);
      expect(result).toMatch(/5 minutos?/);
    });

    test('devuelve la etiqueta por defecto para duraciones nulas', () => {
      expect(safeFormatDuration(null)).toBe('0m');
    });

    test('devuelve la etiqueta personalizada cuando la duración está vacía', () => {
      const result = safeFormatDuration({ minutes: 0 }, 'sin duración');
      expect(result).toBe('sin duración');
    });
  });

  describe('formatLastUpdated', () => {
    test('formatea una fecha como HH:mm:ss', () => {
      const date = new Date('2025-06-15T14:05:30');
      const result = formatLastUpdated(date);
      expect(result).toMatch(/^14:05:30$/);
    });

    test('devuelve guión para fechas nulas', () => {
      expect(formatLastUpdated(null)).toBe('-');
    });
  });

  describe('formatTime', () => {
    test('formatea un objeto Date como HH:mm', () => {
      const date = new Date('2025-06-15T08:30:00');
      expect(formatTime(date)).toBe('08:30');
    });

    test('formatea una fecha ISO como HH:mm', () => {
      expect(formatTime('2025-06-15T23:05:00')).toBe('23:05');
    });
  });

  describe('startOfDayUTC', () => {
    test('devuelve el inicio del día en UTC para un Date', () => {
      const date = new Date('2025-06-15T14:30:00Z');
      const result = startOfDayUTC(date);
      expect(result.toISOString()).toBe('2025-06-15T00:00:00.000Z');
    });

    test('devuelve el inicio del día en UTC para un string ISO', () => {
      const result = startOfDayUTC('2025-06-15T14:30:00Z');
      expect(result.toISOString()).toBe('2025-06-15T00:00:00.000Z');
    });

    test('interpreta fechas cortas como UTC', () => {
      const result = startOfDayUTC('2025-06-15');
      expect(result.toISOString()).toBe('2025-06-15T00:00:00.000Z');
    });
  });

  describe('endOfDayUTC', () => {
    test('devuelve el final del día en UTC', () => {
      const date = new Date('2025-06-15T14:30:00Z');
      const result = endOfDayUTC(date);
      expect(result.toISOString()).toBe('2025-06-15T23:59:59.999Z');
    });
  });

  describe('parseDateStringUTC', () => {
    test('interpreta YYYY-MM-DD como inicio de día UTC', () => {
      const result = parseDateStringUTC('2025-06-15');
      expect(result.toISOString()).toBe('2025-06-15T00:00:00.000Z');
    });

    test('respeta zona horaria de ISO con offset', () => {
      const result = parseDateStringUTC('2025-06-15T14:30:00-03:00');
      expect(result.toISOString()).toBe('2025-06-15T17:30:00.000Z');
    });
  });

  describe('nowUTC', () => {
    test('devuelve una fecha cercana al momento actual', () => {
      const before = Date.now();
      const result = nowUTC().getTime();
      const after = Date.now();
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });
});
