import { test, expect, type Page } from '@playwright/test';
import { login, unique, waitForHydratedInput } from './helpers';

/**
 * UX del formulario de sucursal: validación en vivo del campo Ubicación,
 * preview del mapa embebido y copiar/pegar de franjas horarias entre días.
 *
 * Las URLs de embed de Google Maps y OpenStreetMap se embeben siempre, sin
 * importar `NEXT_PUBLIC_MAPS_PROVIDER` (el entorno E2E usa el default
 * `openstreetmap`): pegar el iframe de "Insertar un mapa" de Google muestra
 * el preview embebido y en `/pedido` el mapa se ve automáticamente.
 */

async function deleteBranchViaUi(
  page: Page,
  branchName: string,
  branchId: string
): Promise<void> {
  await page.goto('/sucursales');
  const row = page.locator('[data-testid="branch-row"]', {
    hasText: branchName,
  });
  await row.getByTestId(`delete-branch-${branchId}`).click();
  await page.getByPlaceholder(/para confirmar/).fill(branchName);
  await page
    .getByRole('button', { name: 'Eliminar definitivamente' })
    .click();
  await expect(row).toBeHidden({ timeout: 10000 });
}

test.describe('Formulario de sucursal — UX', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('acepta el iframe de "Insertar mapa" de Google, muestra el preview embebido y el mapa se ve en el catálogo', async ({
    page,
  }) => {
    const branchName = unique('Sucursal Iframe');
    // `pb` realista: incluye `!2d<lng>!3d<lat>` (centro del viewport) como
    // todo embed de Google — de ahí sale el enlace "Abrir en el mapa".
    const iframeSrc =
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3393!2d-60.6393!3d-32.9468!2m3!1f0!2f0!3f0';
    const iframeHtml = `<iframe src="${iframeSrc}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`;

    await page.goto('/sucursales/nueva');
    await page.getByLabel('Nombre de la sucursal').fill(branchName);
    await waitForHydratedInput(page, '[data-testid="branch-location"]');
    await page.getByTestId('branch-location').fill(iframeHtml);

    // El embed de Google se embebe siempre, aunque el proveedor E2E sea
    // openstreetmap: el admin ve el preview del mapa (tras abrir el toggle)
    // y no el hint de "se mostrará como enlace".
    await expect(
      page.getByTestId('branch-location-link-hint')
    ).toBeHidden();
    await expect(
      page.getByTestId('branch-location-error')
    ).toBeHidden();
    const preview = page.getByTestId('branch-location-preview-details');
    await expect(preview).toBeVisible();
    await preview.locator('summary').click();
    await expect(page.getByTestId('branch-location-preview')).toHaveAttribute(
      'src',
      iframeSrc
    );

    await page.getByRole('button', { name: 'Crear sucursal' }).click();

    const row = page.locator('[data-testid="branch-row"]', {
      hasText: branchName,
    });
    await expect(row).toBeVisible({ timeout: 10000 });
    const branchId = await row.getAttribute('data-branch-id');
    expect(branchId).not.toBeNull();

    try {
      // Al editar, la ruta dedicada repuebla la URL extraída del src, no
      // el HTML.
      await row.getByRole('button', { name: 'Editar' }).click();
      await page.waitForURL(`**/sucursales/${branchId}/editar`);
      await expect(page.getByTestId('branch-location')).toHaveValue(iframeSrc);

      // El catálogo público muestra el mapa de Google embebido a primera
      // vista (sin toggle) y el enlace apunta a la página de Maps, no a la
      // URL de embed.
      await page.goto(`/pedido?branchId=${branchId}`);
      const infoCard = page.getByTestId('branch-info-card');
      await expect(infoCard).toBeVisible();
      await expect(
        infoCard.getByTestId('branch-map-frame')
      ).toHaveAttribute('src', iframeSrc);
      await expect(infoCard.getByTestId('branch-map-link')).toHaveAttribute(
        'href',
        /google\.com\/maps\/search/
      );
    } finally {
      if (branchId) await deleteBranchViaUi(page, branchName, branchId);
    }
  });

  test('muestra el preview del mapa cuando la ubicación es embebible', async ({
    page,
  }) => {
    const branchName = unique('Sucursal Preview');
    const embedUrl =
      'https://www.openstreetmap.org/export/embed.html?bbox=-60.6443,-32.9518,-60.6343,-32.9418&layer=mapnik&marker=-32.9468,-60.6393';

    await page.goto('/sucursales/nueva');
    await page.getByLabel('Nombre de la sucursal').fill(branchName);
    await waitForHydratedInput(page, '[data-testid="branch-location"]');
    await page.getByTestId('branch-location').fill(embedUrl);

    // La preview se monta solo al abrir el toggle (el iframe no se crea antes).
    const details = page.getByTestId('branch-location-preview-details');
    await expect(details).toBeVisible();
    await details.locator('summary').click();
    const frame = page.getByTestId('branch-location-preview');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', /export\/embed\.html/);

    await page.getByRole('button', { name: 'Crear sucursal' }).click();

    const row = page.locator('[data-testid="branch-row"]', {
      hasText: branchName,
    });
    await expect(row).toBeVisible({ timeout: 10000 });
    const branchId = await row.getAttribute('data-branch-id');
    expect(branchId).not.toBeNull();

    try {
      // El catálogo público muestra la sucursal con el mapa embebido a
      // primera vista (el iframe se monta directamente, sin toggle).
      await page.goto(`/pedido?branchId=${branchId}`);
      const infoCard = page.getByTestId('branch-info-card');
      await expect(infoCard).toBeVisible();
      await expect(
        infoCard.getByTestId('branch-map-frame')
      ).toHaveAttribute('src', /export\/embed\.html/);
    } finally {
      if (branchId) await deleteBranchViaUi(page, branchName, branchId);
    }
  });

  test('marca la ubicación inválida solo después de tocar el campo', async ({
    page,
  }) => {
    await page.goto('/sucursales/nueva');
    await waitForHydratedInput(page, '[data-testid="branch-location"]');
    const location = page.getByTestId('branch-location');

    await location.fill('no es una ubicación');
    // Sin blur ni submit: el error aún no se muestra.
    await expect(
      page.getByTestId('branch-location-error')
    ).toBeHidden();

    await location.blur();
    await expect(
      page.getByTestId('branch-location-error')
    ).toBeVisible();
  });

  test('copia las franjas de un día y las pega en otro', async ({ page }) => {
    await page.goto('/sucursales/nueva');

    // Habilitar Lunes con una franja 08:00–18:00.
    await page.getByTestId('branch-day-1-toggle').check();
    await page.getByTestId('branch-slot-open-1-0').fill('08:00');
    await page.getByTestId('branch-slot-close-1-0').fill('18:00');

    await page.getByTestId('branch-copy-day-1').click();
    await expect(
      page.getByTestId('branch-hours-copied-hint')
    ).toContainText('Lunes');
    // El día origen no muestra "Pegar".
    await expect(page.getByTestId('branch-paste-day-1')).toBeHidden();

    // Pegar en Martes (día deshabilitado): queda habilitado con la franja.
    await page.getByTestId('branch-paste-day-2').click();
    await expect(page.getByTestId('branch-day-2-toggle')).toBeChecked();
    await expect(page.getByTestId('branch-slot-open-2-0')).toHaveValue('08:00');
    await expect(page.getByTestId('branch-slot-close-2-0')).toHaveValue(
      '18:00'
    );

    // Pegar reemplaza las franjas existentes del día destino.
    await page.getByTestId('branch-slot-open-2-0').fill('09:30');
    await page.getByTestId('branch-paste-day-2').click();
    await expect(page.getByTestId('branch-slot-open-2-0')).toHaveValue('08:00');

    // Descartar el copiado oculta los botones "Pegar".
    await page.getByTestId('branch-hours-copied-clear').click();
    await expect(page.getByTestId('branch-paste-day-3')).toBeHidden();
  });

  test('muestra el error de horarios solapados en vivo, sin enviar', async ({
    page,
  }) => {
    await page.goto('/sucursales/nueva');

    await page.getByTestId('branch-day-1-toggle').check();
    await page.getByTestId('branch-slot-open-1-0').fill('08:00');
    await page.getByTestId('branch-slot-close-1-0').fill('12:00');
    await page.getByTestId('branch-add-slot-1').click();

    const hoursError = page.getByTestId('branch-hours-error');
    // La franja nueva (08:00–18:00 por defecto) ya solapa con la primera.
    await expect(hoursError).toBeVisible();
    await expect(hoursError).toContainText('se solapan');

    // Al desolapar las franjas el error desaparece sin necesidad de submit.
    await page.getByTestId('branch-slot-open-1-1').fill('14:00');
    await page.getByTestId('branch-slot-close-1-1').fill('20:00');
    await expect(hoursError).toBeHidden();
  });

  test('avisa en vivo cuando una fila de teléfono o red queda incompleta', async ({
    page,
  }) => {
    await page.goto('/sucursales/nueva');
    await waitForHydratedInput(page, '[data-testid="branch-location"]');

    // Teléfono con etiqueta pero sin número: el servidor la rechazaría.
    await page.getByTestId('branch-add-phone').click();
    const phoneError = page.getByTestId('branch-phone-0-error');
    await page.getByTestId('branch-phone-label-0').fill('Pedidos');
    await expect(phoneError).toHaveText(
      'El número del teléfono es obligatorio.'
    );

    // Con número pero sin etiqueta el error es el inverso.
    await page.getByTestId('branch-phone-number-0').fill('3415555555');
    await page.getByTestId('branch-phone-label-0').fill('');
    await expect(phoneError).toHaveText(
      'La etiqueta del teléfono es obligatoria.'
    );

    // Una red social agregada siempre se envía (la red tiene valor por
    // defecto): el enlace vacío se marca apenas aparece la fila.
    await page.getByTestId('branch-add-social').click();
    await expect(page.getByTestId('branch-social-0-error')).toHaveText(
      'El enlace de Instagram es obligatorio.'
    );
    await page.getByTestId('branch-social-url-0').fill('no es una url');
    await expect(page.getByTestId('branch-social-0-error')).toHaveText(
      'Ingresá una URL http(s) completa o un identificador válido (en WhatsApp, el número con código de país).'
    );
  });

  test('muestra una vista previa en vivo del catálogo público', async ({
    page,
  }) => {
    await page.goto('/sucursales/nueva');
    await waitForHydratedInput(page, '[data-testid="branch-form-name"]');
    await page.getByTestId('branch-form-name').fill('Sucursal Preview');
    await page.getByTestId('branch-form-address').fill('San Martín 500');
    await page.getByTestId('branch-add-phone').click();
    await page.getByTestId('branch-phone-label-0').fill('Pedidos');
    await page.getByTestId('branch-phone-number-0').fill('3415555555');

    const preview = page.getByTestId('branch-public-preview');
    await preview.locator('summary').click();

    // Vista catálogo por defecto: chip de estado + tarjeta con dirección y
    // teléfonos; el nombre no se repite (la variante header usa microcopy).
    await expect(preview.getByTestId('branch-status-chip')).toBeVisible();
    const card = preview.getByTestId('branch-info-card');
    await expect(card).toContainText('San Martín 500');
    await expect(card).toContainText('Pedidos: 3415555555');
    await expect(card).not.toContainText('Sucursal Preview');

    // La vista checkout muestra el nombre y el banner según el estado
    // forzado (en edición no hay caja para el estado real).
    await preview.getByTestId('branch-preview-view-checkout').click();
    await expect(preview.getByTestId('branch-status-chip')).toBeHidden();
    await expect(card).toContainText('Sucursal Preview');
    await preview.getByTestId('branch-preview-mode-open').click();
    await expect(card).toContainText('Sucursal abierta');
    await preview.getByTestId('branch-preview-mode-closed').click();
    await expect(card).toContainText('La sucursal está cerrada');
  });
});
