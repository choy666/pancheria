'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { isDatabaseConnectionError } from '@/lib/db-errors';

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDbError = isDatabaseConnectionError(error);

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">
        {isDbError ? 'Error de conexión a la base de datos' : 'Algo salió mal'}
      </h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        {isDbError
          ? 'No se pudo conectar a la base de datos. Verificá que el servidor de PostgreSQL esté activo y que DATABASE_URL esté configurada correctamente.'
          : 'Se produjo un error inesperado. Intentá recargar la página.'}
      </p>
      <Button onClick={reset} className="mt-6">
        Reintentar
      </Button>
    </div>
  );
}
