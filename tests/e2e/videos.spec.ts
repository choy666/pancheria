import { test, expect, type Page } from '@playwright/test';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { loginAsAdmin, loginAsOperator } from './helpers';

async function navigateToVideos(page: Page) {
  await page.goto('/videos');
  await expect(page).toHaveURL('/videos');
}

function createTempVideoFile(): string {
  const filePath = path.join(tmpdir(), `test-video-${Date.now()}.mp4`);
  // MP4 mínimo: caja ftyp + caja free. No es reproducible pero es detectado como video/mp4.
  const buffer = Buffer.from([
    0x00, 0x00, 0x00, 0x20, // size 32
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6f, 0x6d, // 'isom'
    0x00, 0x00, 0x00, 0x00,
    0x69, 0x73, 0x6f, 0x6d,
    0x6d, 0x70, 0x34, 0x31,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x08, // size 8
    0x66, 0x72, 0x65, 0x65, // 'free'
  ]);
  writeFileSync(filePath, buffer);
  return filePath;
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

  test('sube un video y aparece en el listado', async ({ page }) => {
    const filePath = createTempVideoFile();

    try {
      await page.goto('/videos/nuevo');
      await page.getByLabel('Título').fill('Video de prueba E2E');
      await page.getByLabel('Archivo de video').setInputFiles(filePath);

      await page.getByRole('button', { name: 'Subir archivo' }).click();
      await expect(page.getByText('Archivo listo')).toBeVisible({ timeout: 15000 });

      await page.getByRole('button', { name: 'Guardar video' }).click();
      await expect(page).toHaveURL('/videos', { timeout: 15000 });
      await expect(page.getByText('Video de prueba E2E')).toBeVisible();

      // Navegar al detalle y verificar el reproductor.
      await page.getByRole('link', { name: 'Video de prueba E2E' }).click();
      await expect(page).toHaveURL(/\/videos\/\d+/);
      await expect(page.getByRole('heading', { name: 'Video de prueba E2E' })).toBeVisible();
      await expect(page.locator('video')).toBeVisible();
    } finally {
      try {
        unlinkSync(filePath);
      } catch {
        // Ignorar error de limpieza.
      }
    }
  });

  test('el operador no puede acceder a videos', async ({ page }) => {
    await page.context().clearCookies();
    await loginAsOperator(page);
    await page.goto('/videos');
    await expect(page).toHaveURL('/');
  });

  test('el endpoint de streaming responde 200 y soporta Range', async ({ page }) => {
    await page.goto('/videos/nuevo');
    const filePath = createTempVideoFile();

    try {
      await page.getByLabel('Título').fill('Video de streaming E2E');
      await page.getByLabel('Archivo de video').setInputFiles(filePath);

      await page.getByRole('button', { name: 'Subir archivo' }).click();
      await expect(page.getByText('Archivo listo')).toBeVisible({ timeout: 15000 });

      await page.getByRole('button', { name: 'Guardar video' }).click();
      await expect(page).toHaveURL('/videos', { timeout: 15000 });
      await expect(page.getByText('Video de streaming E2E')).toBeVisible();

      await page.getByRole('link', { name: 'Video de streaming E2E' }).click();
      await expect(page).toHaveURL(/\/videos\/\d+/);

      const videoSrc = await page.locator('video').getAttribute('src');
      expect(videoSrc).not.toBeNull();

      const full = await page.request.get(videoSrc!);
      expect(full.status()).toBe(200);
      expect(full.headers()['accept-ranges']).toBe('bytes');
      expect(full.headers()['content-type']).toBe('video/mp4');

      const range = await page.request.get(videoSrc!, {
        headers: { Range: 'bytes=0-15' },
      });
      expect(range.status()).toBe(206);
      expect(range.headers()['content-range']).toMatch(/^bytes 0-15\/\d+$/);
      expect(Number(range.headers()['content-length'])).toBe(16);

      const suffix = await page.request.get(videoSrc!, {
        headers: { Range: 'bytes=-16' },
      });
      expect(suffix.status()).toBe(206);
      expect(Number(suffix.headers()['content-length'])).toBeLessThanOrEqual(16);
    } finally {
      try {
        unlinkSync(filePath);
      } catch {
        // Ignorar error de limpieza.
      }
    }
  });
});
