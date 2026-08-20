'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/fetch';
import { formatTime } from '@/lib/date';
import { getChatRefreshIntervalMs, getChatMaxTextLength } from '@/config/chat';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, X, ImageIcon } from 'lucide-react';
import type { OrderMessage, OrderMessageSenderType } from '@/domain/types';

interface OrderChatProps {
  orderId: number;
  token?: string;
  initialMessages: OrderMessage[];
  readOnly?: boolean;
  isClient?: boolean;
  chatApiUrl: string;
  readApiUrl?: string;
  uploadApiUrl?: string;
  title?: string;
  unreadCount?: number;
}

function buildUrl(base: string, token?: string): string {
  if (!token) return base;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(token)}`;
}

export function OrderChat({
  orderId,
  token,
  initialMessages,
  readOnly = false,
  isClient = false,
  chatApiUrl,
  readApiUrl,
  uploadApiUrl,
  title = 'Chat del pedido',
  unreadCount = 0,
}: OrderChatProps) {
  const isMountedRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFetchingRef = useRef(false);

  const [messages, setMessages] = useState<OrderMessage[]>(initialMessages);
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const displayedUnreadCount =
    unreadCount > 0
      ? unreadCount
      : messages.filter(
          (m) => m.senderType === (isClient ? 'operator' : 'client') && !m.readAt
        ).length;

  const fetchMessages = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const response = isClient
        ? await fetch(buildUrl(chatApiUrl, token))
        : await authenticatedFetch(chatApiUrl);

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Error al cargar mensajes');
      }

      const data = (await response.json()) as { messages: OrderMessage[] };
      if (!isMountedRef.current) return;

      setMessages((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(data.messages)) {
          return prev;
        }
        return data.messages;
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      isFetchingRef.current = false;
    }
  }, [chatApiUrl, token, isClient]);

  const markAsRead = useCallback(async () => {
    if (!readApiUrl) return;

    try {
      const response = isClient
        ? await fetch(buildUrl(readApiUrl, token), { method: 'POST' })
        : await authenticatedFetch(readApiUrl, { method: 'POST' });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Error al marcar como leído');
      }
    } catch {
      // No saturar la UI con errores de read receipt.
    }
  }, [readApiUrl, token, isClient]);

  useEffect(() => {
    isMountedRef.current = true;
    markAsRead();
    queueMicrotask(() => void fetchMessages());

    const intervalMs = getChatRefreshIntervalMs();
    const interval = setInterval(() => {
      queueMicrotask(() => void fetchMessages());
    }, intervalMs);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchMessages, markAsRead]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function handleSend() {
    if (readOnly) return;

    const trimmed = content.trim();
    if (!trimmed && !selectedFile) return;

    setIsSending(true);
    setError(null);

    try {
      let response: Response;

      if (selectedFile && uploadApiUrl) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (trimmed) {
          formData.append('content', trimmed);
        }

        response = isClient
          ? await fetch(buildUrl(uploadApiUrl, token), {
              method: 'POST',
              body: formData,
            })
          : await authenticatedFetch(uploadApiUrl, {
              method: 'POST',
              body: formData,
            });
      } else {
        const body = JSON.stringify({ content: trimmed });
        response = isClient
          ? await fetch(buildUrl(chatApiUrl, token), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
            })
          : await authenticatedFetch(chatApiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
            });
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Error al enviar el mensaje');
      }

      const data = (await response.json()) as { message: OrderMessage };

      if (!isMountedRef.current) return;

      setMessages((prev) => [...prev, data.message]);
      setContent('');
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      void markAsRead();
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      if (isMountedRef.current) setIsSending(false);
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      setSelectedFile(file);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  function handleRemoveFile() {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function isOwnMessage(senderType: OrderMessageSenderType): boolean {
    return isClient ? senderType === 'client' : senderType === 'operator';
  }

  return (
    <div className="flex h-[500px] flex-col rounded-2xl border border-white/8 bg-card">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          {displayedUnreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {displayedUnreadCount}
            </Badge>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              isOwnMessage(message.senderType) ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                isOwnMessage(message.senderType)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {message.senderName && (
                <p className="mb-1 text-xs opacity-80">{message.senderName}</p>
              )}
              {message.content && (
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
              )}
              {message.attachmentUrl && (
                <a
                  href={message.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block"
                >
                  {message.attachmentMimeType?.startsWith('image/') ? (
                    <img
                      src={message.attachmentUrl}
                      alt={message.attachmentName ?? 'Adjunto'}
                      className="max-h-40 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 p-2 text-sm">
                      <Paperclip className="size-4" />
                      <span className="truncate">{message.attachmentName}</span>
                    </div>
                  )}
                </a>
              )}
              <p
                className={`mt-1 text-right text-xs ${
                  isOwnMessage(message.senderType)
                    ? 'text-primary-foreground/70'
                    : 'text-muted-foreground'
                }`}
              >
                {formatTime(message.createdAt)}
              </p>
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Todavía no hay mensajes. Empezá la conversación.
          </p>
        )}
      </div>

      {error && (
        <div className="border-b border-white/8 bg-destructive/15 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="border-t border-white/8 p-3">
        {selectedFile && previewUrl && (
          <div className="relative mb-2 inline-block">
            <img
              src={previewUrl}
              alt="Vista previa"
              className="h-20 w-20 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={handleRemoveFile}
              className="absolute -right-1 -top-1 rounded-full bg-destructive p-1 text-white"
              aria-label="Quitar archivo"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {!readOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="sr-only"
                id={`chat-file-${orderId}`}
              />
              <label
                htmlFor={`chat-file-${orderId}`}
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <ImageIcon className="size-4" />
              </label>
            </>
          )}

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={
              readOnly
                ? 'El pedido no está pendiente.'
                : 'Escribí un mensaje...'
            }
            disabled={readOnly || isSending}
            maxLength={getChatMaxTextLength()}
            rows={1}
            className="min-h-0 flex-1 resize-none"
          />

          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={readOnly || isSending || (!content.trim() && !selectedFile)}
            size="icon"
            aria-label="Enviar mensaje"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
