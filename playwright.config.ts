import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests. Needs SUPABASE_SERVICE_ROLE_KEY (read from .env.local) to
 * create and delete throwaway users.
 *
 *   npm run test:e2e                                   # local: next start on :3217 (run `npm run build` first)
 *   E2E_BASE_URL=https://winter-arc-challenge-blue.vercel.app npm run test:e2e   # production
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3217';
const local = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      // 400px wide, touch, mobile UA — the width the Baseline bug was reported at.
      use: { ...devices['Pixel 7'], viewport: { width: 400, height: 860 }, locale: 'en-IN' },
    },
  ],
  webServer: local
    ? {
        command: 'npx next start -p 3217',
        url: 'http://localhost:3217/login',
        // Never adopt an unrelated app that happens to hold the port.
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
});
