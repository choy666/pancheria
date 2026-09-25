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

/** Semiancho del bbox del embed de OSM (≈ zoom 17). */
const OSM_EMBED_BBOX_DELTA = 0.005;

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
    baseUrl: 'https://www.openstreetmap.org',
    buildCoordinatesEmbed: buildOsmEmbed,
  },
  google: {
    baseUrl: 'https://maps.google.com',
    buildCoordinatesEmbed: (base, lat, lng) =>
      `${base}/maps?q=${lat},${lng}&z=16&output=embed`,
  },
  raw: {
    baseUrl: 'https://www.openstreetmap.org',
    buildCoordinatesEmbed: buildOsmEmbed,
  },
};

function isAllowedEmbedOrigin(origin: string): boolean {
  return getMapsFrameOrigins().includes(origin);
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
 * `/maps/@...`, el enlace común de "Compartir") y el parámetro `query` con
 * `lat,lng` que genera `buildMapCoordinatesUrl` para Google.
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

  const query = url.searchParams.get('query');
  if (query) return tryParseCoordinates(query);

  return null;
}

/**
 * Devuelve la URL embebible (iframe) para `location`, o `null` cuando debe
 * mostrarse el enlace externo. Solo devuelve URLs cuyo origen está en
 * `getMapsFrameOrigins()`, para que la CSP (`frame-src`) siempre lo permita.
 *
 * Casos:
 * - Coordenadas `lat,lng` → embed del proveedor configurado.
 * - URL ya embebible (`/export/embed.html`, `/maps/embed`, `output=embed`)
 *   en un origen permitido → se devuelve tal cual.
 * - URL de mapa con coordenadas (`mlat`/`mlon`, `#map=`, `query=lat,lng`)
 *   en un origen permitido → se traduce al embed del mismo origen.
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
  if (!isAllowedEmbedOrigin(parsed.origin)) return null;

  // URL ya embebible: `/export/embed.html` (OSM), `/maps/embed*` u
  // `output=embed` (Google).
  if (
    parsed.pathname.toLowerCase().includes('embed') ||
    parsed.searchParams.get('output') === 'embed'
  ) {
    return trimmed;
  }

  if (!embedTemplate) return null;

  const urlCoordinates = coordinatesFromMapUrl(parsed);
  if (!urlCoordinates) return null;

  return embedTemplate.buildCoordinatesEmbed(
    parsed.origin,
    roundCoordinate(urlCoordinates.lat),
    roundCoordinate(urlCoordinates.lng)
  );
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


