import {
  validateOpeningHours,
  isBranchOpen,
  getCurrentOrNextOpening,
  formatOpeningHours,
  parseOpeningHoursForm,
} from './branch-helpers';
import type { Branch } from '@/domain/types';

function makeBranch(openingHours: Branch['openingHours']): Branch {
  return {
    id: 1,
    name: 'Sucursal Test',
    openingHours,
    createdAt: new Date(),
  };
}

describe('branch-helpers', () => {
  describe('validateOpeningHours', () => {
    test('acepta un arreglo vacío', () => {
      expect(() => validateOpeningHours([])).not.toThrow();
    });

    test('acepta horarios válidos', () => {
      const hours = [{ dayOfWeek: 1, open: '20:00', close: '23:00' }];
      expect(() => validateOpeningHours(hours)).not.toThrow();
    });

    test('rechaza dayOfWeek fuera de rango', () => {
      const hours = [{ dayOfWeek: 7, open: '20:00', close: '23:00' }];
      expect(() => validateOpeningHours(hours)).toThrow();
    });

    test('rechaza formato de hora inválido', () => {
      const hours = [{ dayOfWeek: 1, open: '8:00', close: '23:00' }];
      expect(() => validateOpeningHours(hours)).toThrow();
    });

    test('rechaza cierre anterior o igual al apertura', () => {
      const hours = [{ dayOfWeek: 1, open: '20:00', close: '20:00' }];
      expect(() => validateOpeningHours(hours)).toThrow();
    });

    test('rechaza horarios duplicados', () => {
      const hours = [
        { dayOfWeek: 1, open: '20:00', close: '23:00' },
        { dayOfWeek: 1, open: '20:00', close: '23:00' },
      ];
      expect(() => validateOpeningHours(hours)).toThrow();
    });

    test('acepta múltiples franjas no solapadas para el mismo día', () => {
      const hours = [
        { dayOfWeek: 1, open: '08:00', close: '12:00' },
        { dayOfWeek: 1, open: '17:00', close: '22:00' },
      ];
      expect(() => validateOpeningHours(hours)).not.toThrow();
    });

    test('rechaza franjas solapadas para el mismo día', () => {
      const hours = [
        { dayOfWeek: 1, open: '08:00', close: '14:00' },
        { dayOfWeek: 1, open: '12:00', close: '18:00' },
      ];
      expect(() => validateOpeningHours(hours)).toThrow();
    });

    test('acepta franjas consecutivas sin solapamiento', () => {
      const hours = [
        { dayOfWeek: 1, open: '08:00', close: '12:00' },
        { dayOfWeek: 1, open: '12:00', close: '18:00' },
      ];
      expect(() => validateOpeningHours(hours)).not.toThrow();
    });
  });

  describe('parseOpeningHoursForm', () => {
    test('parsea una franja por día', () => {
      const formData = new FormData();
      formData.append('openingHours[1][0][open]', '08:00');
      formData.append('openingHours[1][0][close]', '18:00');

      const hours = parseOpeningHoursForm(formData);
      expect(hours).toEqual([{ dayOfWeek: 1, open: '08:00', close: '18:00' }]);
    });

    test('parsea múltiples franjas por día', () => {
      const formData = new FormData();
      formData.append('openingHours[1][0][open]', '08:00');
      formData.append('openingHours[1][0][close]', '12:00');
      formData.append('openingHours[1][1][open]', '17:00');
      formData.append('openingHours[1][1][close]', '22:00');

      const hours = parseOpeningHoursForm(formData);
      expect(hours).toEqual([
        { dayOfWeek: 1, open: '08:00', close: '12:00' },
        { dayOfWeek: 1, open: '17:00', close: '22:00' },
      ]);
    });

    test('ignora franjas incompletas', () => {
      const formData = new FormData();
      formData.append('openingHours[1][0][open]', '08:00');

      const hours = parseOpeningHoursForm(formData);
      expect(hours).toEqual([]);
    });
  });

  describe('isBranchOpen', () => {
    test('está cerrado sin horarios', () => {
      expect(isBranchOpen(makeBranch([]), new Date())).toBe(false);
    });

    test('está abierto dentro del horario', () => {
      const branch = makeBranch([{ dayOfWeek: 1, open: '20:00', close: '23:00' }]);
      const now = new Date('2025-06-02T21:00:00-03:00'); // Lunes
      expect(isBranchOpen(branch, now)).toBe(true);
    });

    test('está cerrado fuera del horario', () => {
      const branch = makeBranch([{ dayOfWeek: 1, open: '20:00', close: '23:00' }]);
      const now = new Date('2025-06-02T19:00:00-03:00'); // Lunes
      expect(isBranchOpen(branch, now)).toBe(false);
    });
  });

  describe('getCurrentOrNextOpening', () => {
    test('indica que no hay horarios configurados', () => {
      const branch = makeBranch([]);
      expect(getCurrentOrNextOpening(branch, new Date())).toBe(
        'No hay horarios de apertura configurados.'
      );
    });

    test('muestra el horario de hoy cuando aún está por abrir', () => {
      const branch = makeBranch([{ dayOfWeek: 1, open: '20:00', close: '23:00' }]);
      const now = new Date('2025-06-02T18:00:00-03:00'); // Lunes
      expect(getCurrentOrNextOpening(branch, now)).toBe('Hoy: de 20:00 a 23:00');
    });

    test('muestra el siguiente día cuando el horario de hoy ya pasó', () => {
      const branch = makeBranch([
        { dayOfWeek: 1, open: '20:00', close: '23:00' },
        { dayOfWeek: 2, open: '08:00', close: '18:00' },
      ]);
      const now = new Date('2025-06-02T23:30:00-03:00'); // Lunes, después del horario
      expect(getCurrentOrNextOpening(branch, now)).toBe('Mañana: de 08:00 a 18:00');
    });
  });

  describe('formatOpeningHours', () => {
    test('formatea los horarios por día', () => {
      const hours = [
        { dayOfWeek: 5, open: '20:00', close: '23:00' },
        { dayOfWeek: 6, open: '12:00', close: '15:00' },
      ];
      expect(formatOpeningHours(hours)).toBe(
        'Viernes: 20:00 - 23:00, Sábado: 12:00 - 15:00'
      );
    });
  });
});
