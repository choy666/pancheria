import {
  buildMapCoordinatesUrl,
  buildMapSearchUrl,
  isKnownMapUrl,
  isValidLocationUrl,
  tryBuildLocationUrl,
} from './maps';

const originalEnv = process.env;

describe('maps helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_MAPS_PROVIDER;
    delete process.env.NEXT_PUBLIC_MAPS_BASE_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('buildMapCoordinatesUrl', () => {
    test('genera una URL de OpenStreetMap por defecto', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'openstreetmap';
      const url = buildMapCoordinatesUrl(-34.6037, -58.3816);
      expect(url).toContain('openstreetmap.org');
      expect(url).toContain('mlat=-34.6037');
      expect(url).toContain('mlon=-58.3816');
    });

    test('genera una URL de Google Maps cuando el proveedor es google', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'google';
      const url = buildMapCoordinatesUrl(-34.6037, -58.3816);
      expect(url).toContain('google.com/maps');
      expect(url).toContain('query=-34.6037,-58.3816');
    });

    test('redondea las coordenadas a 6 decimales', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'openstreetmap';
      const url = buildMapCoordinatesUrl(-34.6037222, -58.3816123);
      expect(url).toContain('mlat=-34.603722');
    });

    test('usa NEXT_PUBLIC_MAPS_BASE_URL cuando está configurada', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'raw';
      process.env.NEXT_PUBLIC_MAPS_BASE_URL = 'https://maps.ejemplo.com';
      const url = buildMapCoordinatesUrl(-34.6, -58.3);
      expect(url).toBe('https://maps.ejemplo.com/?mlat=-34.6&mlon=-58.3');
    });
  });

  describe('buildMapSearchUrl', () => {
    test('genera una URL de búsqueda codificada', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'openstreetmap';
      const url = buildMapSearchUrl('Av. Pellegrini 1234');
      expect(url).toContain('openstreetmap.org');
      expect(url).toContain(encodeURIComponent('Av. Pellegrini 1234'));
    });

    test('devuelve cadena vacía si la consulta está vacía', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'openstreetmap';
      expect(buildMapSearchUrl('   ')).toBe('');
    });
  });

  describe('isKnownMapUrl', () => {
    test('reconoce URLs de OpenStreetMap', () => {
      expect(isKnownMapUrl('https://www.openstreetmap.org/#map=18/-34.6/-58.3')).toBe(true);
    });

    test('reconoce URLs de Google Maps', () => {
      expect(isKnownMapUrl('https://www.google.com/maps/search/?api=1&query=-34.6,-58.3')).toBe(true);
    });

    test('rechaza URLs desconocidas', () => {
      expect(isKnownMapUrl('https://example.com')).toBe(false);
      expect(isKnownMapUrl('javascript:alert(1)')).toBe(false);
    });

    test('rechaza URLs que solo contienen el dominio como parte del path o query', () => {
      expect(
        isKnownMapUrl('https://evil.com?x=openstreetmap.org')
      ).toBe(false);
      expect(
        isKnownMapUrl('https://example.com/google.com/maps')
      ).toBe(false);
    });

    test('rechaza subdominios de terceros', () => {
      expect(isKnownMapUrl('https://openstreetmap.org.evil.com')).toBe(false);
    });
  });

  describe('isValidLocationUrl', () => {
    test('acepta URLs https', () => {
      expect(isValidLocationUrl('https://maps.example.com')).toBe(true);
    });

    test('rechaza esquemas inseguros', () => {
      expect(isValidLocationUrl('javascript:alert(1)')).toBe(false);
      expect(isValidLocationUrl('data:text/html,<script>')).toBe(false);
    });

    test('acepta coordenadas como texto', () => {
      expect(isValidLocationUrl('-34.6037,-58.3816')).toBe(true);
      expect(isValidLocationUrl('34.6037; -58.3816')).toBe(true);
    });

    test('rechaza coordenadas fuera de rango', () => {
      expect(isValidLocationUrl('100,200')).toBe(false);
    });
  });

  describe('tryBuildLocationUrl', () => {
    test('convierte coordenadas en URL de mapas', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'openstreetmap';
      const url = tryBuildLocationUrl('-34.6037,-58.3816');
      expect(url).toContain('openstreetmap.org');
    });

    test('mantiene URLs válidas', () => {
      const url = 'https://maps.example.com';
      expect(tryBuildLocationUrl(url)).toBe(url);
    });

    test('devuelve null para valores inválidos', () => {
      expect(tryBuildLocationUrl('no es una ubicación')).toBeNull();
    });
  });
});
