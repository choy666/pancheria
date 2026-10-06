import {
  getMapsProvider,
  getMapsBaseUrl,
  getMapsFrameOrigins,
  type MapProvider,
} from '@/config/maps';

interface MapTemplate {
  baseUrl: string;
  coordinatesPath: string;
  searchPath: string;
  isProviderUrl: (url: string) => boolean;
}

function safeUrl(value: string): string {
  return encodeURIComponent(value);
}

function roundCoordinate(value: number, decimals = 6): number {
  return Number(value.toFixed(decimals));
}

function replacePlaceholders(
  template: string,
  values: { lat: number; lng: number; query: string }
): string {
  return template
    .replace(/\{lat\}/g, String(values.lat))
    .replace(/\{lng\}/g, String(values.lng))
    .replace(/\{query\}/g, safeUrl(values.query))
    .replace(/\{lat_encoded\}/g, safeUrl(String(values.lat)))
    .replace(/\{lng_encoded\}/g, safeUrl(String(values.lng)));
}

function buildUrl(
  provider: MapProvider,
  pathTemplate: string,
  values: { lat: number; lng: number; query: string }
): string {
  const base = getMapsBaseUrl() ?? TEMPLATES[provider].baseUrl;
  const path = replacePlaceholders(pathTemplate, values);
  return `${base}${path}`;
}

function isSameHost(url: string, hostSuffix: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === hostSuffix || hostname.endsWith(`.${hostSuffix}`);
  } catch {
    return false;
  }
}

/**
 * Plantillas por defecto para servicios de mapas públicos.
 * Estos dominios son de servicios públicos y pueden sobrescribirse
 * mediante NEXT_PUBLIC_MAPS_BASE_URL sin modificar el código.
 */
const TEMPLATES: Record<MapProvider, MapTemplate> = {
  openstreetmap: {
    baseUrl: 'https://www.openstreetmap.org',
    coordinatesPath: '/?mlat={lat}&mlon={lng}#map=18/{lat}/{lng}',
    searchPath: '/search?query={query}',
    isProviderUrl: (url) => isSameHost(url, 'openstreetmap.org'),
  },
  google: {
    baseUrl: 'https://www.google.com/maps',
    coordinatesPath: '/search/?api=1&query={lat},{lng}',
    searchPath: '/search/?api=1&query={query}',
    isProviderUrl: (url) =>
      isSameHost(url, 'google.com') ||
      isSameHost(url, 'maps.app.goo.gl'),
  },
  waze: {
    baseUrl: 'https://waze.com',
    coordinatesPath: '/ul?ll={lat},{lng}&navigate=yes',
    searchPath: '/ul?q={query}&navigate=yes',
    isProviderUrl: (url) => isSameHost(url, 'waze.com'),
  },
  raw: {
    baseUrl: 'https://www.openstreetmap.org',
    coordinatesPath: '/?mlat={lat}&mlon={lng}',
    searchPath: '/search?query={query}',
    isProviderUrl: () => false,
  },
};

export function buildMapCoordinatesUrl(lat: number, lng: number): string {
  if (Number.isNaN(lat) || lat < -90 || lat > 90) {
    throw new RangeError('La latitud debe estar entre -90 y 90.');
  }
  if (Number.isNaN(lng) || lng < -180 || lng > 180) {
    throw new RangeError('La longitud debe estar entre -180 y 180.');
  }

  const provider = getMapsProvider();
  const safeLat = roundCoordinate(lat);
  const safeLng = roundCoordinate(lng);
  return buildUrl(provider, TEMPLATES[provider].coordinatesPath, {
    lat: safeLat,
    lng: safeLng,
    query: '',
  });
}

export function buildMapSearchUrl(query: string): string {
  const provider = getMapsProvider();
  const trimmed = query.trim();
  if (!trimmed) {
    return '';
  }
  return buildUrl(provider, TEMPLATES[provider].searchPath, {
    lat: 0,
    lng: 0,
    query: trimmed,
  });
}

export function isKnownMapUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;

  const providers = Object.values(TEMPLATES);
  return providers.some((template) => template.isProviderUrl(trimmed));
}

