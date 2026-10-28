import { test, expect, type Page } from '@playwright/test';
import {
  clearSession,
  createProductViaApi,
  ensureCashRegisterOpen,
  expireOrderById,
  getDefaultBranchId,
  login,
  loginAsAdmin,
  loginAsOperator,
  setUniqueClientIp,
  unique,
  waitForHydratedInput,
} from './helpers';

/**
 * Página de pedido con marca única (`brand_settings`): configuración desde
 * `/pedido-config`, encabezado y pie del cliente, navegación contextual,
 * cancelación pública solo de pedidos pendientes y chat vencido.
 */

const TEXT_FIELD_IDS = [
  'brand-name',
  'brand-tagline',
  'brand-legal-name',
  'brand-tax-id',
  'brand-support-email',
  'brand-terms-url',
  'brand-privacy-url',
  'brand-developed-by',
  'brand-footer-about',
  'brand-payment-methods',
] as const;

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

type CreatedPublicOrder = {
  id: number;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  cancellationToken: string;
};

// Cada request de la API pública necesita su propia IP: el rate limit de
// creación de pedidos es de pocos pedidos por minuto y por IP.
function randomClientIp() {
  const octet = () => Math.floor(Math.random() * 253) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

function createServiceProduct(page: Page, name: string) {
  return createProductViaApi(page, {
    name: unique(name),
    type: 'service',
    price: 1500,
    unit: 'unidad',
    isActive: true,
  });
}

async function createPublicOrder(
  page: Page,
  productId: number,
  customerName: string
): Promise<CreatedPublicOrder> {
  const response = await page.request.post('/api/public/pedido', {
    headers: { 'x-forwarded-for': randomClientIp() },
    data: {
      items: [{ productId, quantity: 1 }],
      customerName,
      customerPhone: '3415551234',
      deliveryType: 'pickup',
      idempotencyKey: `marca-${customerName}-${Date.now()}`,
    },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { order: CreatedPublicOrder };
  return body.order;
}

async function trackOrder(page: Page, order: CreatedPublicOrder) {
  await page.goto('/pedido/seguimiento');
  await waitForHydratedInput(page, '#orderNumber');
  await page.getByLabel('Número de pedido').fill(order.orderNumber);
  await page.getByLabel('Tu nombre').fill(order.customerName);
  await page.getByLabel('Teléfono').fill(order.customerPhone);
  await page.getByRole('button', { name: 'Buscar pedido' }).click();
  await expect(page.getByText(`Pedido #${order.orderNumber}`)).toBeVisible({
    timeout: 15_000,
  });
}

async function resetBrand(page: Page) {
  await page.goto('/pedido-config');
  await waitForHydratedInput(page, '#brand-name');
  for (const id of TEXT_FIELD_IDS) {
    await page.locator(`#${id}`).fill('');
  }
  await page.getByTestId('brand-settings-save').click();
  await expect(page.getByTestId('brand-settings-success')).toBeVisible();

  const removeLogo = page.getByTestId('brand-logo-remove');
  if (await removeLogo.isVisible()) {
    await removeLogo.click();
    await expect(page.getByTestId('brand-logo-success')).toBeVisible();
  }
}

test.describe('Página de pedido con marca única', () => {
  test.afterEach(async ({ page }) => {
    await clearSession(page);
    await loginAsAdmin(page);
    await resetBrand(page);
  });

  test('el admin configura la marca y el cliente la ve en el encabezado y el pie', async ({
    page,
  }) => {
    const brandName = unique('Marca Pie');
    const legalName = `${brandName} SRL`;
    await login(page);
    const branchId = await getDefaultBranchId();

    await page.goto('/pedido-config');
    await waitForHydratedInput(page, '#brand-name');
    await page.locator('#brand-name').fill(brandName);
    await page.locator('#brand-legal-name').fill(legalName);
    await page.locator('#brand-tax-id').fill('30123456789');
    await page.locator('#brand-support-email').fill('hola@ejemplo.com');
    await page.locator('#brand-terms-url').fill('https://ejemplo.com/terminos');
    await page.getByTestId('brand-settings-save').click();
    await expect(page.getByTestId('brand-settings-success')).toBeVisible();

    await page.goto(`/pedido?branchId=${branchId}`);
    await expect(page.locator('header').first()).toContainText(brandName);

    const footer = page.getByTestId('public-footer');
    await expect(footer).toContainText(
      `© ${new Date().getFullYear()} ${legalName}`
    );
    await expect(footer).toContainText('CUIT 30-12345678-9');
    await expect(
      footer.getByRole('link', { name: 'Términos y condiciones' })
    ).toHaveAttribute('href', 'https://ejemplo.com/terminos');
    await expect(
      footer.getByRole('link', { name: 'Botón de arrepentimiento' })
    ).toHaveAttribute('href', '/pedido/seguimiento');
  });

  test('un operador no puede abrir la configuración de la página de pedido', async ({
    page,
  }) => {
    await loginAsOperator(page);
    await page.goto('/pedido-config');
    await expect(page).not.toHaveURL(/\/pedido-config/);
  });

  test('el encabezado conserva la sucursal y ofrece el chat del último pedido', async ({
    page,
  }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
    const branchId = await getDefaultBranchId();
    const product = await createServiceProduct(page, 'Servicio encabezado');
    const order = await createPublicOrder(
      page,
      product.id,
      unique('Cliente Encabezado')
    );

    await page.goto(`/pedido?branchId=${branchId}`);
    const nav = page.getByRole('navigation', { name: 'Navegación principal' });
    await expect(nav.getByRole('link', { name: 'Hacer pedido' })).toHaveAttribute(
      'href',
      `/pedido?branchId=${branchId}`
    );
    await expect(page.getByTestId('header-chat-link')).toHaveCount(0);

    await trackOrder(page, order);
    await page.goto(`/pedido?branchId=${branchId}`);
    await expect(page.getByTestId('header-chat-link')).toHaveAttribute(
      'href',
      new RegExp(`/pedido/${order.id}/chat\\?token=`)
    );
  });

  test('el cliente cancela un pedido pendiente desde el seguimiento', async ({
    page,
  }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
    const product = await createServiceProduct(page, 'Servicio cancela');
    const order = await createPublicOrder(
      page,
      product.id,
      unique('Cliente Cancela')
    );

    await trackOrder(page, order);
    await page.getByTestId('tracker-cancel-button').click();
    await page.getByRole('button', { name: 'Sí, cancelar pedido' }).click();

    await expect(page.getByText('Este pedido fue cancelado.')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Ir al chat del pedido' })
    ).toHaveCount(0);
  });

  test('un pedido aceptado no se cancela desde la web y conserva el chat', async ({
    page,
  }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
    const branchId = await getDefaultBranchId();
    const product = await createServiceProduct(page, 'Servicio aceptado');
    const order = await createPublicOrder(
      page,
      product.id,
      unique('Cliente Aceptado')
    );

    const received = await page.request.post(
      `/api/pedidos/${order.id}/recibir`
    );
    expect(received.status()).toBe(200);

    const cancelled = await page.request.post(
      `/api/public/pedido/${order.id}/cancelar?branchId=${branchId}`,
      {
        headers: { 'x-forwarded-for': randomClientIp() },
        data: { reason: 'Quiero cancelar', token: order.cancellationToken },
      }
    );
    expect(cancelled.status()).toBe(400);

    await trackOrder(page, order);
    await expect(page.getByTestId('tracker-cancel-button')).toHaveCount(0);
    await expect(
      page.getByText('La sucursal ya aceptó tu pedido')
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Ir al chat del pedido' })
    ).toBeVisible();
  });

  test('un chat vencido deja leer el historial y bloquea el envío', async ({
    page,
  }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
    const product = await createServiceProduct(page, 'Servicio vencido');
    const order = await createPublicOrder(
      page,
      product.id,
      unique('Cliente Vencido')
    );

    await expireOrderById(order.id);
    await page.goto(
      `/pedido/${order.id}/chat?token=${encodeURIComponent(order.cancellationToken)}`
    );
    await expect(
      page.getByPlaceholder(
        'Ya no se pueden enviar mensajes en este pedido. Podés leer el historial.'
      )
    ).toBeDisabled();
  });

  test('el admin sube y quita el logo que se ve en el encabezado', async ({
    page,
  }) => {
    await login(page);
    const branchId = await getDefaultBranchId();

    await page.goto('/pedido-config');
    await page.getByTestId('brand-logo-input').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    });
    await page.getByTestId('brand-logo-save').click();
    await expect(page.getByTestId('brand-logo-success')).toBeVisible();

    await page.goto(`/pedido?branchId=${branchId}`);
    await expect(
      page.locator('header img[src*="/api/public/marca/logo"]')
    ).toBeVisible();

    await page.goto('/pedido-config');
    await page.getByTestId('brand-logo-remove').click();
    await expect(page.getByTestId('brand-logo-success')).toBeVisible();

    await page.goto(`/pedido?branchId=${branchId}`);
    await expect(
      page.locator('header img[src*="/api/public/marca/logo"]')
    ).toHaveCount(0);
  });

  test('el admin llega a la configuración desde la tarjeta del panel', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/');
    await page
      .getByTestId('dashboard-action-pedido-config')
      .getByRole('link', { name: 'Ir' })
      .click();
    await expect(page).toHaveURL('/pedido-config');
    await expect(page.locator('#brand-name')).toBeVisible();
  });

  test('un operador no ve la tarjeta de configuración de la página de pedido', async ({
    page,
  }) => {
    await loginAsOperator(page);
    await page.goto('/');
    await expect(page.getByTestId('dashboard-action-catalogo')).toBeVisible();
    await expect(
      page.getByTestId('dashboard-action-pedido-config')
    ).toHaveCount(0);
  });
});
