/**
 * Configuración de analytics. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function isVercelAnalyticsEnabled(): boolean {
  return (
    String(process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS).trim() === 'true'
  );
}
