import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { defineConfig, devices } from '@playwright/test';

// Cargar .env.local como base y luego .env.e2e con prioridad.
// Se ignoran las entradas vacías de .env.e2e para evitar que dotenv pise
// valores de .env.local con cadenas vacías (comportamiento de override).
dotenv.config({ path: '.env.local' });

try {
  const e2ePath = path.resolve('.env.e2e');
  const e2eEnv = dotenv.parse(fs.readFileSync(e2ePath));
  for (const [key, value] of Object.entries(e2eEnv)) {
    if (value.trim() !== '') {
      process.env[key] = value;
    }
  }
} catch {
  // Si .env.e2e no existe, .env.local sigue siendo la fuente.
}

const baseURL = process.env.BASE_URL || 'http://localhost:3000';
const useGlobalSetup = !process.env.NO_GLOBAL_SETUP;
const useWebServer = !process.env.NO_WEB_SERVER;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: useGlobalSetup ? './tests/e2e/global-setup.ts' : undefined,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // 60 s para todos los entornos: en local, con Turbopack compilando bajo
  // demanda, 30 s se queda corto para el primer login + navegación a páginas
  // protegidas como /stock o /ventas.
  timeout: 60_000,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    // El primer goto a rutas protegidas puede superar los 30 s por defecto
    // mientras el dev server compila el layout y la página.
    navigationTimeout: 60_000,
  },
  expect: {
    // Subimos el default de `expect` para que aserciones como `toHaveURL`
    // no fallen por la primera compilación de una ruta.
    timeout: 15_000,
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
        env: {
          E2E_ENABLE_RATE_LIMIT: process.env.E2E_ENABLE_RATE_LIMIT ?? '',
          PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV:
            process.env.PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV ?? '',
          PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS:
            process.env.PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS ?? '',
          PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER:
            process.env.PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER ?? '',
          TRUSTED_PROXY_IP_HEADER: process.env.TRUSTED_PROXY_IP_HEADER ?? '',
        },
      }
    : undefined,
});
