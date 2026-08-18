import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

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
  reporter: 'html',
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
  webServer: useWebServer
    ? {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
      }
    : undefined,
});
