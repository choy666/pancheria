'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function useErrorDialog() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  const showError = useCallback((error: unknown) => {
    const text = error instanceof Error ? error.message : 'Error desconocido';
    setMessage(text);
    setOpen(true);
  }, []);

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Error</DialogTitle>
        </DialogHeader>
        <DialogDescription role="alert" aria-live="polite" className="pt-4 text-base text-destructive">
          {message}
        </DialogDescription>
        <div className="flex justify-end pt-4">
          <Button onClick={() => setOpen(false)}>Aceptar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { dialog, showError };
}