function tryParseCoordinates(value: string): { lat: number; lng: number } | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^\s*(-?\d+(?:\.\d+)?)\s*[;,]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  return { lat, lng };
}

export function isValidLocationUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    return true;
  } catch {
    return tryParseCoordinates(trimmed) !== null;
  }
}

/**
 * Extrae el `src` de una etiqueta `<iframe>` pegada como ubicación (p. ej.
 * el código de "Insertar un mapa" de Google Maps). La regex está anclada al
 * tag —`[^>]*?` no puede cruzar el `>` de cierre y `\b` evita confundir
 * `srcdoc=` con `src=`— y tolera comillas simples/dobles, `src` sin comillas,
 * atributos en cualquier orden y mayúsculas (`SRC=`).
 *
 * La extracción falla cerrado: el valor capturado se devuelve decodificado
 * (`&amp;` → `&`) y el llamador lo sigue validando como URL http(s), así que
 * un `src` inesperado nunca produce una ubicación aceptada. Cualquier otro
 * HTML se rechaza: solo se lee el atributo, nunca se renderiza el HTML.
 */
function extractIframeSrc(input: string): string | null {
  const match = input.match(
    /<iframe\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
  );
  const src = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!src) return null;
  return src.replace(/&amp;/g, '&');
}

export function tryBuildLocationUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Si el admin pegó el HTML completo del iframe, el `src` extraído reemplaza
  // al input y continúa por el pipeline normal (coordenadas o URL http(s)).
  const effective = extractIframeSrc(trimmed) ?? trimmed;

  const coordinates = tryParseCoordinates(effective);
  if (coordinates) {
    return buildMapCoordinatesUrl(coordinates.lat, coordinates.lng);
  }

  if (isValidLocationUrl(effective)) {
    return effective;
  }

  return null;
}

/* ------------------------------------------------------------------------ */
/* Mapa embebido (iframe)                                                    */
/* ------------------------------------------------------------------------ */

interface MapEmbedTemplate {
  /** Base sobre la que se construye la URL embebible del proveedor. */
  baseUrl: string;
  buildCoordinatesEmbed: (base: string, lat: number, lng: number) => string;
}

/** Orígenes canónicos sobre los que se construyen los embeds de cada
 * proveedor. Se usan siempre estos (y no el origen de la URL pegada) para
 * que los dominios regionales de Google (`google.com.ar`, `google.co.uk`…)
 * produzcan embeds en un origen cubierto por `getMapsFrameOrigins()`. */
const GOOGLE_EMBED_BASE = 'https://maps.google.com';
const OSM_EMBED_BASE = 'https://www.openstreetmap.org';

/** Semiancho del bbox del embed de OSM (≈ zoom 17). */
const OSM_EMBED_BBOX_DELTA = 0.005;

function buildGoogleEmbed(base: string, lat: number, lng: number): string {
  return `${base}/maps?q=${lat},${lng}&z=16&output=embed`;
}

function buildOsmEmbed(base: string, lat: number, lng: number): string {
  const west = roundCoordinate(lng - OSM_EMBED_BBOX_DELTA);
  const south = roundCoordinate(lat - OSM_EMBED_BBOX_DELTA);
  const east = roundCoordinate(lng + OSM_EMBED_BBOX_DELTA);
  const north = roundCoordinate(lat + OSM_EMBED_BBOX_DELTA);
  return `${base}/export/embed.html?bbox=${west},${south},${east},${north}&layer=mapnik&marker=${lat},${lng}`;
}

/**
 * Plantillas de iframe por proveedor. Los proveedores sin embed público
 * (Waze) no figuran: sus ubicaciones se muestran solo como enlace.
 * Una `NEXT_PUBLIC_MAPS_BASE_URL` personalizada reemplaza a `baseUrl`
 * (debe exponer la ruta de embed del proveedor, p. ej. una instancia
 * propia de OpenStreetMap).
 */
