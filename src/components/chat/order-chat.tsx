'use client';

import { useOrderChat } from './useOrderChat';
import { ChatMessageList } from './chat-message-list';
import { ChatComposer } from './chat-composer';
import type { OrderMessage } from '@/domain/types';

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
  const {
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
    isReadOnly,
    displayedUnreadCount,
    isOwnMessage,
    scrollRef,
    fileInputRef,
    handleSend,
    handleFileSelect,
    handleRemoveFile,
    loadOlderMessages,
  } = useOrderChat({
    token,
    initialMessages,
    initialTotal,
    initialHasMore,
    initialIsExpired,
    readOnly,
    isClient,
    chatApiUrl,
    readApiUrl,
    uploadApiUrl,
    unreadCount,
    disablePollingOnMount,
  });

  return (
    <div className="flex h-[500px] flex-col rounded-2xl border border-white/8 bg-card">
      <ChatMessageList
        scrollRef={scrollRef}
        messages={messages}
        hasMore={hasMore}
        isLoadingOlder={isLoadingOlder}
        onLoadOlder={loadOlderMessages}
        isOwnMessage={isOwnMessage}
        token={token}
        title={title}
        displayedUnreadCount={displayedUnreadCount}
        isPolling={isPolling}
      />

      {error && (
        <div className="border-b border-white/8 bg-destructive/15 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <ChatComposer
        orderId={orderId}
        content={content}
        setContent={setContent}
        onSend={() => void handleSend()}
        isReadOnly={isReadOnly}
        isSending={isSending}
        isUploading={isUploading}
        selectedFile={selectedFile}
        previewUrl={previewUrl}
        onFileSelect={handleFileSelect}
        onRemoveFile={handleRemoveFile}
        fileInputRef={fileInputRef}
      />
    </div>
  );
}
