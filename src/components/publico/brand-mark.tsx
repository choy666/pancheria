import Image from 'next/image';
import { getBrandLogoPath } from '@/lib/brand-helpers';

interface BrandMarkProps {
  name: string;
  logoUpdatedAt: Date | null;
  priority?: boolean;
}

/**
 * Logo de la marca o, si no hay uno cargado, una ficha con la inicial del
 * nombre. Se usa `unoptimized` porque el logo es una URL propia de la app que
 * ya llega normalizada (máx. 512 px) y así no depende de `remotePatterns`.
 */
export function BrandMark({ name, logoUpdatedAt, priority = false }: BrandMarkProps) {
  const src = getBrandLogoPath(logoUpdatedAt);

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={160}
        height={40}
        unoptimized
        priority={priority}
        className="h-10 w-auto max-w-24 shrink-0 object-contain sm:max-w-40"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-red font-heading text-xl text-white"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
