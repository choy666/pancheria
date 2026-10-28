import Link from 'next/link';
import type { ReactNode } from 'react';

interface BrandLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
}

/**
 * Enlace de la identidad de marca: las rutas internas (`/...`) navegan en la
 * misma pestaña; las URLs externas (términos, privacidad, defensa del
 * consumidor) abren en una pestaña nueva sin filtrar el referrer.
 */
export function BrandLink({ href, className, children }: BrandLinkProps) {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