const EMBED_TEMPLATES: Partial<Record<MapProvider, MapEmbedTemplate>> = {
  openstreetmap: {
    baseUrl: OSM_EMBED_BASE,
    buildCoordinatesEmbed: buildOsmEmbed,
  },
  google: {
    baseUrl: GOOGLE_EMBED_BASE,
    buildCoordinatesEmbed: buildGoogleEmbed,
  },
  raw: {
    baseUrl: OSM_EMBED_BASE,
    buildCoordinatesEmbed: buildOsmEmbed,
  },
};

function isAllowedEmbedOrigin(origin: string): boolean {
  return getMapsFrameOrigins().includes(origin);
}

/**
 * Hosts de Google Maps con soporte de embed: `google.<tld>` con subdominios
 * opcionales, incluidos los dominios regionales (`google.com.ar`,
 * `maps.google.co.uk`). Los short links (`maps.app.goo.gl`, `goo.gl`) no
 * matchean: no sirven contenido embebible ni exponen coordenadas.
 */
function isGoogleMapsHost(url: URL): boolean {
  return /(^|\.)google\.[a-z]{2,63}(\.[a-z]{2,63})?$/i.test(url.hostname);
}

/** Detecta URLs pensadas para iframe (path `…embed…` u `output=embed`). */
function isEmbedPageUrl(url: URL): boolean {
  return (
    url.pathname.toLowerCase().includes('embed') ||
    url.searchParams.get('output') === 'embed'
  );
}

function coordinatesFromParams(
  url: URL,
  latParam: string,
  lngParam: string
): { lat: number; lng: number } | null {
  const latRaw = url.searchParams.get(latParam);
  const lngRaw = url.searchParams.get(lngParam);
  if (latRaw === null || lngRaw === null) return null;
  return tryParseCoordinates(`${latRaw},${lngRaw}`);
}

/**
 * Extrae coordenadas de una URL de mapa conocida: `mlat`/`mlon` y el
 * fragmento `#map=zoom/lat/lng` de OpenStreetMap, el patrón `/@lat,lng` del
 * path de las URLs de Google (`/maps/place/.../@-32.94,-60.63,17z/` y
 * `/maps/@...`, el enlace común de "Compartir"), el parámetro `pb` de los
 * embeds de Google y los parámetros `lat,lng` que usan las URLs de búsqueda
 * y de embed (`query`, `q`, `marker`, `center`, `ll`).
 */
function coordinatesFromMapUrl(url: URL): { lat: number; lng: number } | null {
  const fromMarker = coordinatesFromParams(url, 'mlat', 'mlon');
  if (fromMarker) return fromMarker;

  const hashMatch = url.hash.match(
    /^#map=\d+(?:\.\d+)?\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/
  );
  if (hashMatch) {
    const fromHash = tryParseCoordinates(`${hashMatch[1]},${hashMatch[2]}`);
    if (fromHash) return fromHash;
  }

  const atMatch = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const fromPath = tryParseCoordinates(`${atMatch[1]},${atMatch[2]}`);
    if (fromPath) return fromPath;
  }

  // El `pb` de los embeds de Google: `!3d<lat>!4d<lng>` marca el lugar y
  // `!2d<lng>!3d<lat>` el centro del viewport (presente en todos los pb).
  const pb = url.searchParams.get('pb');
  if (pb) {
    const markerMatch = pb.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (markerMatch) {
      const fromPbMarker = tryParseCoordinates(
        `${markerMatch[1]},${markerMatch[2]}`
      );
      if (fromPbMarker) return fromPbMarker;
    }
    const centerMatch = pb.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
    if (centerMatch) {
      const fromPbCenter = tryParseCoordinates(
        `${centerMatch[2]},${centerMatch[1]}`
      );
      if (fromPbCenter) return fromPbCenter;
    }
  }

  for (const param of ['query', 'q', 'marker', 'center', 'll']) {
    const value = url.searchParams.get(param);
    if (value) {
      const fromParam = tryParseCoordinates(value);
      if (fromParam) return fromParam;
    }
  }

  return null;
}

/** Centro del `bbox=oeste,sur,este,norte` de los embeds de OSM. */
function coordinatesFromOsmBBox(
  url: URL
): { lat: number; lng: number } | null {
  const bbox = url.searchParams.get('bbox');
  if (!bbox) return null;
  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return null;
  const [west, south, east, north] = parts;
  return tryParseCoordinates(
    `${(south + north) / 2},${(west + east) / 2}`
  );
}

