'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/fetch';
import {
  getChatRefreshIntervalMs,
  getChatPageSize,
} from '@/config/chat';
import type { OrderMessage, OrderMessageSenderType, OrderStatus } from '@/domain/types';

interface ScrollIntent {
  type: 'bottom' | 'preserve';
  prevHeight?: number;
  prevTop?: number;
}

export interface UseOrderChatOptions {
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
  unreadCount?: number;
  disablePollingOnMount?: boolean;
}

export interface UseOrderChatResult {
  messages: OrderMessage[];
  content: string;
  setContent: (value: string) => void;
  isSending: boolean;
  isLoadingOlder: boolean;
  isPolling: boolean;
  isUploading: boolean;
  error: string | null;
  selectedFile: File | null;
  previewUrl: string | null;
  hasMore: boolean;
  orderStatus: OrderStatus | null;
  isExpired: boolean;
  hasFetched: boolean;
  isReadOnly: boolean;
  otherSenderType: OrderMessageSenderType;
  displayedUnreadCount: number;
  isOwnMessage: (senderType: OrderMessageSenderType) => boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleSend: () => Promise<void>;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: () => void;
  loadOlderMessages: () => Promise<void>;
}

function buildUrl(base: string, token?: string): string {
  if (!token) return base;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(token)}`;
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

export function useOrderChat({
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
  unreadCount = 0,
  disablePollingOnMount = false,
}: UseOrderChatOptions): UseOrderChatResult {
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
  const consecutiveErrorsRef = useRef(0);
  const nextAllowedAtRef = useRef(0);

  const [messages, setMessages] = useState<OrderMessage[]>(() =>
    mergeMessages([], initialMessages, 'replace')
  );
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(initialHasMore !== undefined);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [isExpired, setIsExpired] = useState(initialIsExpired);
  const [hasMore, setHasMore] = useState(initialHasMore ?? false);

  const isReadOnly =
    orderStatus !== null
      ? orderStatus === 'finished' ||
        orderStatus === 'cancelled' ||
        isExpired
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

    if (!scrollIntentRef.current && messages.length > 0) {
      scrollIntentRef.current = { type: 'bottom' };
    }

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
    if (isFetchingRef.current) return true;
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
      if (!isMountedRef.current) return true;

      chatEmptyRef.current = data.total === 0;
      setHasFetched(true);
      addMessages(data.messages, 'replace', { type: 'bottom' });
      setHasMore(data.hasMore);
      setIsExpired(data.isExpired);

      if (data.status) {
        setOrderStatus(data.status);
      }
      return true;
    } catch (err) {
      if (!isMountedRef.current) return false;
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) setIsPolling(false);
    }
  }, [chatApiUrl, token, isClient, addMessages]);

  const pollNewMessages = useCallback(
    async (afterId?: number): Promise<boolean> => {
      if (isSendingRef.current || isFetchingRef.current) return true;

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
        if (!isMountedRef.current) return true;

        if (data.messages.length > 0) {
          chatEmptyRef.current = false;
          addMessages(data.messages, 'append', { type: 'bottom' });
        }
        setIsExpired(data.isExpired);

        if (data.status) {
          setOrderStatus(data.status);
        }
        return true;
      } catch (err) {
        if (!isMountedRef.current) return false;
        setError(err instanceof Error ? err.message : 'Error desconocido');
        return false;
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
    const maxBackoffMs = intervalMs * 8;
    consecutiveErrorsRef.current = 0;
    nextAllowedAtRef.current = 0;

    function scheduleBackoff() {
      const exponent = Math.max(0, consecutiveErrorsRef.current - 1);
      const delay = Math.min(
        intervalMs * Math.pow(2, exponent),
        maxBackoffMs
      );
      nextAllowedAtRef.current = Date.now() + delay;
    }

    function runScheduledPoll() {
      if (!isMountedRef.current) return;
      if (Date.now() < nextAllowedAtRef.current) return;
      if (isSendingRef.current || isFetchingRef.current) return;

      queueMicrotask(async () => {
        if (!isMountedRef.current) return;
        const ok = await pollNewMessages();
        if (!isMountedRef.current) return;

        if (ok) {
          consecutiveErrorsRef.current = 0;
          nextAllowedAtRef.current = 0;
        } else {
          consecutiveErrorsRef.current += 1;
          scheduleBackoff();
        }
      });
    }

    const interval = setInterval(() => {
      runScheduledPoll();
    }, intervalMs);

    if (initialHasMore !== undefined && !disablePollingOnMount) {
      queueMicrotask(() => void pollNewMessages());
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        consecutiveErrorsRef.current = 0;
        nextAllowedAtRef.current = 0;
        void pollNewMessages();
      }
    }
    window.addEventListener('pageshow', handlePageShow);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        consecutiveErrorsRef.current = 0;
        nextAllowedAtRef.current = 0;
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
    setIsUploading(!!selectedFile && !!uploadApiUrl);
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
        const url = buildUrl(chatApiUrl, token);
        const init = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmed }),
        };
        response = isClient ? await fetch(url, init) : await authenticatedFetch(url, init);
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
        consecutiveErrorsRef.current = 0;
        nextAllowedAtRef.current = 0;
        void pollNewMessages(data.message.id);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      isSendingRef.current = false;
      if (isMountedRef.current) {
        setIsSending(false);
        setIsUploading(false);
      }
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

  return {
    messages,
    content,
    setContent,
    isSending,
    isLoadingOlder,
    isPolling,
    isUploading,
    error,
    selectedFile,
    previewUrl,
    hasMore,
    orderStatus,
    isExpired,
    hasFetched,
    isReadOnly,
    otherSenderType,
    displayedUnreadCount,
    isOwnMessage,
    scrollRef,
    fileInputRef,
    handleSend,
    handleFileSelect,
    handleRemoveFile,
    loadOlderMessages,
  };
}
