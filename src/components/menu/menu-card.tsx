'use client';

import { useState } from 'react';
import Image from 'next/image';
import { formatMoney } from '@/lib/money';
import type { PublicCatalogProduct } from '@/application/services/catalogService';

interface MenuCardProps {
  product: PublicCatalogProduct;
}

/**
 * Tarjeta del menú digital: foto sobre lienzo blanco (las imágenes del
 * catálogo se publican normalizadas a 16:9 con fondo blanco, el mismo
 * encuadre que usa la escena de producto de `/pantalla`), nombre y precio
 * en mostaza. Sin stock ni descuentos inventados: solo datos del catálogo.
 */
export function MenuCard({ product }: MenuCardProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = product.imageUrl;
  const hasImage = Boolean(imageUrl) && failedUrl !== imageUrl;

  return (
    <div
      data-testid="menu-card"
      data-product-id={product.id}
      className="flex min-h-0 flex-col gap-2 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10 md:p-3"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-white">
        {hasImage ? (
          <Image
            src={imageUrl!}
            alt={`Imagen de ${product.name}`}
            fill
            className="object-contain p-1.5 md:p-2"
            sizes="(max-width: 768px) 50vw, 25vw"
            onError={() => setFailedUrl(imageUrl ?? null)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            role="img"
            aria-label={`Imagen no disponible para ${product.name}`}
          >
            <span
              aria-hidden="true"
              className="flex size-16 items-center justify-center rounded-full bg-brand-red/10 font-heading text-4xl text-brand-red ring-4 ring-brand-red/30 select-none md:size-20 md:text-5xl"
            >
              {product.name.trim().charAt(0).toUpperCase() || 'P'}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5 px-1 pb-1">
        <h3 className="truncate font-heading text-lg leading-tight tracking-wide text-white md:text-2xl">
          {product.name}
        </h3>
        <p className="font-heading text-xl text-brand-mustard md:text-3xl">
          {formatMoney(product.price)}
        </p>
      </div>
    </div>
  );
}
