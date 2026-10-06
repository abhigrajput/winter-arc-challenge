import { expect, test } from '@playwright/test';
import { adminClient, createOnboardedUser, deleteTestUser, type TestUser } from './support';
import { signIn } from './auth';

/** Landing page: instant HTML hero, sections, fallbacks, redirects. 400px wide. */

const admin = adminClient();
let user: TestUser | undefined;

test.afterEach(async () => {
  await deleteTestUser(admin, user);
  user = undefined;
});

test('headline and CTAs are in the server HTML, before any JavaScript', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('90 days. No excuses.');
  expect(html).toContain('Body. Mind. Discipline. Tracked.');
  expect(html).toContain('Start your Winter Arc');
  expect(html).toContain('href="/login?tab=signup"');
  // The 3D scene is not in the initial HTML or eagerly loaded.
  expect(html).not.toMatch(/<canvas/i);
});

test('sections render and fit 400px with no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '90 days. No excuses.' })).toBeVisible();
  for (const name of ['Four phases. Thirteen weeks.', 'Everything the 90 days touch.', 'Four steps. Then ninety days.', 'The arc fills one day at a time.']) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeAttached();
  }
  await expect(page.getByRole('heading', { name: /Live leaderboard/ })).toBeAttached();
  for (const card of ['Training', 'Abs', 'Clear skin', 'Jawline', 'Nutrition', 'Sleep', 'Mind / Spirit', 'AI coach']) {
    await expect(page.getByText(card, { exact: true }).first()).toBeAttached();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBe(0);

  // Scrolling through the hero fills the arc toward day 90.
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await expect(page.getByTestId('hero-day')).not.toHaveText('00');

  // The day counter reaches 90 once its section is in view.
  await page.getByRole('heading', { name: 'Four phases. Thirteen weeks.' }).scrollIntoViewIfNeeded();
  await expect(page.getByTestId('day-counter')).toHaveText('90', { timeout: 10_000 });
});

test('CTA opens the Create account tab', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Start your Winter Arc' }).first().click();
  await page.waitForURL(/\/login\?tab=signup/);
  await expect(page.getByRole('tab', { name: 'Create account' })).toHaveAttribute('aria-selected', 'true');
});

test('reduced motion keeps the static fallback and never fetches three.js', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 400, height: 860 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    const chunks: string[] = [];
    page.on('response', (r) => {
      if (r.url().includes('/_next/static/') && r.url().endsWith('.js')) chunks.push(r.url());
    });
    await page.goto('/');
    await page.mouse.move(100, 100);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(5000);
    await expect(page.locator('[data-hero-mode]')).toHaveAttribute('data-hero-mode', 'fallback');
    await expect(page.locator('canvas')).toHaveCount(0);
    const bodies = await Promise.all(chunks.map(async (url) => (await context.request.get(url)).text()));
    expect(bodies.some((js) => js.includes('WebGLRenderer'))).toBe(false);
  } finally {
    await context.close();
  }
});

test('signed-in visitors skip the landing page', async ({ page }) => {
  user = await createOnboardedUser(admin, 'landing');
  await signIn(page, user, /\/today/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/today$/);
});
