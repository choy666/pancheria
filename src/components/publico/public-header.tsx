import Link from 'next/link';
import { Search, ShoppingBag } from 'lucide-react';
import { routes } from '@/config/routes';
import { getBrandDisplayName, splitBrandName } from '@/lib/brand-helpers';
import type { BrandSettings } from '@/domain/types';
import { BrandMark } from './brand-mark';
import { RecentOrderChatLink } from './recent-order-chat-link';

const NAV_LINK_CLASS =
  'inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:px-3';

interface PublicHeaderProps {
  brand: BrandSettings;
  branchId?: number | null;
  branchName?: string | null;
  showChat?: boolean;
  embedded?: boolean;
}

/**
 * Encabezado de las páginas públicas: marca a la izquierda y las tres acciones
 * del cliente a la derecha (encargar, seguir el pedido y, si hay un pedido
 * reciente vigente, entrar a su chat). Sin rótulos bajo 640 px: los íconos
 * conservan el nombre para lectores de pantalla. `embedded` lo deja dentro de
 * su contenedor (vista previa del panel) en lugar de fijarlo al viewport.
 */
export function PublicHeader({
  brand,
  branchId = null,
  branchName = null,
  showChat = true,
  embedded = false,
}: PublicHeaderProps) {
  const displayName = getBrandDisplayName(brand, branchName);
  const { first, rest } = splitBrandName(displayName);
  const orderHref = branchId ? `${routes.pedido}?branchId=${branchId}` : routes.pedido;

  return (
    <header
      className={
        embedded
          ? 'border-b border-border bg-background'
          : 'sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm'
      }
    >
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2">
        <Link
          href={orderHref}
          className="flex min-w-0 items-center gap-3 rounded-lg py-1"
        >
          <BrandMark name={displayName} logoUpdatedAt={brand.logoUpdatedAt} priority />
          <span className="truncate font-heading text-lg leading-none tracking-wide sm:text-xl">
            <span className="text-brand-red">{first}</span>
            {rest && <span className="text-brand-ink"> {rest}</span>}
          </span>
        </Link>

        <nav
          aria-label="Navegación principal"
          className="flex shrink-0 items-center gap-1 sm:gap-2"
        >
          <Link href={orderHref} className={NAV_LINK_CLASS}>
            <ShoppingBag className="size-5 sm:size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Hacer pedido</span>
          </Link>
          <Link href={routes.pedidoSeguimiento} className={NAV_LINK_CLASS}>
            <Search className="size-5 sm:size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Seguir mi pedido</span>
          </Link>
          {showChat && <RecentOrderChatLink className={NAV_LINK_CLASS} />}
        </nav>
      </div>
    </header>
  );
}
