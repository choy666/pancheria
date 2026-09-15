import { test, expect } from '@playwright/test';
import {
  login,
  unique,
  getDefaultBranchId,
  getBranchOpeningHours,
  setBranchOpeningHours,
  ensureCashRegisterOpen,
  ensureCashRegisterClosed,
  getCashRegister,
  setCashRegisterOpenedAt,
} from './helpers';
import { getBranchTimezone } from '../../src/config/branch';
import type { BranchOpeningHours } from '../../src/domain/types';

// Franja que cubre todo el día los 7 días: garantiza `en_turno` sin depender
// de la hora real en la que corre el suite.
const ALL_DAY_HOURS: BranchOpeningHours[] = Array.from(
  { length: 7 },
  (_, dayOfWeek) => ({ dayOfWeek, open: '00:00', close: '23:59' })
);

const DAY_OF_WEEK_BY_NAME: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Devuelve el día de semana y la hora `HH:mm` de `date` interpretados en la
 * zona horaria de la sucursal (los `openingHours` se evalúan en esa TZ).
 */
function branchDateParts(date: Date): { dayOfWeek: number; hhmm: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: getBranchTimezone(),
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    dayOfWeek: DAY_OF_WEEK_BY_NAME[get('weekday')],
    hhmm: `${hour}:${get('minute')}`,
  };
}

test.describe('Contactos de sucursal', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('crea una sucursal con teléfonos y redes sociales, los expone en el listado y la API pública, y permite editarlos', async ({
    page,
  }) => {
    const branchName = unique('Sucursal Contactos');
    const phoneNumber = '3415550001';
    const socialUrl = 'https://instagram.com/pancheria-e2e';

    await page.goto('/sucursales');
    await expect(
      page.getByRole('heading', { name: 'Sucursales' })
    ).toBeVisible();

    await page.getByLabel('Nombre de la sucursal').fill(branchName);

    await page.getByTestId('branch-add-phone').click();
    await page.getByTestId('branch-phone-label-0').fill('Pedidos');
    await page.getByTestId('branch-phone-number-0').fill(phoneNumber);
    await page.getByTestId('branch-add-phone').click();
    await page.getByTestId('branch-phone-label-1').fill('WhatsApp');
    await page.getByTestId('branch-phone-number-1').fill('3415550002');

    await page.getByTestId('branch-add-social').click();
    await page
      .getByTestId('branch-social-network-0')
      .selectOption('instagram');
    await page.getByTestId('branch-social-url-0').fill(socialUrl);

    await page.getByRole('button', { name: 'Crear sucursal' }).click();

    const row = page.locator('[data-testid="branch-row"]', {
      hasText: branchName,
    });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByTestId('branch-phone')).toHaveText(
      `Pedidos: ${phoneNumber}`
    );

    const branchId = await row.getAttribute('data-branch-id');
    expect(branchId).not.toBeNull();

    // La API pública expone los contactos para el catálogo y el diálogo de
    // confirmación de pedido.
    const estado = await page.request.get('/api/public/sucursal/estado', {
      params: { branchId: Number(branchId) },
    });
    expect(estado.status()).toBe(200);
    const body = (await estado.json()) as {
      branch: {
        phones: { label: string; number: string }[];
        socialLinks: { network: string; url: string }[];
      };
    };
    expect(body.branch.phones).toEqual([
      { label: 'Pedidos', number: phoneNumber },
      { label: 'WhatsApp', number: '3415550002' },
    ]);
    expect(body.branch.socialLinks).toEqual([
      { network: 'instagram', url: socialUrl },
    ]);

    // Editar: el formulario repuebla los contactos guardados.
    await row.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByTestId('branch-phone-label-0')).toHaveValue(
      'Pedidos'
    );
    await expect(page.getByTestId('branch-phone-number-0')).toHaveValue(
      phoneNumber
    );
    await expect(page.getByTestId('branch-phone-label-1')).toHaveValue(
      'WhatsApp'
    );
    await expect(page.getByTestId('branch-social-network-0')).toHaveValue(
      'instagram'
    );
    await expect(page.getByTestId('branch-social-url-0')).toHaveValue(
      socialUrl
    );

    const updatedNumber = '3415559999';
    await page.getByTestId('branch-phone-number-0').fill(updatedNumber);
    await page
      .getByRole('button', { name: 'Guardar cambios' })
      .click();

    await expect(row.getByTestId('branch-phone')).toHaveText(
      `Pedidos: ${updatedNumber}`,
      { timeout: 10000 }
    );
  });
});

test.describe('Badge de turno y avisos de caja', () => {
  let defaultBranchId: number;
  let originalHours: BranchOpeningHours[];

  test.beforeEach(async ({ page }) => {
    await login(page);
    defaultBranchId = await getDefaultBranchId();
    originalHours = await getBranchOpeningHours(defaultBranchId);
  });

  test.afterEach(async () => {
    // Restaurar los horarios originales para no alterar el resto del suite.
    if (defaultBranchId) {
      await setBranchOpeningHours(defaultBranchId, originalHours);
    }
  });

  test('muestra el badge "En turno" cuando la caja está abierta dentro del horario vigente', async ({
    page,
  }) => {
    await setBranchOpeningHours(defaultBranchId, ALL_DAY_HOURS);
    // Cerrar y reabrir para garantizar `openedAt` dentro del turno vigente:
    // una caja abierta en una corrida anterior quedaría como
    // `recomendar_cierre` aunque el horario cubra todo el día.
    await ensureCashRegisterClosed(page);
    await ensureCashRegisterOpen(page);

    await page.goto('/cierre');

    const badge = page.getByTestId('cash-register-shift-badge').first();
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveAttribute('data-shift-status', 'en_turno');
    await expect(badge).toContainText('En turno:');
  });

  test('muestra el aviso de cierre recomendado cuando comenzó un turno posterior a la apertura', async ({
    page,
  }) => {
    // `CAJA_AUTO_CLOSE_HOURS` está habilitado en E2E, así que la apertura no
    // puede retroceder demasiado. En su lugar se configura un turno que
    // comenzó hace ~5 minutos (hora de sucursal) y sigue vigente, y la
    // apertura se retrocede solo 10 minutos: el primer turno posterior ya
    // arrancó => `recomendar_cierre` sin disparar el cierre automático.
    const ahora = Date.now();
    const inicio = branchDateParts(new Date(ahora - 5 * 60 * 1000));
    const fin = branchDateParts(new Date(ahora + 6 * 60 * 60 * 1000));

    await setBranchOpeningHours(defaultBranchId, [
      { dayOfWeek: inicio.dayOfWeek, open: inicio.hhmm, close: fin.hhmm },
    ]);
    await ensureCashRegisterOpen(page);

    const caja = await getCashRegister(page);
    expect(caja?.id).toBeTruthy();
    await setCashRegisterOpenedAt(
      caja!.id!,
      new Date(ahora - 10 * 60 * 1000)
    );

    await page.goto('/cierre');

    const alerta = page.getByTestId('cash-register-alert').first();
    await expect(alerta).toBeVisible({ timeout: 15000 });
    await expect(alerta).toHaveAttribute('data-code', 'cierre_recomendado');
    await expect(alerta).toContainText('Se recomienda cerrar esta caja');
  });
});
