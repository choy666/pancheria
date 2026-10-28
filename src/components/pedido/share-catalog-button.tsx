'use client';

import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { Check, QrCode, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getPedidoUrl } from '@/lib/pedido-url';

interface ShareCatalogButtonProps {
  branchId: number;
  shareTitle: string;
}

export function ShareCatalogButton({ branchId, shareTitle }: ShareCatalogButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const pedidoUrl = mounted ? getPedidoUrl(branchId) : '';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pedidoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleShare() {
    if (typeof navigator.share !== 'function') {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title: shareTitle, url: pedidoUrl });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        await copyLink();
      }
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!mounted}
          onClick={() => void handleShare()}
          data-testid="share-catalog-button"
        >
          {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
          {copied ? 'Enlace copiado' : 'Compartir catálogo'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!mounted}
          onClick={() => setIsQrOpen(true)}
          data-testid="share-catalog-qr-button"
        >
          <QrCode aria-hidden />
          Ver QR
        </Button>
      </div>

      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent data-theme="light" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Código QR del pedido</DialogTitle>
            <DialogDescription>
              Escanealo con la cámara para abrir el pedido online de esta sucursal.
            </DialogDescription>
          </DialogHeader>
          <div className="mx-auto w-full max-w-64 rounded-2xl bg-white p-4">
            {mounted && (
              <QRCode
                value={pedidoUrl}
                size={224}
                level="M"
                bgColor="#ffffff"
                fgColor="#1a1a1a"
                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                viewBox="0 0 224 224"
              />
            )}
          </div>
          <p className="break-all text-center font-mono text-xs text-muted-foreground">
            {pedidoUrl.replace(/^https?:\/\//, '')}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
