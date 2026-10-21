'use client';

import { useState } from 'react';
import Image from 'next/image';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { MenuCardStyle, MenuFontScale } from '@/domain/types';

interface MenuCardProps {
  product: PublicCatalogProduct;
  /** Columnas de la grilla en landscape: solo ajusta el `sizes` de la imagen. */
  columnas: number;
  fontScale: MenuFontScale;
  cardStyle: MenuCardStyle;
  /** Renderiza `product.description` cuando existe y está habilitada. */
  showDescription: boolean;
  /** Destacado de la curaduría: borde mostaza + marca "Recomendado". */
  featured: boolean;
}

// Clases estáticas por escala tipográfica (Tailwind no admite interpolación).
const NAME_FONT: Record<MenuFontScale, string> = {
  normal: 'text-lg md:text-3xl',
  large: 'text-2xl md:text-4xl',
};

const PRICE_FONT: Record<MenuFontScale, string> = {
  normal: 'text-xl md:text-4xl',
  large: 'text-3xl md:text-5xl',
};

const DESCRIPTION_FONT: Record<MenuFontScale, string> = {
  normal: 'text-xs md:text-sm',
  large: 'text-sm md:text-base',
};

/**
 * Tarjeta del menú digital: foto sobre lienzo blanco (las imágenes del
 * catálogo se publican normalizadas a 16:9 con fondo blanco y su propio
 * aire — por eso la imagen no lleva padding interno —, el mismo encuadre
 * que usa la escena de producto de `/pantalla`), nombre en dos líneas,
 * descripción opcional y precio en mostaza. En estilo `compact` la imagen
 * pasa a un lateral chico y el texto va a la derecha. Sin stock ni
 * descuentos inventados: solo datos del catálogo.
 */
export function MenuCard({
  product,
  columnas,
  fontScale,
  cardStyle,
  showDescription,
  featured,
}: MenuCardProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = product.imageUrl;
  const hasImage = Boolean(imageUrl) && failedUrl !== imageUrl;
  const isCompact = cardStyle === 'compact';

  return (
    <div
      data-testid="menu-card"
      data-product-id={product.id}
      className={cn(
        'relative flex min-h-0 gap-2 rounded-2xl bg-white/5 p-2 md:p-3',
        isCompact ? 'flex-row' : 'flex-col',
        featured ? 'ring-2 ring-brand-mustard' : 'ring-1 ring-white/10'
      )}
    >
      {featured && (
        <span
          data-testid="menu-card-featured"
          className="absolute -top-2 left-3 z-10 rounded-full bg-brand-mustard px-2.5 py-0.5 font-heading text-[10px] uppercase tracking-widest text-black md:text-xs"
        >
          Recomendado
        </span>
      )}

      <div
        className={cn(
          'relative min-h-0 overflow-hidden rounded-xl bg-white',
          isCompact ? 'w-20 shrink-0 self-stretch md:w-28' : 'flex-1'
        )}
      >
        {hasImage ? (
          <Image
            src={imageUrl!}
            alt={`Imagen de ${product.name}`}
            fill
            className="object-contain"
            sizes={`(max-width: 768px) 50vw, ${Math.round(100 / columnas)}vw`}
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

      <div
        className={cn(
          'flex flex-col gap-0.5 px-1 pb-1',
          isCompact && 'min-w-0 flex-1 justify-center'
        )}
      >
        <h3
          className={cn(
            'line-clamp-2 font-heading leading-tight tracking-wide text-white',
            NAME_FONT[fontScale]
          )}
        >
          {product.name}
        </h3>
        {showDescription && product.description && (
          <p
            className={cn(
              'line-clamp-2 leading-snug text-white/70',
              DESCRIPTION_FONT[fontScale]
            )}
          >
            {product.description}
          </p>
        )}
        <p
          className={cn(
            'font-heading text-brand-mustard',
            PRICE_FONT[fontScale]
          )}
        >
          {formatMoney(product.price)}
        </p>
      </div>
    </div>
  );
}
