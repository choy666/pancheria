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
 * que usa la escena de producto de `/pantalla`). La tarjeta reparte su
 * alto en proporción fija ~7/3 (`flex-[7]`/`flex-[3]` con `min-h-0` en
 * ambos): la foto domina la tarjeta y nunca queda aplastada por un bloque
 * de texto alto. La descripción opcional viaja como caption dentro del
 * lienzo (chip blanco translúcido en el borde inferior, sobre el aire que
 * deja el normalizador), así no le come alto a la foto. En la zona oscura
 * quedan solo nombre y precio compartiendo línea (precio en mostaza a la
 * derecha, como en una carta); si la zona no alcanza, `overflow-hidden`
 * recorta el texto y no la foto. En estilo `compact` la imagen pasa a un
 * lateral y el texto va a la derecha con su descripción propia. Sin stock
 * ni descuentos inventados: solo datos del catálogo.
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
          'relative min-h-0 overflow-hidden rounded-xl bg-white shadow-lg shadow-black/25',
          isCompact ? 'w-24 shrink-0 self-stretch md:w-36' : 'flex-[7]'
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
        {!isCompact && showDescription && product.description && (
          <p
            className={cn(
              'absolute inset-x-2 bottom-1 line-clamp-1 rounded-md bg-white/85 px-2 py-0.5 text-center leading-tight text-neutral-600 backdrop-blur-[2px]',
              DESCRIPTION_FONT[fontScale]
            )}
          >
            {product.description}
          </p>
        )}
      </div>

      <div
        className={cn(
          'flex min-h-0 flex-col gap-0.5 px-1 pb-1',
          isCompact
            ? 'min-w-0 flex-1 justify-center'
            : 'flex-[3] justify-center overflow-hidden'
        )}
      >
        {isCompact ? (
          <>
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
          </>
        ) : (
          <div className="flex items-baseline gap-2">
            <h3
              className={cn(
                'min-w-0 flex-1 line-clamp-2 font-heading leading-tight tracking-wide text-white',
                NAME_FONT[fontScale]
              )}
            >
              {product.name}
            </h3>
            <p
              className={cn(
                'shrink-0 font-heading text-brand-mustard',
                PRICE_FONT[fontScale]
              )}
            >
              {formatMoney(product.price)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
