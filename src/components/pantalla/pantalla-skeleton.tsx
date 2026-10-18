/**
 * Skeleton de la pantalla publicitaria mientras resuelve el SSR: marca con
 * pulso sobre fondo oscuro, sin chrome interactivo.
 */
export function PantallaSkeleton() {
  return (
    <div
      data-testid="pantalla-skeleton"
      className="flex h-dvh flex-col items-center justify-center gap-4 bg-background"
    >
      <p className="animate-pulse font-heading text-4xl tracking-wide">
        <span className="text-brand-red">Pan</span>
        <span className="text-brand-mustard">chería</span>
      </p>
      <p className="text-sm text-muted-foreground">Preparando la pantalla…</p>
    </div>
  );
}
