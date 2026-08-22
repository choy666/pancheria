'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/fetch';
import { formatTime } from '@/lib/date';
import {
  getChatRefreshIntervalMs,
  getChatMaxTextLength,
  getChatPageSize,
} from '@/config/chat';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Send, Paperclip, X, ImageIcon } from 'lucide-react';
import type { OrderMessage, OrderMessageSenderType, OrderStatus } from '@/domain/types';

interface OrderChatProps {
  orderId: number;
  token?: string;
  initialMessages: OrderMessage[];
  initialTotal?: number;
  initialHasMore?: boolean;
  initialIsExpired?: boolean;
  readOnly?: boolean;
  isClient?: boolean;
  chatApiUrl: string;
  readApiUrl?: string;
  uploadApiUrl?: string;
  title?: string;
  unreadCount?: number;
  disablePollingOnMount?: boolean;
}

function buildUrl(base: string, token?: string): string {
  if (!token) return base;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(token)}`;
}

interface ScrollIntent {
  type: 'bottom' | 'preserve';
  prevHeight?: number;
  prevTop?: number;
}

function mergeMessages(
  current: OrderMessage[],
  incoming: OrderMessage[],
  position: 'append' | 'prepend' | 'replace'
): OrderMessage[] {
  if (position === 'replace') {
    return [...incoming].sort((a, b) => a.id - b.id);
  }

  const combined =
    position === 'append'
      ? [...current, ...incoming]
      : [...incoming, ...current];
  const byId = new Map(combined.map((m) => [m.id, m]));
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

export function OrderChat({
  orderId,
  token,
  initialMessages,
  initialTotal,
  initialHasMore,
  initialIsExpired = false,
  readOnly = false,
  isClient = false,
  chatApiUrl,
  readApiUrl,
  uploadApiUrl,
  title = 'Chat del pedido',
  unreadCount = 0,
  disablePollingOnMount = false,
}: OrderChatProps) {
  const isMountedRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFetchingRef = useRef(false);
  const isSendingRef = useRef(false);
  const isFirstUnreadEffectRef = useRef(true);
  const firstMessageIdRef = useRef<number | null>(null);
  const lastMessageIdRef = useRef<number | null>(null);
  const chatEmptyRef = useRef(
    initialTotal === 0 ||
      (initialTotal === undefined && initialHasMore === false)
  );
  const scrollIntentRef = useRef<ScrollIntent | null>(null);

  const [messages, setMessages] = useState<OrderMessage[]>(() =>
    mergeMessages([], initialMessages, 'replace')
  );
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(initialHasMore !== undefined);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [isExpired, setIsExpired] = useState(initialIsExpired);
  const [hasMore, setHasMore] = useState(initialHasMore ?? false);

  const isReadOnly =
    orderStatus !== null
      ? orderStatus !== 'pending' || isExpired
      : readOnly || isExpired;

  const otherSenderType: OrderMessageSenderType = isClient
    ? 'operator'
    : 'client';

  const unreadFromMessages = messages.filter(
    (m) => m.senderType === otherSenderType && !m.readAt
  ).length;

  const displayedUnreadCount =
    !hasFetched && unreadCount > 0 ? unreadCount : unreadFromMessages;

  const addMessages = useCallback(
    (
      incoming: OrderMessage[],
      position: 'append' | 'prepend' | 'replace',
      intent: ScrollIntent | null = null
    ) => {
      if (intent) {
        scrollIntentRef.current = intent;
      }
      setMessages((prev) => mergeMessages(prev, incoming, position));
    },
    []
  );

  useEffect(() => {
    if (messages.length === 0) {
      firstMessageIdRef.current = null;
      lastMessageIdRef.current = null;
    } else {
      const ids = messages.map((m) => m.id);
      firstMessageIdRef.current = Math.min(...ids);
      lastMessageIdRef.current = Math.max(...ids);
    }
  }, [messages]);

  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;

    if (scrollIntentRef.current?.type === 'bottom') {
      el.scrollTop = el.scrollHeight;
    } else if (
      scrollIntentRef.current?.type === 'preserve' &&
      scrollIntentRef.current.prevHeight !== undefined &&
      scrollIntentRef.current.prevTop !== undefined
    ) {
      const { prevHeight, prevTop } = scrollIntentRef.current;
      el.scrollTop = el.scrollHeight - prevHeight + prevTop;
    }

    scrollIntentRef.current = null;
  }, [messages]);

  const loadInitialMessages = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsPolling(true);
    setError(null);

    try {
      const url = buildUrl(
        `${chatApiUrl}?limit=${getChatPageSize()}`,
        token
      );
      const response = isClient
        ? await fetch(url)
        : await authenticatedFetch(url);

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Error al cargar mensajes');
      }

      const data = (await response.json()) as {
        messages: OrderMessage[];
        status: OrderStatus;
        total: number;
        hasMore: boolean;
        isExpired: boolean;
      };
      if (!isMountedRef.current) return;

      chatEmptyRef.current = data.total === 0;
      setHasFetched(true);
      addMessages(data.messages, 'replace', { type: 'bottom' });
      setHasMore(data.hasMore);
      setIsExpired(data.isExpired);

      if (data.status) {
        setOrderStatus(data.status);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) setIsPolling(false);
    }
  }, [chatApiUrl, token, isClient, addMessages]);

  const pollNewMessages = useCallback(
    async (afterId?: number) => {
      if (isSendingRef.current || isFetchingRef.current) return;

      let after: number;
      if (afterId !== undefined) {
        after = afterId;
      } else if (lastMessageIdRef.current !== null) {
        after = lastMessageIdRef.current;
      } else if (chatEmptyRef.current) {
        after = 0;
      } else {
        return loadInitialMessages();
      }

      isFetchingRef.current = true;
      setIsPolling(true);

      try {
        const url = buildUrl(
          `${chatApiUrl}?after=${after}&limit=${getChatPageSize()}`,
          token
        );
        const response = isClient
          ? await fetch(url)
          : await authenticatedFetch(url);

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? 'Error al cargar mensajes');
        }

        const data = (await response.json()) as {
          messages: OrderMessage[];
          status: OrderStatus;
          total: number;
          hasMore: boolean;
          isExpired: boolean;
        };
        if (!isMountedRef.current) return;

        if (data.messages.length > 0) {
          chatEmptyRef.current = false;
          addMessages(data.messages, 'append', { type: 'bottom' });
        }
        setIsExpired(data.isExpired);

        if (data.status) {
          setOrderStatus(data.status);
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        isFetchingRef.current = false;
        if (isMountedRef.current) setIsPolling(false);
      }
    },
    [chatApiUrl, token, isClient, loadInitialMessages, addMessages]
  );

  const loadOlderMessages = useCallback(async () => {
    if (isFetchingRef.current || isLoadingOlder) return;
    if (firstMessageIdRef.current === null) return;

    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;

    isFetchingRef.current = true;
    setIsLoadingOlder(true);
    setError(null);

    try {
      const url = buildUrl(
        `${chatApiUrl}?before=${firstMessageIdRef.current}&limit=${getChatPageSize()}`,
        token
      );
      const response = isClient
        ? await fetch(url)
        : await authenticatedFetch(url);

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Error al cargar mensajes anteriores');
      }

      const data = (await response.json()) as {
        messages: OrderMessage[];
        status: OrderStatus;
        total: number;
        hasMore: boolean;
        expiresAt: string;
        isExpired: boolean;
      };
      if (!isMountedRef.current) return;

      if (data.messages.length > 0) {
        addMessages(data.messages, 'prepend', {
          type: 'preserve',
          prevHeight,
          prevTop,
        });
      }
      setHasMore(data.hasMore);
      setIsExpired(data.isExpired);

      if (data.status) {
        setOrderStatus(data.status);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) setIsLoadingOlder(false);
    }
  }, [chatApiUrl, token, isClient, isLoadingOlder, addMessages]);

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

    if (initialHasMore === undefined) {
      queueMicrotask(() => void loadInitialMessages());
    }

    const intervalMs = getChatRefreshIntervalMs();
    const interval = setInterval(() => {
      queueMicrotask(() => void pollNewMessages());
    }, intervalMs);

    if (initialHasMore !== undefined && !disablePollingOnMount) {
      queueMicrotask(() => void pollNewMessages());
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        void pollNewMessages();
      }
    }
    window.addEventListener('pageshow', handlePageShow);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void pollNewMessages();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [markAsRead, loadInitialMessages, pollNewMessages, initialHasMore, disablePollingOnMount]);

  useEffect(() => {
    if (isFirstUnreadEffectRef.current) {
      isFirstUnreadEffectRef.current = false;
      return;
    }

    if (!isMountedRef.current) return;

    const hasUnreadFromOther = messages.some(
      (m) => m.senderType === otherSenderType && !m.readAt
    );

    if (
      hasUnreadFromOther &&
      (typeof document === 'undefined' || document.visibilityState === 'visible')
    ) {
      void markAsRead();
    }
  }, [messages, otherSenderType, markAsRead]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function handleSend() {
    if (isReadOnly) return;

    const trimmed = content.trim();
    if (!trimmed && !selectedFile) return;

    isSendingRef.current = true;
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
        const chatUrl = buildUrl(chatApiUrl, token);
        const separator = chatUrl.includes('?') ? '&' : '?';
        const url = `${chatUrl}${separator}content=${encodeURIComponent(trimmed)}`;
        response = isClient
          ? await fetch(url, { method: 'POST' })
          : await authenticatedFetch(url, { method: 'POST' });
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Error al enviar el mensaje');
      }

      const data = (await response.json()) as { message: OrderMessage };

      if (!isMountedRef.current) return;

      addMessages([data.message], 'append', { type: 'bottom' });
      setContent('');
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      chatEmptyRef.current = false;
      void markAsRead();

      if (isMountedRef.current) {
        void pollNewMessages(data.message.id);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      isSendingRef.current = false;
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
          {isPolling && (
            <span className="text-xs text-muted-foreground">Sincronizando...</span>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto p-4"
      >
        {hasMore && (
          <div className="flex justify-center py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void loadOlderMessages()}
              disabled={isLoadingOlder}
            >
              {isLoadingOlder ? 'Cargando...' : 'Cargar mensajes anteriores'}
            </Button>
          </div>
        )}

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
                    <Image
                      src={message.attachmentUrl}
                      alt={message.attachmentName ?? 'Adjunto'}
                      width={320}
                      height={160}
                      unoptimized
                      className="max-h-40 w-auto rounded-lg object-cover"
                      data-testid="chat-attachment-image"
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
            <Image
              src={previewUrl}
              alt="Vista previa"
              width={80}
              height={80}
              unoptimized
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
          {!isReadOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="sr-only"
                id={`chat-file-${orderId}`}
                data-testid="chat-file-input"
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
              isReadOnly
                ? 'El pedido no está pendiente.'
                : 'Escribí un mensaje...'
            }
            disabled={isReadOnly || isSending}
            maxLength={getChatMaxTextLength()}
            rows={1}
            className="min-h-0 flex-1 resize-none"
          />

          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={isReadOnly || isSending || (!content.trim() && !selectedFile)}
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
