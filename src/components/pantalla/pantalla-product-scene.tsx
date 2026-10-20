'use client';

import { useState } from 'react';
import Image from 'next/image';
import { formatMoney } from '@/lib/money';
import { publicProductTypeLabels } from '@/lib/product-style';
import { cn } from '@/lib/utils';
import type { PublicCatalogProduct } from '@/application/services/catalogService';

interface PantallaProductSceneProps {
  product: PublicCatalogProduct;
}

function ProductHeroImage({ product }: { product: PublicCatalogProduct }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = product.imageUrl;
  const hasImage = Boolean(imageUrl) && failedUrl !== imageUrl;

  return (
    <>
      {/* Backdrop ambient: la misma foto difuminada llena el panel y da
          continuidad cromática detrás de la tarjeta, sin importar el
          aspect ratio de la foto. */}
      {hasImage && (
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <Image
            src={imageUrl!}
            alt=""
            fill
            className="scale-125 object-cover opacity-35 blur-3xl saturate-150"
            sizes="50vw"
            onError={() => setFailedUrl(imageUrl ?? null)}
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* Tarjeta 16:9 constante: coincide con el lienzo que publica el
          normalizador de imágenes del panel (1200×675) y con las cards del
          catálogo, así el producto llena lo mismo en todas las escenas. */}
      <div className="relative aspect-video max-h-[80%] w-full max-w-full overflow-hidden rounded-[2rem] bg-white shadow-[0_25px_80px_-15px_rgba(0,0,0,0.75)] ring-1 ring-white/20">
        {hasImage ? (
          <Image
            src={imageUrl!}
            alt={`Imagen de ${product.name}`}
            fill
            className="object-contain p-4 md:p-8"
            sizes="(max-width: 768px) 70vw, 40vw"
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
              className="flex size-40 items-center justify-center rounded-full bg-brand-red/10 font-heading text-8xl text-brand-red ring-4 ring-brand-red/30 select-none md:size-56 md:text-9xl"
            >
              {product.name.trim().charAt(0).toUpperCase() || 'P'}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Escena de producto estilo hero: foto grande a la izquierda y a la derecha
 * el badge de categoría, el nombre en display y el precio en mostaza. No se
 * muestran stock ni descuentos inventados: solo datos reales del catálogo.
 */
export function PantallaProductScene({ product }: PantallaProductSceneProps) {
  return (
    <div
      data-testid="pantalla-scene-product"
      data-product-id={product.id}
      className="relative flex h-full w-full flex-col overflow-hidden md:flex-row"
    >
      {/* Halos de marca sobre el fondo oscuro */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-1/3 size-[36rem] rounded-full bg-brand-red/20 blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-0 size-[28rem] rounded-full bg-brand-mustard/15 blur-[140px]"
      />

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6 md:p-12">
        <ProductHeroImage product={product} />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-start justify-center gap-4 p-6 md:gap-6 md:p-16">
        <span
          className={cn(
            'rounded-full border px-4 py-1.5 text-sm font-semibold tracking-widest uppercase md:text-base',
            product.type === 'compound'
              ? 'border-brand-mustard/60 bg-brand-mustard/15 text-brand-mustard'
              : 'border-white/20 bg-white/10 text-white/80'
          )}
        >
          {publicProductTypeLabels[product.type]}
        </span>

        <h2 className="font-heading text-4xl leading-tight tracking-wide text-white md:text-6xl lg:text-7xl">
          {product.name}
        </h2>

        {product.description && (
          <p className="max-w-xl text-base text-white/70 md:text-xl">
            {product.description}
          </p>
        )}

        <p className="font-heading text-5xl text-brand-mustard md:text-7xl lg:text-8xl">
          {formatMoney(product.price)}
        </p>
      </div>
    </div>
  );
}
