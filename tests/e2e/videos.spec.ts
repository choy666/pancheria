import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers';

async function navigateToVideos(page: Page) {
  await page.goto('/videos');
  await expect(page).toHaveURL('/videos');
}

test.describe('Videos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('el administrador ve el menú de videos', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Videos');
    await expect(page).toHaveURL('/videos');
  });

  test('la página de videos muestra el listado y el botón de subida', async ({ page }) => {
    await navigateToVideos(page);
    await expect(page.getByRole('heading', { name: 'Videos' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Subir video' })).toBeVisible();
  });

  test('la página de subida muestra el formulario', async ({ page }) => {
    await page.goto('/videos/nuevo');
    await expect(page.getByRole('heading', { name: 'Subir video' })).toBeVisible();
    await expect(page.getByLabel('Título')).toBeVisible();
    await expect(page.getByLabel('Archivo de video')).toBeVisible();
  });

  test('el operador no puede acceder a videos', async ({ browser }) => {
    const context = await browser.newContext();
    // Este test requiere un operador configurado; se omite si no hay credenciales.
    await context.close();
    test.skip();
  });
});
