'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { isDatabaseConnectionError } from '@/lib/db-errors';

function isMissingBranchError(error: Error): boolean {
  return (
    error.message.includes('sucursal asignada') ||
    error.message.includes('no tiene una sucursal')
  );
}

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
  const isBranchError = isMissingBranchError(error);

  let title = 'Algo salió mal';
  let message = 'Se produjo un error inesperado. Intentá recargar la página.';

  if (isDbError) {
    title = 'Error de conexión a la base de datos';
    message =
      'No se pudo conectar a la base de datos. Verificá que el servidor de PostgreSQL esté activo y que DATABASE_URL esté configurada correctamente.';
  } else if (isBranchError) {
    title = 'Sucursal requerida';
    message =
      'El usuario no tiene una sucursal asignada. Si sos administrador, ejecutá el seed (npx tsx src/db/seeds.ts) o asigná una sucursal manualmente. Si sos operador, contactá al administrador.';
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-muted-foreground">{message}</p>
      <Button onClick={reset} className="mt-6">
        Reintentar
      </Button>
    </div>
  );
}
