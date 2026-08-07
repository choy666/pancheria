/**
 * Registra errores en la consola solo en entornos que no sean producción.
 * Evita filtrar información sensible en los logs de Vercel.
 */
export function logError(message: string, error: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error(message, error);
  }
}
