import { ReactNode } from 'react';
import type { Metadata } from 'next';
import * as brandService from '@/application/services/brandService';
import { getBrandDisplayName } from '@/lib/brand-helpers';

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandService.getBrand();
  return {
    title: `Pantalla publicitaria - ${getBrandDisplayName(brand)}`,
    description: 'Pantalla publicitaria para Smart TV: videos, catálogo y QR de pedidos en bucle.',
  };
}

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