interface EmbedBuilder {
  /** Construye la URL embebible del proveedor para `lat,lng`. */
  build: (base: string, lat: number, lng: number) => string;
  /** Origen base sobre el que se construye el embed. */
  base: string;
}

/**
 * Elige cómo embeber una URL de mapa según su host: las URLs de Google se
 * traducen al embed de Google y las de OpenStreetMap al de OSM, ambas sobre
 * el origen canónico del proveedor (así un `google.com.ar` —que no está en
 * `frame-src`— termina en un embed permitido). Un origen permitido sin
 * proveedor propio (p. ej. el de `NEXT_PUBLIC_MAPS_BASE_URL`) usa el embed
 * del proveedor configurado sobre ese mismo origen.
 */
function embedBuilderForUrl(parsed: URL): EmbedBuilder | null {
  if (isGoogleMapsHost(parsed)) {
    return { build: buildGoogleEmbed, base: GOOGLE_EMBED_BASE };
  }
  if (isSameHost(parsed.href, 'openstreetmap.org')) {
    return { build: buildOsmEmbed, base: OSM_EMBED_BASE };
  }
  const configured = EMBED_TEMPLATES[getMapsProvider()];
  if (!configured || !isAllowedEmbedOrigin(parsed.origin)) return null;
  return { build: configured.buildCoordinatesEmbed, base: parsed.origin };
}

/**
 * Devuelve la URL embebible (iframe) para `location`, o `null` cuando debe
 * mostrarse el enlace externo. Solo devuelve URLs cuyo origen está en
 * `getMapsFrameOrigins()`, para que la CSP (`frame-src`) siempre lo permita.
 *
 * Casos:
 * - Coordenadas `lat,lng` → embed del proveedor configurado.
 * - URL ya embebible (`/export/embed.html`, `/maps/embed`, `output=embed`)
 *   en un origen permitido → se devuelve tal cual, sea cual sea el
 *   proveedor configurado.
 * - URL de mapa con coordenadas (`mlat`/`mlon`, `#map=`, `/@lat,lng`,
 *   `pb`, `query`/`q`/`marker`/`center`/`ll`) de un proveedor con embed →
 *   se traduce al embed de ese mismo proveedor sobre su origen canónico.
 *   Así el iframe pegado de "Insertar un mapa" de Google funciona aunque
 *   `NEXT_PUBLIC_MAPS_PROVIDER` sea otro.
 * - Short links (`maps.app.goo.gl`, `goo.gl/maps`), Waze y cualquier otro
 *   origen → `null`.
 */
