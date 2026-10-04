import { expect, test } from '@playwright/test';
import { adminClient, createOnboardedUser, deleteTestUser, type TestUser } from './support';
import { signIn } from './auth';

const admin = adminClient();
let user: TestUser | undefined;

test.afterEach(async () => {
  await deleteTestUser(admin, user);
  user = undefined;
});

test('manifest is installable: name, dark theme, 192/512/maskable icons that load', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: 'Winter Arc',
    display: 'standalone',
    start_url: '/today',
    background_color: '#0a0c10',
    theme_color: '#0a0c10',
  });

  const icons: { src: string; sizes: string; purpose?: string }[] = manifest.icons;
  expect(icons.map((i) => `${i.sizes}:${i.purpose ?? 'any'}`).sort()).toEqual(
    ['192x192:any', '512x512:any', '512x512:maskable'].sort(),
  );
  for (const icon of icons) {
    const file = await request.get(icon.src);
    expect(file.status(), icon.src).toBe(200);
    expect(file.headers()['content-type']).toContain('image/png');
  }

  const sw = await request.get('/sw.js');
  expect(sw.status()).toBe(200);
  expect(sw.headers()['cache-control']).toContain('no-cache');
});

test('/today opens offline after one online visit', async ({ page, context }) => {
  user = await createOnboardedUser(admin, 'offline');
  await signIn(page, user, /\/today/);

  // Wait until the worker controls the page, then load /today through it once.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  await page.reload();
  await expect(page.getByText(/Day \d+/).first()).toBeVisible();

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByText(/Day \d+/).first()).toBeVisible();

    // Anything not cached gets the offline page, not a browser error.
    await page.goto('/stats');
    await expect(page.getByText('Offline.')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
