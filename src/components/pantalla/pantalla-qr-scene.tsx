'use client';

import QRCode from 'react-qr-code';
import { routes } from '@/config/routes';
import type { Branch } from '@/domain/types';

interface PantallaQrSceneProps {
  branch: Branch;
}

/**
 * Escena de cierre del ciclo: QR hacia `/pedido?branchId=N` para que el
 * cliente arme el pedido desde el celular, junto a la URL legible.
 * La base usa `NEXT_PUBLIC_APP_URL` cuando está configurada (dominio público
 * alcanzable por teléfonos) y cae al origen que sirve la propia pantalla.
 */
export function PantallaQrScene({ branch }: PantallaQrSceneProps) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  const pedidoUrl = `${baseUrl}${routes.pedido}?branchId=${branch.id}`;
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
        <QRCode
          value={pedidoUrl}
          size={256}
          bgColor="#ffffff"
          fgColor="#1a1a1a"
          level="M"
          style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
          viewBox="0 0 256 256"
        />
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
          {readableUrl}
        </p>
      </div>
    </div>
  );
}
