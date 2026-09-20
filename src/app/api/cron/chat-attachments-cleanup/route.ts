import { getOrderMessagesRetentionDays } from '@/config/chat';
import * as cleanupService from '@/application/services/cleanupService';
import { withCronAuth } from '@/lib/cron-handler';

// Plan Hobby con Fluid Compute permite hasta 300 s por función
// (verificado en producción 2026-09-19, Fase M del plan de escalabilidad).
export const maxDuration = 300;

export const GET = withCronAuth(
  'cron/chat-attachments-cleanup',
  async () => {
    const chatAttachments =
      await cleanupService.cleanupOrphanedChatAttachments();
    const productImages = await cleanupService.cleanupOrphanedProductImages();
    const videos = await cleanupService.cleanupOrphanedVideos();

    // Retención de mensajes de pedidos terminales: opt-in por env
    // (ORDER_MESSAGES_RETENTION_DAYS). Sin valor no se purga nada.
    const retentionDays = getOrderMessagesRetentionDays();
    const deletedMessages = retentionDays
      ? await cleanupService.cleanupExpiredOrderMessages(retentionDays)
      : 0;

    return {
      chatAttachments,
      productImages,
      videos,
      deletedMessages,
    };
  }
);

export const runtime = 'nodejs';
