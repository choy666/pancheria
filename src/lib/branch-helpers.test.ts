import {
  validateOpeningHours,
  isBranchOpen,
  getCurrentOrNextOpening,
  getTodayOpening,
  formatOpeningHours,
  parseOpeningHoursForm,
  normalizeBranchPhones,
  normalizeSocialLinks,
  parseContactsForm,
  getSocialLinkHref,
} from './branch-helpers';
import type { Branch } from '@/domain/types';

function makeBranch(openingHours: Branch['openingHours']): Branch {
  return {
    id: 1,
    name: 'Sucursal Test',
    openingHours,
    phones: [],
    socialLinks: [],
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

    test('acepta un turno overnight (cierre menor a la apertura)', () => {
      const hours = [{ dayOfWeek: 1, open: '20:00', close: '02:00' }];
      expect(() => validateOpeningHours(hours)).not.toThrow();
    });

    test('rechaza solapamiento con la continuación overnight del mismo día', () => {
      const hours = [
        { dayOfWeek: 1, open: '20:00', close: '02:00' },
        { dayOfWeek: 1, open: '21:00', close: '23:00' },
      ];
      expect(() => validateOpeningHours(hours)).toThrow();
    });

    test('rechaza solapamiento del overnight del domingo con una franja del lunes', () => {
      const hours = [
        { dayOfWeek: 0, open: '20:00', close: '02:00' },
        { dayOfWeek: 1, open: '01:00', close: '03:00' },
      ];
      expect(() => validateOpeningHours(hours)).toThrow();
    });

    test('acepta overnight del domingo seguido de una franja del lunes sin cruce', () => {
      const hours = [
        { dayOfWeek: 0, open: '20:00', close: '02:00' },
        { dayOfWeek: 1, open: '08:00', close: '12:00' },
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

    test('conserva franjas incompletas para que el validador muestre el error', () => {
      const formData = new FormData();
      formData.append('openingHours[1][0][open]', '08:00');

      const hours = parseOpeningHoursForm(formData);
      expect(hours).toEqual([{ dayOfWeek: 1, open: '08:00', close: '' }]);
      expect(() => validateOpeningHours(hours)).toThrow();
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

    test('está abierto pasada medianoche dentro de un turno overnight', () => {
      const branch = makeBranch([{ dayOfWeek: 1, open: '20:00', close: '02:00' }]);
      // Martes 01:00: el turno del lunes sigue vigente.
      expect(isBranchOpen(branch, new Date('2025-06-03T01:00:00-03:00'))).toBe(
        true
      );
    });

    test('está cerrado cuando el turno overnight ya terminó', () => {
      const branch = makeBranch([{ dayOfWeek: 1, open: '20:00', close: '02:00' }]);
      expect(isBranchOpen(branch, new Date('2025-06-03T03:00:00-03:00'))).toBe(
        false
      );
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
      expect(getCurrentOrNextOpening(branch, now)).toBe('Hoy de 20:00 a 23:00');
    });

    test('muestra el siguiente día cuando el horario de hoy ya pasó', () => {
      const branch = makeBranch([
        { dayOfWeek: 1, open: '20:00', close: '23:00' },
        { dayOfWeek: 2, open: '08:00', close: '18:00' },
      ]);
      const now = new Date('2025-06-02T23:30:00-03:00'); // Lunes, después del horario
      expect(getCurrentOrNextOpening(branch, now)).toBe('Mañana de 08:00 a 18:00');
    });

    test('muestra el día real de inicio cuando el turno overnight sigue en curso', () => {
      const branch = makeBranch([{ dayOfWeek: 1, open: '20:00', close: '02:00' }]);
      // Martes 01:00: el turno abrió el lunes, no "hoy".
      const now = new Date('2025-06-03T01:00:00-03:00');
      expect(getCurrentOrNextOpening(branch, now)).toBe('Lunes de 20:00 a 02:00');
    });
  });

  describe('getTodayOpening', () => {
    test('incluye el turno overnight en curso aunque haya abierto el día anterior', () => {
      const branch = makeBranch([{ dayOfWeek: 1, open: '20:00', close: '02:00' }]);
      // Martes 01:00: el turno del lunes sigue vigente; no es "hoy no atendemos".
      const now = new Date('2025-06-03T01:00:00-03:00');
      expect(getTodayOpening(branch, now)).toBe('Hoy de 20:00 a 02:00');
    });

    test('combina el overnight en curso con las franjas propias del día', () => {
      const branch = makeBranch([
        { dayOfWeek: 1, open: '20:00', close: '02:00' },
        { dayOfWeek: 2, open: '11:00', close: '14:00' },
      ]);
      const now = new Date('2025-06-03T01:00:00-03:00'); // Martes
      expect(getTodayOpening(branch, now)).toBe(
        'Hoy de 20:00 a 02:00 y de 11:00 a 14:00'
      );
    });

    test('no duplica la franja cuando el turno en curso es del mismo día', () => {
      const branch = makeBranch([{ dayOfWeek: 1, open: '20:00', close: '23:00' }]);
      const now = new Date('2025-06-02T21:00:00-03:00'); // Lunes
      expect(getTodayOpening(branch, now)).toBe('Hoy de 20:00 a 23:00');
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

  describe('normalizeBranchPhones', () => {
    test('devuelve un arreglo vacío para valores nulos', () => {
      expect(normalizeBranchPhones(undefined)).toEqual([]);
      expect(normalizeBranchPhones(null)).toEqual([]);
    });

    test('recorta espacios de etiqueta y número', () => {
      expect(
        normalizeBranchPhones([{ label: '  Pedidos  ', number: ' 3415555555 ' }])
      ).toEqual([{ label: 'Pedidos', number: '3415555555' }]);
    });

    test('rechaza un teléfono sin número', () => {
      expect(() =>
        normalizeBranchPhones([{ label: 'Pedidos', number: '   ' }])
      ).toThrow('es obligatorio');
    });

    test('rechaza un número con caracteres inválidos', () => {
      expect(() =>
        normalizeBranchPhones([{ label: 'Pedidos', number: 'abc-###' }])
      ).toThrow('no es válido');
    });

    test('rechaza más de 10 teléfonos', () => {
      const phones = Array.from({ length: 11 }, (_, i) => ({
        label: `Tel ${i}`,
        number: '3415555555',
      }));
      expect(() => normalizeBranchPhones(phones)).toThrow();
    });
  });

  describe('normalizeSocialLinks', () => {
    test('acepta una URL http(s) completa', () => {
      expect(
        normalizeSocialLinks([
          { network: 'instagram', url: 'https://instagram.com/pancheria' },
        ])
      ).toEqual([
        { network: 'instagram', url: 'https://instagram.com/pancheria' },
      ]);
    });

    test('acepta un handle sin URL', () => {
      expect(
        normalizeSocialLinks([{ network: 'instagram', url: '@pancheria' }])
      ).toEqual([{ network: 'instagram', url: '@pancheria' }]);
    });

    test('acepta un número de teléfono para WhatsApp', () => {
      expect(
        normalizeSocialLinks([{ network: 'whatsapp', url: '+54 341 555 5555' }])
      ).toEqual([{ network: 'whatsapp', url: '+54 341 555 5555' }]);
    });

    test('normaliza la red a minúsculas', () => {
      expect(
        normalizeSocialLinks([
          { network: 'INSTAGRAM', url: 'https://instagram.com/x' },
        ])
      ).toEqual([{ network: 'instagram', url: 'https://instagram.com/x' }]);
    });

    test('rechaza una red desconocida', () => {
      expect(() =>
        normalizeSocialLinks([{ network: 'myspace', url: 'https://x.com' }])
      ).toThrow('no es válida');
    });

    test('rechaza un enlace inseguro', () => {
      expect(() =>
        normalizeSocialLinks([
          { network: 'instagram', url: 'javascript:alert(1)' },
        ])
      ).toThrow('no es una URL http(s)');
    });

    test('rechaza un enlace vacío', () => {
      expect(() =>
        normalizeSocialLinks([{ network: 'facebook', url: '  ' }])
      ).toThrow('es obligatorio');
    });
  });

  describe('getSocialLinkHref', () => {
    test('devuelve la URL tal cual cuando es http(s)', () => {
      expect(
        getSocialLinkHref({
          network: 'instagram',
          url: 'https://instagram.com/pancheria',
        })
      ).toBe('https://instagram.com/pancheria');
    });

    test('traduce un número de WhatsApp a wa.me', () => {
      expect(
        getSocialLinkHref({ network: 'whatsapp', url: '+54 341 555-5555' })
      ).toBe('https://wa.me/543415555555');
    });

    test('devuelve null para un handle sin URL', () => {
      expect(getSocialLinkHref({ network: 'instagram', url: '@pancheria' })).toBe(
        null
      );
    });
  });

  describe('parseContactsForm', () => {
    test('parsea filas de teléfonos y redes sociales', () => {
      const formData = new FormData();
      formData.append('phones[0][label]', 'Pedidos');
      formData.append('phones[0][number]', '3415555555');
      formData.append('phones[1][label]', 'WhatsApp');
      formData.append('phones[1][number]', '3416666666');
      formData.append('socialLinks[0][network]', 'instagram');
      formData.append('socialLinks[0][url]', '@pancheria');

      expect(parseContactsForm(formData)).toEqual({
        phones: [
          { label: 'Pedidos', number: '3415555555' },
          { label: 'WhatsApp', number: '3416666666' },
        ],
        socialLinks: [{ network: 'instagram', url: '@pancheria' }],
      });
    });

    test('descarta filas completamente vacías y conserva las parciales', () => {
      const formData = new FormData();
      formData.append('phones[0][label]', '');
      formData.append('phones[0][number]', '');
      formData.append('phones[1][label]', 'Pedidos');
      formData.append('phones[1][number]', '');

      const { phones } = parseContactsForm(formData);
      // La fila parcial se conserva para que el validador muestre el error.
      expect(phones).toEqual([{ label: 'Pedidos', number: '' }]);
    });
  });
});
