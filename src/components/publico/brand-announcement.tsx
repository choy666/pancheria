import { cn } from '@/lib/utils';
import type { BrandAnnouncementVariant } from '@/domain/types';

interface BrandAnnouncementProps {
  text: string;
  variant: BrandAnnouncementVariant;
}

export function BrandAnnouncement({ text, variant }: BrandAnnouncementProps) {
  const isWarning = variant === 'warning';

  return (
    <div
      role={isWarning ? 'alert' : 'status'}
      data-testid="brand-announcement"
      className={cn(
        'rounded-lg border p-3 text-sm',
        isWarning
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-900'
          : 'border-primary/30 bg-primary/10 text-foreground'
      )}
    >
      {text}
    </div>
  );
}
