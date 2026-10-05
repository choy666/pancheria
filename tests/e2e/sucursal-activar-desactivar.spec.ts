import { test, expect } from '@playwright/test';
import { login, unique } from './helpers';

/**
 * Cobertura del flag `branches.is_active`: desactivar una sucursal la saca
 * del canal público sin borrar datos (selector de /pedido, catálogo, estado)
 * y reactivarla la restaura. La sucursal del spec nace y queda activa para
 * no alterar el resto del suite (la base es compartida).
 */
test.describe('Activar/desactivar sucursal', () => {
  test('desactivar saca la sucursal del canal público y activar la restaura', async ({
    page,
  }) => {
    await login(page);
    const branchName = unique('Sucursal Toggle');

    await page.goto('/sucursales/nueva');
    await page.getByLabel('Nombre de la sucursal').fill(branchName);
    await page.getByRole('button', { name: 'Crear sucursal' }).click();

    const row = page.locator('[data-testid="branch-row"]', {
      hasText: branchName,
    });
    await expect(row).toBeVisible({ timeout: 10000 });
    const branchId = await row.getAttribute('data-branch-id');
    expect(branchId).not.toBeNull();

    // Referencias públicas antes de desactivar: estado y catálogo responden.
    const estadoInicial = await page.request.get('/api/public/sucursal/estado', {
      params: { branchId: Number(branchId) },
    });
    expect(estadoInicial.status()).toBe(200);

    try {
      // Desactivar: diálogo sin warnings (sucursal nueva, sin caja ni
      // pedidos) y confirmación sin tipear el nombre.
      await row.getByTestId(`toggle-branch-${branchId}`).click();
      await expect(
        page.getByText(/Deja de aparecer en el canal público/)
      ).toBeVisible();
      await page.getByRole('button', { name: 'Desactivar' }).last().click();

      await expect(row.getByTestId('branch-inactive-badge')).toBeVisible({
        timeout: 10000,
      });

      // Estado público: la sucursal inactiva reporta "cerrada" (200, no 404).
      const estadoInactiva = await page.request.get(
        '/api/public/sucursal/estado',
        { params: { branchId: Number(branchId) } }
      );
      expect(estadoInactiva.status()).toBe(200);
      expect((await estadoInactiva.json()).isOpen).toBe(false);

      // Catálogo público con branchId explícito a una inactiva: responde
      // con el mismo error controlado que un id inexistente (400).
      const catalogoInactivo = await page.request.get(
        '/api/public/catalogo',
        { params: { branchId: Number(branchId) } }
      );
      expect(catalogoInactivo.status()).toBe(400);

      // La página de pedido muestra el estado de error controlado.
      await page.goto(`/pedido?branchId=${branchId}`);
      await expect(
        page.getByText(/No pudimos cargar la sucursal activa/)
      ).toBeVisible();
    } finally {
      // La sucursal del spec debe quedar activa aunque un assert falle.
      const toggle = row.getByTestId(`toggle-branch-${branchId}`);
      const badge = row.getByTestId('branch-inactive-badge');
      await page.goto('/sucursales');
      if (await badge.isVisible().catch(() => false)) {
        await toggle.click();
        await page.getByRole('button', { name: 'Activar' }).last().click();
        await expect(badge).not.toBeVisible({ timeout: 10000 });
      }
    }

    // Reactivada: el catálogo vuelve a responder.
    const catalogoActivo = await page.request.get('/api/public/catalogo', {
      params: { branchId: Number(branchId) },
    });
    expect(catalogoActivo.status()).toBe(200);
  });
});
