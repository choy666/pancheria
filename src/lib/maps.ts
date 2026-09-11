import { getMapsProvider, getMapsBaseUrl, type MapProvider } from '@/config/maps';

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

export function tryBuildLocationUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const coordinates = tryParseCoordinates(trimmed);
  if (coordinates) {
    return buildMapCoordinatesUrl(coordinates.lat, coordinates.lng);
  }

  if (isValidLocationUrl(trimmed)) {
    return trimmed;
  }

  return null;
}


