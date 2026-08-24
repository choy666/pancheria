import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// Cargar .env.local primero y luego .env.e2e para permitir sobreescrituras.
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.e2e', override: true });

const baseURL = process.env.BASE_URL || 'http://localhost:3000';
const useGlobalSetup = !process.env.NO_GLOBAL_SETUP;
const useWebServer = !process.env.NO_WEB_SERVER;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: useGlobalSetup ? './tests/e2e/global-setup.ts' : undefined,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // El webServer levanta el dev server con .env.e2e. El health check apunta a
  // /api/caja/resumen para forzar la compilación de una ruta API bajo Turbopack
  // antes de que los tests comiencen. Si se agregan rutas críticas, considerar
  // un endpoint de health check dedicado.
  webServer: useWebServer
    ? {
        command: 'npm run dev:e2e',
        url: 'http://localhost:3000/api/caja/resumen',
        reuseExistingServer: true,
        timeout: 180 * 1000,
      }
    : undefined,
});
