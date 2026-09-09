import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CartPanelProps {
  title: ReactNode;
  headerAction?: ReactNode;
  top?: ReactNode;
  hasItems: boolean;
  list: ReactNode;
  empty: ReactNode;
  footer: ReactNode;
  className?: string;
}

/**
 * Estructura compartida para los carritos de ventas y pedidos públicos.
 *
 * Encapsula el layout flexible que evita que listas largas empujen los
 * controles fuera del viewport:
 * - `Card` con altura máxima y sticky en desktop.
 * - `CardContent` como columna flex con header, lista scrollable y footer.
 */
export function CartPanel({
  title,
  headerAction,
  top,
  hasItems,
  list,
  empty,
  footer,
  className,
}: CartPanelProps) {
  const titleNode =
    typeof title === 'string' ? (
      <CardTitle className="text-lg">{title}</CardTitle>
    ) : (
      title
    );

  return (
    <Card
      className={cn(
        'max-h-[calc(100dvh-7.5rem)] lg:sticky lg:top-24',
        className
      )}
    >
      <CardHeader className="shrink-0 flex-row items-center justify-between gap-2 space-y-0">
        {titleNode}
        {headerAction}
      </CardHeader>
      <CardContent
        className={cn(
          'flex flex-col gap-5 overflow-hidden',
          hasItems && 'flex-1 min-h-0'
        )}
      >
        {top && <div className="shrink-0">{top}</div>}
        {hasItems ? (
          <div className="flex-1 min-h-0 overflow-y-auto">{list}</div>
        ) : (
          <div className="shrink-0">{empty}</div>
        )}
        <div className="shrink-0 flex flex-col gap-5">{footer}</div>
      </CardContent>
    </Card>
  );
}
