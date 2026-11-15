
import { defineConfig } from '@playwright/test';

const isStatic = process.env.DS_TEST_STATIC === '1';
const basePath = process.env.DS_LAB_BASE || '/';
const baseURL = `http://127.0.0.1:5174${basePath}`;

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL,
    headless: true,
  },

  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  webServer: isStatic ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
