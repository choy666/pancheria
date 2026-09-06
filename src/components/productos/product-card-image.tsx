'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';

interface ProductImageProps {
  imageUrl: string;
  productName: string;
}

function ProductImage({ imageUrl, productName }: ProductImageProps) {
  // Se guarda la URL que falló (en lugar de un booleano) para que el estado de
  // error se reinicie solo cuando cambia la imagen, sin forzar un remount.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (failedUrl === imageUrl) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-muted-foreground"
        role="img"
        aria-label={`Imagen no disponible para ${productName}`}
      >
        <ImageOff className="h-10 w-10" />
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={`Imagen de ${productName}`}
      fill
      className="object-cover"
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      loading="lazy"
      priority={false}
      onError={() => setFailedUrl(imageUrl)}
    />
  );
}

interface ProductCardImageProps {
  imageUrl: string | null | undefined;
  productName: string;
}

export function ProductCardImage({ imageUrl, productName }: ProductCardImageProps) {
  if (!imageUrl) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-muted-foreground"
        role="img"
        aria-label={`Imagen no disponible para ${productName}`}
      >
        <ImageOff className="h-10 w-10" />
      </div>
    );
  }

  return <ProductImage imageUrl={imageUrl} productName={productName} />;
}
