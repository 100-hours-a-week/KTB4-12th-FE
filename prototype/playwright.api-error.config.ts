import { defineConfig } from '@playwright/test';

const testPort = 4175;

export default defineConfig({
  testDir: './tests',
  testMatch: [
    '**/*-error.spec.ts',
    '**/*-api.spec.ts',
    '**/product-recommendation.spec.ts',
    '**/notification-sse.spec.ts',
  ],
  timeout: 20_000,
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    viewport: { width: 1100, height: 1100 },
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${testPort}`,
    url: `http://127.0.0.1:${testPort}`,
    reuseExistingServer: false,
    env: {
      ...process.env,
      VITE_USE_MOCK_API: 'false',
      VITE_API_BASE_URL: '',
    },
  },
});
