import Image from 'next/image';
import { Send, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getChatMaxTextLength } from '@/config/chat';

interface ChatComposerProps {
  orderId: number;
  content: string;
  setContent: (value: string) => void;
  onSend: () => void;
  isReadOnly: boolean;
  isSending: boolean;
  selectedFile: File | null;
  previewUrl: string | null;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ChatComposer({
  orderId,
  content,
  setContent,
  onSend,
  isReadOnly,
  isSending,
  selectedFile,
  previewUrl,
  onFileSelect,
  onRemoveFile,
  fileInputRef,
}: ChatComposerProps) {
  return (
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
            onClick={onRemoveFile}
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
              onChange={onFileSelect}
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
              void onSend();
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
          onClick={() => void onSend()}
          disabled={isReadOnly || isSending || (!content.trim() && !selectedFile)}
          size="icon"
          aria-label="Enviar mensaje"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
