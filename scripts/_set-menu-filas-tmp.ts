import dotenv from 'dotenv';

// One-off: apunta a producción cargando `.env.prod` (NO `.env.local`).
// Lee los settings efectivos de la sucursal y los re-guarda por
// `menuService.updateSettings` (misma validación + upsert que el panel
// /pantalla-config) cambiando únicamente `filasPagina`.
dotenv.config({ path: '.env.prod' });

import {
  getSettings,
  updateSettings,
} from '../src/application/services/menuService';

const BRANCH_ID = 3;
const FILAS_PAGINA = 3;

async function main() {
  const current = await getSettings(BRANCH_ID);
  console.log('Settings actuales:', current);

  const updated = await updateSettings(BRANCH_ID, {
    ...current,
    filasPagina: FILAS_PAGINA,
  });
  console.log('Settings guardadas:', updated);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
