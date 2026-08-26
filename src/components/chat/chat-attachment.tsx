import Image from 'next/image';
import { Paperclip } from 'lucide-react';
import type { OrderMessage } from '@/domain/types';

interface ChatAttachmentProps {
  message: OrderMessage;
  token?: string;
}

function buildUrl(base: string, token?: string): string {
  if (!token) return base;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(token)}`;
}

export function ChatAttachment({ message, token }: ChatAttachmentProps) {
  if (!message.attachmentUrl) return null;

  return (
    <a
      href={buildUrl(message.attachmentUrl, token)}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block"
    >
      {message.attachmentMimeType?.startsWith('image/') ? (
        <Image
          src={buildUrl(message.attachmentUrl, token)}
          alt={message.attachmentName ?? 'Adjunto'}
          width={320}
          height={160}
          unoptimized
          className="max-h-40 w-auto rounded-lg object-cover"
          data-testid="chat-attachment-image"
          data-sender-type={message.senderType}
        />
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-white/10 p-2 text-sm">
          <Paperclip className="size-4" />
          <span className="truncate">{message.attachmentName}</span>
        </div>
      )}
    </a>
  );
}
