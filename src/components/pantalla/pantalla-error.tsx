'use client';

const USER_FACING_MESSAGE =
  'No pudimos cargar la sucursal activa. Estamos trabajando para solucionarlo.';

/**
 * Estado de error de la pantalla publicitaria, en el mismo espíritu que
 * `PedidoError` pero sobre el tema oscuro del kiosk.
 */
export function PantallaError() {
  function handleReload() {
    window.location.reload();
  }

  return (
    <div
      data-testid="pantalla-error"
      className="flex h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center"
    >
      <p className="font-heading text-4xl tracking-wide">
        <span className="text-brand-red">Pan</span>
        <span className="text-brand-mustard">chería</span>
      </p>
      <p className="max-w-md text-lg text-muted-foreground">
        {USER_FACING_MESSAGE}
      </p>
      <button
        type="button"
        onClick={handleReload}
        className="rounded-lg bg-brand-red px-6 py-3 font-semibold text-white transition hover:brightness-110"
      >
        Volver a intentar
      </button>
    </div>
  );
}
