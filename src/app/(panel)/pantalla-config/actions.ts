'use server';

import { revalidatePath } from 'next/cache';
import * as pantallaService from '@/application/services/pantallaService';
import { getCurrentBranchId, requireAdmin } from '@/lib/auth';
import { DomainError } from '@/domain/errors';
import { routes } from '@/config/routes';

export type PantallaConfigState = { error?: string; success?: string } | null;

/**
 * Las duraciones se editan en segundos en la UI y se persisten en
 * milisegundos (la unidad que consumen los timers del cliente). Un campo
 * vacío o no numérico llega como NaN y lo rechaza el schema de Zod con
 * mensaje en español.
 */
function secondsToMs(formData: FormData, field: string): number {
  const raw = formData.get(field)?.toString() ?? '';
  return Math.round(Number(raw) * 1000);
}

export async function updatePantallaSettingsAction(
  _prevState: PantallaConfigState,
  formData: FormData
): Promise<PantallaConfigState> {
  const session = await requireAdmin();
  const branchId = await getCurrentBranchId(session);

  try {
    await pantallaService.updateSettings(branchId, {
      playlistMode: formData.get('playlistMode')?.toString(),
      productoMs: secondsToMs(formData, 'productoSegundos'),
      sucursalMs: secondsToMs(formData, 'sucursalSegundos'),
      qrMs: secondsToMs(formData, 'qrSegundos'),
      videoMaxMs: secondsToMs(formData, 'videoMaxSegundos'),
      maxProductos: formData.get('maxProductos')?.toString(),
      showBranchScene: formData.get('showBranchScene') === 'on',
      showQrScene: formData.get('showQrScene') === 'on',
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(routes.pantallaConfig);
  return { success: 'Configuración guardada.' };
}

export async function savePantallaPlaylistAction(
  _prevState: PantallaConfigState,
  formData: FormData
): Promise<PantallaConfigState> {
  const session = await requireAdmin();
  const branchId = await getCurrentBranchId(session);

  let items: unknown;
  try {
    items = JSON.parse(formData.get('items')?.toString() ?? '[]');
  } catch {
    return { error: 'La playlist enviada no es un JSON válido.' };
  }

  try {
    await pantallaService.savePlaylist(branchId, items);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(routes.pantallaConfig);
  return { success: 'Playlist guardada.' };
}
