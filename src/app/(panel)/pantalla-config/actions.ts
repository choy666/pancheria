'use server';

import { revalidatePath } from 'next/cache';
import * as pantallaService from '@/application/services/pantallaService';
import * as menuService from '@/application/services/menuService';
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

/**
 * Guarda la configuración del menú digital `/menu` de la sucursal activa.
 * `hiddenProductIds`/`featuredProductIds` llegan como checkboxes marcados
 * (`getAll`); se descarta cualquier valor no entero positivo antes del
 * schema por robustez (un checkbox del form solo puede emitir IDs
 * legítimos). Los enums viajan por inputs hidden de los `Select` controlados.
 */
export async function updateMenuSettingsAction(
  _prevState: PantallaConfigState,
  formData: FormData
): Promise<PantallaConfigState> {
  const session = await requireAdmin();
  const branchId = await getCurrentBranchId(session);

  const readIdList = (field: string) =>
    formData
      .getAll(field)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

  try {
    await menuService.updateSettings(branchId, {
      paginaMs: secondsToMs(formData, 'paginaSegundos'),
      filasPagina: formData.get('filasPagina')?.toString(),
      gridColumns: formData.get('gridColumns')?.toString(),
      fontScale: formData.get('fontScale')?.toString(),
      showDescriptions: formData.get('showDescriptions') === 'on',
      cardStyle: formData.get('cardStyle')?.toString(),
      sortOrder: formData.get('sortOrder')?.toString(),
      showQrStrip: formData.get('showQrStrip') === 'on',
      hiddenProductIds: readIdList('hiddenProductIds'),
      featuredProductIds: readIdList('featuredProductIds'),
      qrStripText: formData.get('qrStripText')?.toString(),
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(routes.pantallaConfig);
  return { success: 'Configuración del menú guardada.' };
}
