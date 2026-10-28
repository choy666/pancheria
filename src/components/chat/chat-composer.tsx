import Image from 'next/image';
import { Send, X, ImageIcon, MapPin, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getChatMaxTextLength, getChatAllowedImageMimeTypes } from '@/config/chat';

interface ChatComposerProps {
  orderId: number;
  content: string;
  setContent: (value: string) => void;
  onSend: () => void;
  isReadOnly: boolean;
  /** Texto del campo cuando el chat es de solo lectura (vencido o cerrado). */
  readOnlyPlaceholder?: string;
  isSending: boolean;
  isUploading?: boolean;
  selectedFile: File | null;
  previewUrl: string | null;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  canSendClientLocation?: boolean;
  canSendBranchLocation?: boolean;
  /** `true` mientras la geolocalización del cliente está en curso. */
  isRequestingLocation?: boolean;
  onRequestClientLocation?: () => Promise<void>;
  onSendBranchLocation?: () => Promise<void>;
}

export function ChatComposer({
  orderId,
  content,
  setContent,
  onSend,
  isReadOnly,
  readOnlyPlaceholder = 'El pedido no está pendiente.',
  isSending,
  isUploading,
  selectedFile,
  previewUrl,
  onFileSelect,
  onRemoveFile,
  fileInputRef,
  canSendClientLocation = false,
  canSendBranchLocation = false,
  isRequestingLocation = false,
  onRequestClientLocation,
  onSendBranchLocation,
}: ChatComposerProps) {
  return (
    <div className="border-t border-border p-3">
      {selectedFile && previewUrl && (
        <div
          className="relative mb-2 inline-block"
          data-testid={isUploading ? 'chat-attachment-uploading' : undefined}
        >
          {selectedFile.type.startsWith('image/') ? (
            <Image
              src={previewUrl}
              alt="Vista previa"
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted px-1 text-center">
              <FileText className="size-6" aria-hidden="true" />
              <span className="w-full truncate text-[10px] text-muted-foreground">
                {selectedFile.name}
              </span>
            </div>
          )}
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
              accept={getChatAllowedImageMimeTypes().join(',')}
              onChange={onFileSelect}
              className="sr-only"
              id={`chat-file-${orderId}`}
              data-testid="chat-file-input"
            />
            <label
              htmlFor={`chat-file-${orderId}`}
              aria-label="Adjuntar archivo"
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ImageIcon className="size-4" aria-hidden="true" />
            </label>
          </>
        )}

        {canSendClientLocation && onRequestClientLocation && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void onRequestClientLocation()}
            disabled={isSending || isUploading || isRequestingLocation}
            aria-label="Compartir mi ubicación actual"
            title="Compartir mi ubicación actual"
            data-testid="chat-client-location-button"
          >
            {isRequestingLocation ? (
              <Loader2
                className="size-4 animate-spin"
                aria-hidden="true"
                data-testid="chat-client-location-spinner"
              />
            ) : (
              <MapPin className="size-4" />
            )}
          </Button>
        )}

        {canSendBranchLocation && onSendBranchLocation && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void onSendBranchLocation()}
            disabled={isSending || isUploading}
            aria-label="Enviar ubicación de la sucursal"
            title="Enviar ubicación de la sucursal"
            data-testid="chat-branch-location-button"
          >
            <MapPin className="size-4" />
          </Button>
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
          placeholder={isReadOnly ? readOnlyPlaceholder : 'Escribí un mensaje...'}
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
