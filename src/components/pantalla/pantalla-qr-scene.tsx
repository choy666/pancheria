'use client';

import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { getPedidoUrl } from '@/lib/pedido-url';
import type { Branch } from '@/domain/types';

interface PantallaQrSceneProps {
  branch: Branch;
}

/**
 * Escena de cierre del ciclo: QR hacia `/pedido?branchId=N` para que el
 * cliente arme el pedido desde el celular, junto a la URL legible.
 */
export function PantallaQrScene({ branch }: PantallaQrSceneProps) {
  // La URL del QR se resuelve solo tras la hidratación: sin
  // `NEXT_PUBLIC_APP_URL` depende de `window.location` y el texto/QR del
  // SSR nunca coinciden con el cliente (hoy la escena casi nunca está en el
  // render inicial, pero una playlist con solo la escena QR sí la expone).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const pedidoUrl = mounted ? getPedidoUrl(branch.id) : '';
  const readableUrl = pedidoUrl.replace(/^https?:\/\//, '');

  return (
    <div
      data-testid="pantalla-scene-qr"
      className="relative flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden p-6 md:flex-row md:gap-16 md:p-12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 size-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-mustard/15 blur-[160px]"
      />

      <div className="relative flex flex-col items-center gap-4 rounded-3xl bg-white p-6 shadow-2xl md:p-10">
        {mounted && (
          <QRCode
            value={pedidoUrl}
            size={256}
            bgColor="#ffffff"
            fgColor="#1a1a1a"
            level="M"
            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
            viewBox="0 0 256 256"
          />
        )}
        {!mounted && <div className="size-[256px]" aria-hidden="true" />}
      </div>

      <div className="relative flex max-w-xl flex-col items-center gap-4 text-center md:items-start md:text-left">
        <h2 className="font-heading text-4xl tracking-wide text-white md:text-6xl">
          Pedí desde tu celu
        </h2>
        <p className="text-lg text-white/75 md:text-2xl">
          Escaneá el código, armá tu pedido y seguilo por el chat. Sin filas,
          sin esperar.
        </p>
        <p
          data-testid="pantalla-qr-url"
          className="rounded-lg bg-white/10 px-4 py-2 font-mono text-lg text-brand-mustard md:text-2xl"
        >
          {mounted ? readableUrl : ' '}
        </p>
      </div>
    </div>
  );
}
