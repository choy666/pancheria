import {
  buildMapCoordinatesUrl,
  buildMapEmbedUrl,
  buildMapSearchUrl,
  buildMapViewUrl,
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

      // El embed de Google se acepta como mapa embebido aunque el proveedor
      // configurado sea otro: "Insertar un mapa" siempre produce iframe.
      const googleEmbed = describeLocationInput(
        '<iframe src="https://www.google.com/maps/embed?pb=abc"></iframe>'
      );
      expect(googleEmbed.status).toBe('embed');
      expect(googleEmbed.embedUrl).toBe(
        'https://www.google.com/maps/embed?pb=abc'
      );
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

    test('devuelve tal cual la URL de embed de Google aunque el proveedor sea openstreetmap', () => {
      // Caso real: el admin pega el HTML de "Insertar un mapa" de Google sin
      // configurar NEXT_PUBLIC_MAPS_PROVIDER=google.
      const embed = 'https://www.google.com/maps/embed?pb=abc123';
      expect(buildMapEmbedUrl(embed)).toBe(embed);
      expect(
        buildMapEmbedUrl('https://maps.google.com/maps?q=x&output=embed')
      ).toBe('https://maps.google.com/maps?q=x&output=embed');
    });

    test('traduce una URL de Google con coordenadas al embed de Google sin importar el proveedor', () => {
      const url = buildMapEmbedUrl(
        'https://www.google.com/maps/place/Pancheria/@-32.9468,-60.6393,17z'
      );
      expect(url).toContain('google.com/maps?q=-32.9468,-60.6393');
      expect(url).toContain('output=embed');
    });

    test('traduce una URL de OSM al embed de OSM aunque el proveedor sea google', () => {
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'google';
      const url = buildMapEmbedUrl(
        'https://www.openstreetmap.org/?mlat=-34.6037&mlon=-58.3816'
      );
      expect(url).toContain('openstreetmap.org/export/embed.html');
      expect(url).toContain('marker=-34.6037,-58.3816');
    });

    test('traduce un embed de Google en dominio regional al origen canónico', () => {
      // `google.com.ar` no está en frame-src: el embed se reconstruye sobre
      // maps.google.com con las coordenadas del `pb` (`!2d`lng`!3d`lat`).
      const url = buildMapEmbedUrl(
        'https://www.google.com.ar/maps/embed?pb=!1m18!1m12!1m3!1d3393!2d-60.6544!3d-32.945!2m3!1f0!2f0!3f0'
      );
      expect(url).toBe(
        'https://maps.google.com/maps?q=-32.945,-60.6544&z=16&output=embed'
      );
    });

    test('extrae las coordenadas del marcador !3d/!4d del pb de Google', () => {
      const url = buildMapEmbedUrl(
        'https://www.google.com.ar/maps/embed?pb=!4m2!3d-32.9468!4d-60.6393'
      );
      expect(url).toContain('q=-32.9468,-60.6393');
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

  describe('buildMapViewUrl', () => {
    test('devuelve tal cual una URL de página de mapa', () => {
      expect(buildMapViewUrl('https://maps.app.goo.gl/abc123')).toBe(
        'https://maps.app.goo.gl/abc123'
      );
      expect(
        buildMapViewUrl(
          'https://www.openstreetmap.org/?mlat=-32.9468&mlon=-60.6393'
        )
      ).toBe('https://www.openstreetmap.org/?mlat=-32.9468&mlon=-60.6393');
    });

    test('convierte coordenadas en URL del proveedor configurado', () => {
      expect(buildMapViewUrl('-34.6037,-58.3816')).toContain(
        'openstreetmap.org'
      );
      process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'google';
      expect(buildMapViewUrl('-34.6037,-58.3816')).toContain('google.com');
    });

    test('quita output=embed de una URL de Google', () => {
      const url = buildMapViewUrl(
        'https://maps.google.com/maps?q=-34.6037,-58.3816&z=16&output=embed'
      );
      expect(url).toBe(
        'https://maps.google.com/maps?q=-34.6037%2C-58.3816&z=16'
      );
    });

    test('traduce /maps/embed?pb= de Google a la página de búsqueda con coordenadas', () => {
      const url = buildMapViewUrl(
        'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3393!2d-60.6544!3d-32.945!2m3!1f0!2f0!3f0'
      );
      expect(url).toContain('google.com/maps/search');
      expect(decodeURIComponent(url!)).toContain('query=-32.945,-60.6544');
    });

    test('usa el marcador !3d/!4d del pb cuando está presente', () => {
      const url = buildMapViewUrl(
        'https://www.google.com/maps/embed?pb=!4m2!3d-32.9468!4d-60.6393'
      );
      expect(decodeURIComponent(url!)).toContain('query=-32.9468,-60.6393');
    });

    test('usa la posición de cámara !2m2!1d/!2d del pb de Street View', () => {
      // Caso real de producción: "Insertar mapa" desde Street View genera un
      // pb sin `!3d!4d` ni `!2d!3d`; la posición viaja en `!2m2!1d<lat>!2d<lng>`.
      const url = buildMapViewUrl(
        'https://www.google.com/maps/embed?pb=!4v1791241199799!6m8!1m7!1s6eiCIEbZw5dQzx1HP0eEAQ!2m2!1d-28.50341559957752!2d-65.80645698359768!3f118.96815884151276!4f-4.145981633761721!5f0.7820865974627469'
      );
      expect(url).toContain('google.com/maps/search');
      expect(decodeURIComponent(url!)).toContain('query=-28.503416,-65.806457');
    });

    test('usa el texto de q cuando el embed de Google no trae coordenadas', () => {
      const url = buildMapViewUrl(
        'https://www.google.com/maps/embed/v1/place?key=k&q=Av.+Pellegrini+1234'
      );
      expect(url).toContain('google.com/maps/search');
      expect(decodeURIComponent(url!)).toContain('query=Av. Pellegrini 1234');
    });

    test('devuelve null para un embed de Google sin coordenadas ni q', () => {
      expect(
        buildMapViewUrl('https://www.google.com/maps/embed?pb=xxx')
      ).toBeNull();
    });

    test('traduce el embed de OSM a la página con mlat/mlon desde marker', () => {
      expect(
        buildMapViewUrl(
          'https://www.openstreetmap.org/export/embed.html?bbox=-60.65,-32.95,-60.63,-32.94&layer=mapnik&marker=-32.9468,-60.6393'
        )
      ).toBe(
        'https://www.openstreetmap.org/?mlat=-32.9468&mlon=-60.6393#map=18/-32.9468/-60.6393'
      );
    });

    test('traduce el embed de OSM sin marker al centro del bbox', () => {
      expect(
        buildMapViewUrl(
          'https://www.openstreetmap.org/export/embed.html?bbox=-60.65,-32.95,-60.63,-32.94&layer=mapnik'
        )
      ).toBe(
        'https://www.openstreetmap.org/?mlat=-32.945&mlon=-60.64#map=18/-32.945/-60.64'
      );
    });

    test('devuelve null para valores inválidos', () => {
      expect(buildMapViewUrl('no es una ubicación')).toBeNull();
      expect(buildMapViewUrl('javascript:alert(1)')).toBeNull();
      expect(buildMapViewUrl('')).toBeNull();
    });
  });
});
