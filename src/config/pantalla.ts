/**
 * Configuración de la pantalla publicitaria `/pantalla` (kiosk Smart TV).
 * Los tiempos se leen de variables de entorno con prefijo NEXT_PUBLIC_*
 * para que estén disponibles en el cliente.
 *
 * No acceder a la base de datos desde este archivo.
 */

const DEFAULT_PRODUCTO_MS = 6_000;
const DEFAULT_SUCURSAL_MS = 8_000;
const DEFAULT_QR_MS = 12_000;
const DEFAULT_REFETCH_INTERVAL_MS = 120_000;
const DEFAULT_VIDEO_MAX_MS = 120_000;
const DEFAULT_MAX_PRODUCTOS = 15;

const MIN_ESCENA_MS = 1_000;
const MIN_REFETCH_MS = 10_000;

function readDurationMs(
  raw: string | undefined,
  fallback: number,
  min: number
): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < min) return fallback;
  return Math.floor(parsed);
}

/**
 * Duración de cada escena de producto (foto + nombre + precio) en
 * milisegundos. `NEXT_PUBLIC_PANTALLA_PRODUCTO_MS`, por defecto 6000;
 * mínimo efectivo 1000.
 */
export function getPantallaProductoMs(): number {
  return readDurationMs(
    process.env.NEXT_PUBLIC_PANTALLA_PRODUCTO_MS,
    DEFAULT_PRODUCTO_MS,
    MIN_ESCENA_MS
  );
}

/**
 * Duración de la escena de horarios/datos de la sucursal en milisegundos.
 * `NEXT_PUBLIC_PANTALLA_SUCURSAL_MS`, por defecto 8000; mínimo 1000.
 */
export function getPantallaSucursalMs(): number {
  return readDurationMs(
    process.env.NEXT_PUBLIC_PANTALLA_SUCURSAL_MS,
    DEFAULT_SUCURSAL_MS,
    MIN_ESCENA_MS
  );
}

/**
 * Duración de la escena final con el QR hacia `/pedido` en milisegundos.
 * `NEXT_PUBLIC_PANTALLA_QR_MS`, por defecto 12000; mínimo 1000.
 */
export function getPantallaQrMs(): number {
  return readDurationMs(
    process.env.NEXT_PUBLIC_PANTALLA_QR_MS,
    DEFAULT_QR_MS,
    MIN_ESCENA_MS
  );
}

/**
 * Intervalo de refresco del snapshot (catálogo + playlist de videos +
 * estado de sucursal) en milisegundos. `NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS`,
 * por defecto 120000; mínimo 10000.
 */
export function getPantallaRefetchIntervalMs(): number {
  return readDurationMs(
    process.env.NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS,
    DEFAULT_REFETCH_INTERVAL_MS,
    MIN_REFETCH_MS
  );
}

/**
 * Tope de seguridad para una escena de video: si el elemento no dispara
 * `ended`/`error` en este tiempo (video colgado en buffering, stream roto),
 * la playlist avanza igual. Una vez conocida la metadata se reemplaza por
 * `duración + 5 s`. `NEXT_PUBLIC_PANTALLA_VIDEO_MAX_MS`, por defecto
 * 120000; mínimo 1000.
 */
export function getPantallaVideoMaxMs(): number {
  return readDurationMs(
    process.env.NEXT_PUBLIC_PANTALLA_VIDEO_MAX_MS,
    DEFAULT_VIDEO_MAX_MS,
    MIN_ESCENA_MS
  );
}

/**
 * Cantidad máxima de productos del catálogo que entran a la playlist por
 * ciclo (se toman los primeros según el orden de grupos: promos, bebidas,
 * extras). `NEXT_PUBLIC_PANTALLA_MAX_PRODUCTOS`, por defecto 15; mínimo 1.
 */
export function getPantallaMaxProductos(): number {
  const raw = process.env.NEXT_PUBLIC_PANTALLA_MAX_PRODUCTOS;
  if (!raw) return DEFAULT_MAX_PRODUCTOS;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_MAX_PRODUCTOS;

  return Math.floor(parsed);
}
