import { defineConfig } from '@playwright/test';

const externalBaseUrl = process.env.TEST_BASE_URL;
const baseURL = externalBaseUrl || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: externalBaseUrl ? undefined : './tests/e2e/global-setup.js',
  use: {
    baseURL,
    channel: 'msedge',
    headless: true,
    trace: 'retain-on-failure'
  }
});
