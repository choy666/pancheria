import { test, expect, type Page } from '@playwright/test';
import {
  login,
  loginAs,
  clearSession,
  unique,
  createProductViaApi,
  ensureCashRegisterOpen,
  setUniqueClientIp,
  getTestSecondBranch,
} from './helpers';

/**
 * Seguridad de la API (S3.1–S3.3, S3.6, S3.8, E2–E3 y datos extremos).
 *
 * La defensa del multi-tenant está en el `branchId` de sesión de `withAuth`
 * y en los lookups con scope (`findById(branchId, id)`): un id ajeno debe
 * responder 404 como si no existiera, nunca datos de otra sucursal. Los
 * tokens públicos (`cancellationToken`) solo sirven para SU pedido.
 */

type CreatedPublicOrder = {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  customerName: string;
  cancellationToken: string;
};

function randomClientIp() {
  const octet = () => Math.floor(Math.random() * 253) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

async function createPublicOrder(
  page: Page,
  productId: number,
  customerName = unique('Cliente Seguridad')
): Promise<CreatedPublicOrder> {
  const response = await page.request.post('/api/public/pedido', {
    headers: { 'x-forwarded-for': randomClientIp() },
    data: {
      items: [{ productId, quantity: 1 }],
      customerName,
      customerPhone: '3415551234',
      deliveryType: 'pickup',
      idempotencyKey: `seg-${customerName}-${Math.random()}`,
    },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { order: CreatedPublicOrder };
  return body.order;
}

async function createSellableProduct(page: Page, name: string) {
  return createProductViaApi(page, {
    name: unique(name),
    type: 'service',
    price: 1500,
    unit: 'unidad',
    isActive: true,
  });
}

test.describe('Seguridad de la API', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
  });

  test.describe('aislamiento entre sucursales', () => {
    test('un operador no lee ni opera pedidos de otra sucursal (IDOR)', async ({
      page,
    }) => {
      const product = await createSellableProduct(page, 'Servicio IDOR');
      const pedido = await createPublicOrder(page, product.id);

      // Cambio a la sesión del operador de la segunda sucursal.
      const second = await getTestSecondBranch();
      await clearSession(page);
      await loginAs(page, second.username, second.password);

      // Todas las operaciones del pedido quedan bajo el branchId de sesión:
      // el id de la otra sucursal responde 404, sin filtrar datos.
      const detalle = await page.request.get(`/api/pedidos/${pedido.id}`);
      expect(detalle.status()).toBe(404);

      const recibir = await page.request.post(
        `/api/pedidos/${pedido.id}/recibir`
      );
      expect(recibir.status()).toBe(404);

      const cancelar = await page.request.post(
        `/api/pedidos/${pedido.id}/cancelar`,
        { data: { reason: 'Intento desde otra sucursal' } }
      );
      expect(cancelar.status()).toBe(404);

      const chat = await page.request.get(`/api/pedidos/${pedido.id}/chat`);
      expect(chat.status()).toBe(404);

      const chatPost = await page.request.post(
        `/api/pedidos/${pedido.id}/chat`,
        { data: { content: 'mensaje desde otra sucursal' } }
      );
      expect(chatPost.status()).toBe(404);
    });

    test('un operador no puede crear productos ni vaciar la papelera (admin-only)', async ({
      page,
    }) => {
      const second = await getTestSecondBranch();
      await clearSession(page);
      await loginAs(page, second.username, second.password);

      const crear = await page.request.post('/api/productos', {
        data: {
          name: unique('Producto prohibido'),
          type: 'service',
          price: 100,
          unit: 'unidad',
          stock: 0,
          minStock: 0,
          isActive: true,
        },
      });
      expect(crear.status()).toBe(403);

      const eliminarProducto = await page.request.delete(
        '/api/productos/1'
      );
      expect([403, 404]).toContain(eliminarProducto.status());

      const papelera = await page.request.delete('/api/caja/eliminadas');
      expect([400, 403]).toContain(papelera.status());
      // En cualquier caso, nunca una ejecución exitosa.
      expect(papelera.status()).not.toBe(200);
    });
  });

  test.describe('tokens públicos por pedido', () => {
    test('el estado y el chat rechazan el token de otro pedido', async ({
      page,
    }) => {
      const product = await createSellableProduct(page, 'Servicio token');
      const pedidoA = await createPublicOrder(page, product.id);
      const pedidoB = await createPublicOrder(page, product.id);

      const estado = await page.request.get(
        `/api/public/pedido/${pedidoA.id}/estado?token=${pedidoB.cancellationToken}`
      );
      expect([401, 403, 404]).toContain(estado.status());

      const chat = await page.request.get(
        `/api/public/pedido/${pedidoA.id}/chat?token=${pedidoB.cancellationToken}`
      );
      expect([401, 403, 404]).toContain(chat.status());

      const chatPost = await page.request.post(
        `/api/public/pedido/${pedidoA.id}/chat?token=${pedidoB.cancellationToken}`,
        { data: { content: 'hola con token ajeno' } }
      );
      expect([401, 403, 404]).toContain(chatPost.status());
    });

    test('el adjunto exige el token del pedido correcto y rechaza claves con traversal', async ({
      page,
      request,
    }) => {
      const product = await createSellableProduct(page, 'Servicio adjunto');
      const pedidoA = await createPublicOrder(page, product.id);
      const pedidoB = await createPublicOrder(page, product.id);

      // `request` es un contexto anónimo (sin la sesión admin de la página):
      // así se ejercita la rama del token público, no la de la sesión.
      const keyB = `chat/${pedidoB.id}/archivo.png`;
      const conTokenAjeno = await request.get(
        `/api/chat/attachment/${encodeURIComponent(keyB)}?token=${pedidoA.cancellationToken}`
      );
      expect(conTokenAjeno.status()).toBe(401);

      // Clave con traversal: se rechaza como inválida antes de la auth.
      const traversal = await request.get(
        `/api/chat/attachment/${encodeURIComponent('chat/../../etc/passwd')}?token=${pedidoA.cancellationToken}`
      );
      expect([400, 401]).toContain(traversal.status());
      expect(traversal.status()).not.toBe(200);

      // Sin token: también rechazado.
      const sinToken = await request.get(
        `/api/chat/attachment/${encodeURIComponent(keyB)}`
      );
      expect(sinToken.status()).toBe(401);
    });
  });

  test.describe('uploads de chat', () => {
    test('rechaza un archivo de texto declarado como imagen (magic bytes)', async ({
      page,
    }) => {
      const product = await createSellableProduct(page, 'Servicio upload');
      const pedido = await createPublicOrder(page, product.id);

      const response = await page.request.post(
        `/api/public/pedido/${pedido.id}/chat/upload?token=${pedido.cancellationToken}`,
        {
          multipart: {
            file: {
              name: 'falso.png',
              mimeType: 'image/png',
              buffer: Buffer.from('esto no es una imagen, es texto plano'),
            },
          },
        }
      );
      expect(response.status()).toBe(400);
    });

    test('rechaza una imagen que excede el tamaño máximo', async ({ page }) => {
      const product = await createSellableProduct(page, 'Servicio upload');
      const pedido = await createPublicOrder(page, product.id);

      // PNG válido de 1x1 inflado con padding hasta superar 5 MB: el header
      // es firme pero el tamaño excede el máximo configurado.
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const oversized = Buffer.concat([
        pngHeader,
        Buffer.alloc(5 * 1024 * 1024 + 1, 0),
      ]);

      const response = await page.request.post(
        `/api/public/pedido/${pedido.id}/chat/upload?token=${pedido.cancellationToken}`,
        {
          multipart: {
            file: {
              name: 'enorme.png',
              mimeType: 'image/png',
              buffer: oversized,
            },
          },
        }
      );
      expect(response.status()).toBe(400);
    });

    // QA-2026-09-21-03 (corregido): `request.formData()` lanzaba un
    // TypeError sin mapear cuando el Content-Type no era multipart ni
    // urlencoded y respondía 500. Ambas variantes devuelven 400.
    test('un body que no es multipart responde 400 (QA-2026-09-21-03)', async ({
      page,
    }) => {
      const product = await createSellableProduct(page, 'Servicio upload');
      const pedido = await createPublicOrder(page, product.id);

      const response = await page.request.post(
        `/api/public/pedido/${pedido.id}/chat/upload?token=${pedido.cancellationToken}`,
        { data: { file: 'no-es-multipart' } }
      );
      expect(response.status()).toBe(400);
    });

    test('el upload autenticado con body no multipart responde 400, no 500 (QA-2026-09-21-03)', async ({
      page,
    }) => {
      const product = await createSellableProduct(page, 'Servicio upload');
      const pedido = await createPublicOrder(page, product.id);

      const response = await page.request.post(
        `/api/pedidos/${pedido.id}/chat/upload`,
        { data: { file: 'no-es-multipart' } }
      );
      expect(response.status()).toBe(400);
    });

    // Mismo patrón de QA-2026-09-21-03 corregido en los otros uploads:
    // imagen de producto y video (ambos admin-only en modo local).
    test('el upload de imagen de producto con body no multipart responde 400, no 500', async ({
      page,
    }) => {
      const response = await page.request.post('/api/productos/imagen/upload', {
        data: { file: 'no-es-multipart' },
      });
      expect(response.status()).toBe(400);
    });

    test('el upload de video con body no multipart responde 400, no 500', async ({
      page,
    }) => {
      const response = await page.request.post('/api/videos/upload', {
        data: { file: 'no-es-multipart' },
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe('protección de crons', () => {
    test('los endpoints cron rechazan requests sin Bearer secret', async ({
      page,
    }) => {
      const cron = await page.request.get('/api/cron/expire-orders');
      expect(cron.status()).toBe(401);

      const cronWrongSecret = await page.request.get(
        '/api/cron/expire-orders',
        { headers: { authorization: 'Bearer secreto-incorrecto' } }
      );
      expect(cronWrongSecret.status()).toBe(401);
    });
  });

  test.describe('datos extremos en payloads públicos', () => {
    test('customerName >255, teléfono inválido y cantidad 0 son rechazados', async ({
      page,
    }) => {
      const product = await createSellableProduct(page, 'Servicio extremos');
      const basePayload = {
        items: [{ productId: product.id, quantity: 1 }],
        customerName: 'Nombre Válido',
        customerPhone: '3415551234',
        deliveryType: 'pickup',
        idempotencyKey: `extremo-${Date.now()}`,
      };

      const nombreLargo = await page.request.post('/api/public/pedido', {
        headers: { 'x-forwarded-for': randomClientIp() },
        data: { ...basePayload, customerName: 'a'.repeat(256) },
      });
      expect(nombreLargo.status()).toBe(400);

      const telefonoInvalido = await page.request.post('/api/public/pedido', {
        headers: { 'x-forwarded-for': randomClientIp() },
        data: { ...basePayload, customerPhone: 'abc-123' },
      });
      expect(telefonoInvalido.status()).toBe(400);

      const cantidadCero = await page.request.post('/api/public/pedido', {
        headers: { 'x-forwarded-for': randomClientIp() },
        data: {
          ...basePayload,
          items: [{ productId: product.id, quantity: 0 }],
        },
      });
      expect(cantidadCero.status()).toBe(400);
    });

    test('un mensaje de chat que excede el largo máximo es rechazado', async ({
      page,
    }) => {
      const product = await createSellableProduct(page, 'Servicio chat largo');
      const pedido = await createPublicOrder(page, product.id);

      const response = await page.request.post(
        `/api/public/pedido/${pedido.id}/chat?token=${pedido.cancellationToken}`,
        { data: { content: 'x'.repeat(1001) } }
      );
      expect(response.status()).toBe(400);
    });

    test('nombres con emoji y caracteres especiales no rompen el alta', async ({
      page,
    }) => {
      const product = await createSellableProduct(page, 'Servicio emoji');

      const response = await page.request.post('/api/public/pedido', {
        headers: { 'x-forwarded-for': randomClientIp() },
        data: {
          items: [{ productId: product.id, quantity: 1 }],
          customerName: 'María José 🌭 O\'Brien <script>',
          customerPhone: '+5493415551234',
          deliveryType: 'pickup',
          idempotencyKey: `emoji-${Date.now()}`,
        },
      });
      expect(response.status()).toBe(201);

      // El nombre se persiste tal cual (la sanitización es del render, no
      // del storage); lo importante es que no haya error de servidor.
      const body = (await response.json()) as {
        order: { customerName: string };
      };
      expect(body.order.customerName).toContain('🌭');
    });
  });
});
