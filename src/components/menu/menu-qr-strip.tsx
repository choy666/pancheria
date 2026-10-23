'use client';

import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { getPedidoUrl } from '@/lib/pedido-url';
import type { Branch } from '@/domain/types';

interface MenuQrStripProps {
  branch: Branch;
  /** CTA principal de la franja (`menu_settings.qr_strip_text`). */
  text: string;
}

/**
 * Franja persistente de conversión del menú digital: el QR hacia `/pedido`
 * queda siempre a la vista (en `/pantalla` solo aparece una vez por ciclo) —
 * es la puerta de entrada al pedido desde el celular mientras el cliente
 * mira la carta.
 */
export function MenuQrStrip({ branch, text }: MenuQrStripProps) {
  // La URL del QR se resuelve solo tras la hidratación (igual que el reloj
  // del chrome): sin `NEXT_PUBLIC_APP_URL` el origen depende de
  // `window.location`, así que el texto SSR nunca coincide con el cliente.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const pedidoUrl = mounted ? getPedidoUrl(branch.id) : '';
  const readableUrl = pedidoUrl.replace(/^https?:\/\//, '');

  return (
    <footer
      data-testid="menu-qr-strip"
      className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 bg-black/50 px-6 py-2 md:px-12"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-heading text-2xl tracking-wide text-white md:text-3xl">
          {text}
        </p>
        <p className="text-sm text-white/65 md:text-base">
          Escaneá el código, armá tu pedido y seguilo por el chat. Sin filas.
        </p>
        <p
          data-testid="menu-qr-url"
          className="mt-1 w-fit rounded-md bg-white/10 px-2.5 py-1 font-mono text-sm text-brand-mustard md:text-base"
        >
          {mounted ? readableUrl : ' '}
        </p>
      </div>

      <div className="shrink-0 rounded-2xl bg-white p-2.5 shadow-xl md:p-3">
        {mounted && (
          <QRCode
            value={pedidoUrl}
            size={96}
            bgColor="#ffffff"
            fgColor="#1a1a1a"
            level="M"
            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
            viewBox="0 0 96 96"
          />
        )}
        {!mounted && <div className="size-[96px]" aria-hidden="true" />}
      </div>
    </footer>
  );
}
