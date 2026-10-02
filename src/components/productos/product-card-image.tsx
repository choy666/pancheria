'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ProductImageFallbackProps {
  productName: string;
}

/**
 * Fallback de marca para productos sin imagen. El contenedor del hero pinta
 * el diagonal rojo→mostaza; acá solo va el monograma del producto.
 */
function ProductImageFallback({ productName }: ProductImageFallbackProps) {
  const initial = productName.trim().charAt(0).toUpperCase() || 'P';

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      role="img"
      aria-label={`Imagen no disponible para ${productName}`}
    >
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-full bg-white/25 font-heading text-4xl text-white ring-2 ring-white/50 backdrop-blur-xs select-none"
      >
        {initial}
      </span>
    </div>
  );
}

interface ProductImageProps {
  imageUrl: string;
  productName: string;
  priority: boolean;
}

function ProductImage({ imageUrl, productName, priority }: ProductImageProps) {
  // Se guarda la URL que falló (en lugar de un booleano) para que el estado de
  // error se reinicie solo cuando cambia la imagen, sin forzar un remount.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  if (failedUrl === imageUrl) {
    return <ProductImageFallback productName={productName} />;
  }

  const loaded = loadedUrl === imageUrl;

  return (
    <>
      {!loaded && (
        <Skeleton
          className="absolute inset-0 rounded-none bg-white/25"
          aria-hidden="true"
        />
      )}
      <Image
        src={imageUrl}
        alt={`Imagen de ${productName}`}
        fill
        className={cn(
          'object-cover transition duration-300 group-hover/card:scale-105',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        loading={priority ? undefined : 'lazy'}
        priority={priority}
        onLoad={() => setLoadedUrl(imageUrl)}
        onError={() => setFailedUrl(imageUrl)}
      />
    </>
  );
}

interface ProductCardImageProps {
  imageUrl: string | null | undefined;
  productName: string;
  /**
   * `priority` solo para la primera fila del catálogo (LCP); el grid se la
   * pasa porque la card no conoce su posición.
   */
  priority?: boolean;
}

export function ProductCardImage({ imageUrl, productName, priority = false }: ProductCardImageProps) {
  if (!imageUrl) {
    return <ProductImageFallback productName={productName} />;
  }

  return <ProductImage imageUrl={imageUrl} productName={productName} priority={priority} />;
}
