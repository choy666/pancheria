import { useEffect, useState } from 'react';
import { BrandAnnouncement } from '@/components/publico/brand-announcement';
import { PublicFooter } from '@/components/publico/public-footer';
import { PublicHeader } from '@/components/publico/public-header';
import type { Branch, BrandSettings } from '@/domain/types';

interface BrandPreviewProps {
  brand: BrandSettings;
  branch: Branch | null;
}

/**
 * Vista previa en vivo de la página de pedido con los datos del formulario.
 * Reutiliza las mismas piezas públicas que ve el cliente, con los contactos y
 * horarios de la sucursal activa. No incluye el enlace al chat ni la barra
 * fija del carrito, que dependen del dispositivo del cliente.
 */
export function BrandPreview({ brand, branch }: BrandPreviewProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  return (
    <section aria-labelledby="brand-preview-title" className="space-y-3">
      <div className="space-y-1">
        <h2 id="brand-preview-title" className="text-lg font-semibold tracking-tight">
          Vista previa para el cliente
        </h2>
        <p className="text-sm text-muted-foreground">
          Así se ve la página de pedido de {branch?.name ?? 'la sucursal activa'}.
          Los cambios llegan a los clientes al guardar.
        </p>
      </div>

      <div
        data-testid="brand-preview"
        data-theme="light"
        inert
        className="overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-sm"
      >
        <PublicHeader
          brand={brand}
          branchId={branch?.id ?? null}
          branchName={branch?.name ?? null}
          showChat={false}
          embedded
        />
        {brand.announcementEnabled && brand.announcementText && (
          <div className="p-3">
            <BrandAnnouncement
              text={brand.announcementText}
              variant={brand.announcementVariant}
            />
          </div>
        )}
        {mounted && <PublicFooter brand={brand} branch={branch} embedded />}
      </div>
    </section>
  );
}
