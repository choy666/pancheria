'use client';

import { useState, useCallback } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions & { resolve?: (value: boolean) => void }>({
    description: '',
  });

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions({ ...opts, resolve });
      setOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    options.resolve?.(true);
    setOpen(false);
  }, [options]);

  const handleCancel = useCallback(() => {
    options.resolve?.(false);
    setOpen(false);
  }, [options]);

  const dialog = (
    <ConfirmDialog
      open={open}
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { dialog, confirm };
}