export function buildMapEmbedUrl(location: string): string | null {
  const trimmed = location.trim();
  if (!trimmed) return null;

  const embedTemplate = EMBED_TEMPLATES[getMapsProvider()];

  const coordinates = tryParseCoordinates(trimmed);
  if (coordinates) {
    if (!embedTemplate) return null;
    const base = getMapsBaseUrl() ?? embedTemplate.baseUrl;
    const embedUrl = embedTemplate.buildCoordinatesEmbed(
      base,
      roundCoordinate(coordinates.lat),
      roundCoordinate(coordinates.lng)
    );
    try {
      return isAllowedEmbedOrigin(new URL(embedUrl).origin) ? embedUrl : null;
    } catch {
      return null;
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  if (isEmbedPageUrl(parsed) && isAllowedEmbedOrigin(parsed.origin)) {
    return trimmed;
  }

  const urlCoordinates = coordinatesFromMapUrl(parsed);
  if (!urlCoordinates) return null;

  const builder = embedBuilderForUrl(parsed);
  if (!builder) return null;

  const embedUrl = builder.build(
    builder.base,
    roundCoordinate(urlCoordinates.lat),
    roundCoordinate(urlCoordinates.lng)
  );
  try {
    return isAllowedEmbedOrigin(new URL(embedUrl).origin) ? embedUrl : null;
  } catch {
    return null;
  }
}

/**
 * Devuelve la URL para abrir la ubicación en una pestaña nueva, o `null`
 * cuando no puede derivarse una página útil.
 *
 * Las URLs de embed (`/maps/embed?pb=…`, `/export/embed.html?…`,
 * `output=embed`) solo funcionan dentro de un iframe: abiertas en una
 * pestaña, Google responde "The Google Maps Embed API must be used in an
 * iframe". Acá se traducen a la página de mapa equivalente:
 * - `output=embed` → se quita el parámetro y queda la página normal.
 * - `/maps/embed…` de Google → `maps/search/?api=1&query=…` con las
 *   coordenadas extraídas del `pb`/`q`/`center`, o con el texto de `q`.
 * - `/export/embed.html` de OSM → `/?mlat&mlon` desde `marker`, o `#map`
 *   con el centro del `bbox`.
 * Cualquier otra URL (página de mapa normal, short link) se devuelve tal
 * cual.
 */
export function buildMapViewUrl(location: string): string | null {
  const trimmed = location.trim();
  if (!trimmed) return null;

  const coordinates = tryParseCoordinates(trimmed);
  if (coordinates) {
    return buildMapCoordinatesUrl(coordinates.lat, coordinates.lng);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  if (parsed.searchParams.get('output') === 'embed') {
    const pageUrl = new URL(trimmed);
    pageUrl.searchParams.delete('output');
    return pageUrl.toString();
  }

  if (!parsed.pathname.toLowerCase().includes('embed')) {
    return trimmed;
  }

  if (isGoogleMapsHost(parsed)) {
    const urlCoordinates = coordinatesFromMapUrl(parsed);
    const query = urlCoordinates
      ? `${roundCoordinate(urlCoordinates.lat)},${roundCoordinate(urlCoordinates.lng)}`
      : parsed.searchParams.get('q')?.trim();
    if (!query) return null;
    return `https://www.google.com/maps/search/?api=1&query=${safeUrl(query)}`;
  }

  if (isSameHost(parsed.href, 'openstreetmap.org')) {
    const urlCoordinates =
      coordinatesFromMapUrl(parsed) ?? coordinatesFromOsmBBox(parsed);
    if (!urlCoordinates) return null;
    const lat = roundCoordinate(urlCoordinates.lat);
    const lng = roundCoordinate(urlCoordinates.lng);
    return `${OSM_EMBED_BASE}/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
  }

  // Embed de un proveedor desconocido: se abre la misma URL que cargó el
  // admin (no hay una traducción fiable a página de mapa).
  return trimmed;
}

/* ------------------------------------------------------------------------ */
/* Estado de la ubicación para la UI                                         */
/* ------------------------------------------------------------------------ */

type LocationInputStatus = 'empty' | 'invalid' | 'link' | 'embed';

export interface LocationInputDescription {
  status: LocationInputStatus;
  /** URL embebible lista para el iframe; solo presente cuando status es `embed`. */
  embedUrl?: string;
}

/**
 * Clasifica el input del campo Ubicación del formulario de sucursal para que
 * la UI muestre feedback en vivo sin reimplementar el pipeline:
 *
 * - `empty`: el campo está vacío (se guarda `null`, sin error).
 * - `invalid`: no parsea como coordenadas, URL http(s) ni iframe con `src`.
 * - `embed`: es válida y `buildMapEmbedUrl` puede mostrarla como mapa.
 * - `link`: es válida pero no embebible (short links, otros orígenes o un
 *   proveedor sin embed): en el catálogo se muestra como enlace "Ver en mapa".
 *
 * Normaliza primero con `tryBuildLocationUrl` (que extrae el `src` de un
 * `<iframe>` pegado) y clasifica sobre la URL resultante, nunca sobre el
 * input crudo.
 */
export function describeLocationInput(
  input: string
): LocationInputDescription {
  const normalized = tryBuildLocationUrl(input);
  if (!normalized) {
    return { status: input.trim() ? 'invalid' : 'empty' };
  }

  const embedUrl = buildMapEmbedUrl(normalized);
  if (embedUrl) return { status: 'embed', embedUrl };

  return { status: 'link' };
}


