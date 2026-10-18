import { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pantalla publicitaria - Panchería',
  description: 'Pantalla publicitaria para Smart TV: videos, catálogo y QR de pedidos en bucle.',
};

/**
 * Layout del modo kiosk (`/pantalla`): sin header/footer de `(public)` ni
 * chrome del panel. `data-theme="screen"` aplica las tipografías de marca
 * (Anton/Poppins) sobre la paleta oscura de `:root`.
 */
export default function KioskLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-theme="screen"
      className="h-dvh w-full overflow-hidden bg-background text-foreground"
    >
      {children}
    </div>
  );
}
