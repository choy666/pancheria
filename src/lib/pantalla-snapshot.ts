import * as catalogService from '@/application/services/catalogService';
import * as videoService from '@/application/services/videoService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as pantallaService from '@/application/services/pantallaService';
import {
  isBranchOpen,
  getTodayOpening,
  getNextOpening,
} from '@/lib/branch-helpers';
import { getStorageProvider } from '@/config/videos';
import {
  extractVideoKeyFromUrl,
  getStorageProvider as getProviderInstance,
} from '@/lib/storage';
import type { VideoRow } from '@/domain/types';
import type {
  PantallaSnapshot,
  PantallaVideo,
} from '@/lib/pantalla-playlist';

/**
 * Normaliza la URL de reproducción del video para la pantalla.
 *
 * Con `local`, el `file_url` persistido lleva horneado el host del momento
 * del upload: se emite la ruta relativa same-origin para que la TV pegue al
 * origen que sirve la página (y para que una réplica de la base no herede un
 * host ajeno). Ojo: ese stream exige sesión de admin, así que con provider
 * `local` las escenas de video solo se reproducen en un navegador logueado.
 *
 * Con proveedores remotos el `file_url` ya es la URL pública real (Vercel
 * Blob incluye el subdominio del store y no se reconstruye desde la key);
 * solo se re-resuelve si la fila guardó una key cruda (datos legacy).
 */
function toPantallaVideo(video: VideoRow): PantallaVideo {
  const provider = getStorageProvider();
  let fileUrl = video.fileUrl;

  if (provider === 'local') {
    const key = extractVideoKeyFromUrl(fileUrl);
    if (key) {
      fileUrl = `/api/videos/${encodeURIComponent(key)}/stream`;
    }
  } else if (
    !fileUrl.startsWith('http://') &&
    !fileUrl.startsWith('https://')
  ) {
    fileUrl = getProviderInstance(provider).getPublicUrl(fileUrl);
  }

  return {
    id: video.id,
    title: video.title,
    fileUrl,
    mimeType: video.mimeType,
  };
}

/**
 * Snapshot único de la pantalla publicitaria `/pantalla`: sucursal con su
 * estado operativo, catálogo con disponibilidad y playlist de videos
 * activos. Lo comparten el SSR inicial de la página y el endpoint
 * `GET /api/public/pantalla` que la TV consulta periódicamente.
 *
 * Lanza `NotFoundError` cuando la sucursal no existe o está inactiva
 * (heredado de `listPublicCatalogWithAvailability`).
 */
export async function buildPantallaSnapshot(
  branchId: number
): Promise<PantallaSnapshot> {
  const [catalog, videoRows, cashRegister, settings, items] =
    await Promise.all([
      catalogService.listPublicCatalogWithAvailability(branchId),
      videoService.listActiveVideos(branchId),
      cashRegisterService.getOpenCashRegister(branchId),
      // Configuración efectiva de la sucursal (fila propia o defaults de
      // entorno) y su playlist explícita habilitada — vacía en modo `auto`,
      // donde `buildPantallaPlaylist` la ignora.
      pantallaService.getSettings(branchId),
      pantallaService.listEnabledItems(branchId),
    ]);

  const { branch } = catalog;
  // Misma semántica que GET /api/public/sucursal/estado: sin horarios
  // configurados basta una caja abierta para considerar la sucursal abierta.
  const hasOpeningHours = (branch.openingHours ?? []).length > 0;
  const isOpen =
    cashRegister !== null && (!hasOpeningHours || isBranchOpen(branch));

  const currentOpening = getTodayOpening(branch);
  const nextOpening = getNextOpening(branch);
  const message = isOpen
    ? `Sucursal abierta: ${currentOpening}.`
    : `La sucursal está cerrada. Próxima apertura: ${nextOpening}.`;

  return {
    branch,
    isOpen,
    currentOpening,
    nextOpening,
    message,
    products: catalog.products,
    videos: videoRows.map(toPantallaVideo),
    settings,
    items,
  };
}
