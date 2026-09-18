import {
  buildMapCoordinatesUrl,
  buildMapEmbedUrl,
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

  describe('buildMapEmbedUrl', () => {
    test('convierte coordenadas en embed de OpenStreetMap por defecto', () => {
      const url = buildMapEmbedUrl('-34.6037, -58.3816');
      expect(url).not.toBeNull();
      expect(url).toContain('openstreetmap.org/export/embed.html');
      expect(url).toContain('marker=-34.6037,-58.3816');
      expect(url).toContain('bbox=');
    });

    test('convierte coordenadas en embed de Google cuando el proveedor es google', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'google';
      const url = buildMapEmbedUrl('-34.6037,-58.3816');
      expect(url).toContain('google.com');
      expect(url).toContain('q=-34.6037,-58.3816');
      expect(url).toContain('output=embed');
    });

    test('devuelve null para coordenadas cuando el proveedor es waze (sin embed)', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'waze';
      expect(buildMapEmbedUrl('-34.6037,-58.3816')).toBeNull();
    });

    test('usa NEXT_PUBLIC_MAPS_BASE_URL como base del embed', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'raw';
      process.env.NEXT_PUBLIC_MAPS_BASE_URL = 'https://maps.ejemplo.com';
      const url = buildMapEmbedUrl('-34.6037,-58.3816');
      expect(url).toContain('https://maps.ejemplo.com/export/embed.html');
    });

    test('traduce una URL de OSM con mlat/mlon al embed', () => {
      const location =
        'https://www.openstreetmap.org/?mlat=-34.6037&mlon=-58.3816#map=18/-34.6037/-58.3816';
      const url = buildMapEmbedUrl(location);
      expect(url).toContain('openstreetmap.org/export/embed.html');
      expect(url).toContain('marker=-34.6037,-58.3816');
    });

    test('traduce una URL de OSM con solo el fragmento #map al embed', () => {
      const url = buildMapEmbedUrl(
        'https://www.openstreetmap.org/#map=18/-34.6037/-58.3816'
      );
      expect(url).toContain('openstreetmap.org/export/embed.html');
      expect(url).toContain('marker=-34.6037,-58.3816');
    });

    test('devuelve tal cual una URL ya embebible de un origen permitido', () => {
      const embed =
        'https://www.openstreetmap.org/export/embed.html?bbox=-58.4,-34.7,-58.3,-34.6&layer=mapnik';
      expect(buildMapEmbedUrl(embed)).toBe(embed);
    });

    test('traduce una URL de Google con query=lat,lng al embed', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'google';
      const url = buildMapEmbedUrl(
        'https://www.google.com/maps/search/?api=1&query=-34.6037,-58.3816'
      );
      expect(url).toContain('google.com/maps?q=-34.6037,-58.3816');
      expect(url).toContain('output=embed');
    });

    test('devuelve null para short links y orígenes no permitidos', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'google';
      expect(buildMapEmbedUrl('https://maps.app.goo.gl/abc123')).toBeNull();
      expect(buildMapEmbedUrl('https://goo.gl/maps/abc123')).toBeNull();
      expect(buildMapEmbedUrl('https://wa.me/5493415555555')).toBeNull();
      expect(buildMapEmbedUrl('https://example.com/mapa')).toBeNull();
    });

    test('devuelve null para URL del proveedor sin coordenadas embebibles', () => {
      expect(buildMapEmbedUrl('https://www.openstreetmap.org/')).toBeNull();
    });

    test('devuelve null para URLs de Waze aunque el proveedor sea waze', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'waze';
      expect(
        buildMapEmbedUrl('https://waze.com/ul?ll=-34.6037,-58.3816')
      ).toBeNull();
    });

    test('devuelve null para valores inválidos o esquemas inseguros', () => {
      expect(buildMapEmbedUrl('no es una ubicación')).toBeNull();
      expect(buildMapEmbedUrl('javascript:alert(1)')).toBeNull();
      expect(buildMapEmbedUrl('   ')).toBeNull();
    });
  });
});
