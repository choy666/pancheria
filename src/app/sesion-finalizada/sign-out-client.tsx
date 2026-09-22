'use client';

import { useEffect } from 'react';
import { routes } from '@/config/routes';

/**
 * Invoca la server action de cierre de sesión apenas monta; la action
 * redirige al login con `error=branch_removed`. El fallback visible solo
 * se alcanza si el redirect tarda o falla.
 */
export function SignOutClient({ action }: { action: () => Promise<void> }) {
  useEffect(() => {
    // La action redirige con NEXT_REDIRECT; si la promesa rechaza sin
    // completar la navegación (respuesta inesperada del servidor), se
    // fuerza el mismo destino desde el cliente para no dejar al usuario
    // colgado en la pantalla intermedia.
    action().catch(() => {
      window.location.assign(`${routes.login}?error=branch_removed`);
    });
  }, [action]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <p role="status" className="text-base text-muted-foreground">
        Tu sucursal fue eliminada. Cerrando sesión…
      </p>
    </div>
  );
}
