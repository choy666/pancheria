import {
  buildMapCoordinatesUrl,
  buildMapEmbedUrl,
  buildMapSearchUrl,
  describeLocationInput,
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

    test('extrae el src de un iframe de Google Maps ("Insertar un mapa")', () => {
      const iframe =
        '<iframe src="https://www.google.com/maps/embed?pb=abc123" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>';
      expect(tryBuildLocationUrl(iframe)).toBe(
        'https://www.google.com/maps/embed?pb=abc123'
      );
    });

    test('tolera comillas simples, src sin comillas, SRC mayúscula y atributos en otro orden', () => {
      expect(
        tryBuildLocationUrl(
          "<iframe width='400' src='https://www.openstreetmap.org/export/embed.html?bbox=1,2,3,4'></iframe>"
        )
      ).toBe(
        'https://www.openstreetmap.org/export/embed.html?bbox=1,2,3,4'
      );
      expect(
        tryBuildLocationUrl(
          '<iframe SRC="https://www.google.com/maps/embed?pb=x"></iframe>'
        )
      ).toBe('https://www.google.com/maps/embed?pb=x');
      expect(
        tryBuildLocationUrl('<iframe src=https://example.com/mapa></iframe>')
      ).toBe('https://example.com/mapa');
    });

    test('extrae el src del iframe y no el de un <img> previo en HTML mixto', () => {
      const mixed =
        '<div><img src="https://evil.example/x.png"><iframe src="https://www.google.com/maps/embed?pb=ok"></iframe></div>';
      expect(tryBuildLocationUrl(mixed)).toBe(
        'https://www.google.com/maps/embed?pb=ok'
      );
    });

    test('devuelve null para <img> sin iframe y para iframe con solo srcdoc', () => {
      expect(
        tryBuildLocationUrl('<img src="https://example.com/x.png">')
      ).toBeNull();
      expect(
        tryBuildLocationUrl('<iframe srcdoc="<p>html</p>"></iframe>')
      ).toBeNull();
    });

    test('rechaza un iframe con src que no sea http(s)', () => {
      expect(
        tryBuildLocationUrl('<iframe src="javascript:alert(1)"></iframe>')
      ).toBeNull();
      expect(
        tryBuildLocationUrl(
          '<iframe src="data:text/html;base64,PHNjcmlwdD4="></iframe>'
        )
      ).toBeNull();
    });

    test('decodifica &amp; en el src del iframe', () => {
      expect(
        tryBuildLocationUrl(
          '<iframe src="https://example.com/map?a=1&amp;b=2"></iframe>'
        )
      ).toBe('https://example.com/map?a=1&b=2');
    });
  });

  describe('describeLocationInput', () => {
    test('clasifica vacío e inválido', () => {
      expect(describeLocationInput('   ')).toEqual({ status: 'empty' });
      expect(describeLocationInput('')).toEqual({ status: 'empty' });
      expect(describeLocationInput('no es una ubicación')).toEqual({
        status: 'invalid',
      });
      expect(
        describeLocationInput('<iframe src="javascript:alert(1)"></iframe>')
      ).toEqual({ status: 'invalid' });
    });

    test('clasifica como link una URL válida no embebible', () => {
      expect(
        describeLocationInput('https://maps.app.goo.gl/abc123')
      ).toEqual({ status: 'link' });
      expect(describeLocationInput('https://example.com/mapa')).toEqual({
        status: 'link',
      });
    });

    test('clasifica como embed las coordenadas con su URL embebible', () => {
      const desc = describeLocationInput('-34.6037,-58.3816');
      expect(desc.status).toBe('embed');
      expect(desc.embedUrl).toContain('openstreetmap.org/export/embed.html');
    });

    test('clasifica el HTML del iframe según el src extraído', () => {
      const embed =
        describeLocationInput(
          '<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=-58.4,-34.7,-58.3,-34.6&layer=mapnik"></iframe>'
        );
      expect(embed.status).toBe('embed');
      expect(embed.embedUrl).toContain('export/embed.html');

      // El embed de Google no es un origen permitido con el proveedor por
      // defecto (openstreetmap): se muestra como enlace.
      expect(
        describeLocationInput(
          '<iframe src="https://www.google.com/maps/embed?pb=abc"></iframe>'
        ).status
      ).toBe('link');
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

    test('extrae coordenadas del patrón /@lat,lng del path de Google', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'google';
      const place = buildMapEmbedUrl(
        'https://www.google.com/maps/place/Pancheria/@-32.9468,-60.6393,17z/data=!3m1!4b1'
      );
      expect(place).toContain('output=embed');
      expect(place).toContain('q=-32.9468,-60.6393');

      const atRoot = buildMapEmbedUrl(
        'https://www.google.com/maps/@-32.9468,-60.6393,17z'
      );
      expect(atRoot).toContain('q=-32.9468,-60.6393');
    });

    test('rechaza coordenadas /@ fuera de rango', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'google';
      expect(
        buildMapEmbedUrl(
          'https://www.google.com/maps/place/X/@-95,-60.6393,17z/'
        )
      ).toBeNull();
      expect(
        buildMapEmbedUrl(
          'https://www.google.com/maps/place/X/@-32.9468,-200,17z/'
        )
      ).toBeNull();
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
