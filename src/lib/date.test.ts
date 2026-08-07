import {
  formatDateTime,
  safeFormatDuration,
  formatLastUpdated,
  formatTime,
  calculateDuration,
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

  describe('calculateDuration', () => {
    test('calcula la duración entre dos fechas', () => {
      const start = new Date('2025-06-15T10:00:00');
      const end = new Date('2025-06-15T11:30:45');
      const result = calculateDuration(start, end);

      expect(result).not.toBeNull();
      expect(result?.hours).toBe(1);
      expect(result?.minutes).toBe(30);
    });

    test('calcula la duración hasta ahora si no hay fin', () => {
      const start = new Date('2025-06-15T10:00:00');
      const result = calculateDuration(start, null);

      expect(result).not.toBeNull();
      expect(result?.minutes).toBeGreaterThanOrEqual(0);
    });
  });
});
