import { expect, test, type Page } from '@playwright/test';
import { adminClient, createTestUser, deleteTestUser, type TestUser } from './support';

/**
 * Full onboarding at mobile width, through the real UI, against a real
 * Supabase project. Each test gets its own throwaway user.
 */

const admin = adminClient();
let user: TestUser | undefined;

test.afterEach(async () => {
  await deleteTestUser(admin, user);
  user = undefined;
});

async function signIn(page: Page, u: TestUser): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(u.email);
  await page.locator('#password').fill(u.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/onboarding\/identity/);
}

async function next(page: Page, from: string, to: string, label = 'Continue'): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/onboarding/${from}$`));
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForURL(new RegExp(`/onboarding/${to}$`));
}

/** Steps 1–8, ending on the Baseline page. Uses comma decimals on purpose. */
async function fillThroughRoutine(page: Page, sex: 'male' | 'female'): Promise<void> {
  const username = `e2e${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
  await page.locator('#username').fill(username);
  await page.locator('#display_name').fill('E2E');
  await next(page, 'identity', 'body');

  await page.locator(`input[name="sex"][value="${sex}"]`).check();
  await page.locator('#age').fill('24');
  await page.locator('#height_cm').fill(sex === 'male' ? '175,5' : '163');
  await page.locator('#weight_kg').fill(sex === 'male' ? '74,2' : '62');
  await page.locator('#target_weight_kg').fill(sex === 'male' ? '69' : '57.5');
  await page.locator('input[name="activity_level"]').nth(2).check();
  await next(page, 'body', 'goal');

  await page.locator('input[name="goal"][value="fat_loss"]').check();
  await next(page, 'goal', 'modules');

  await next(page, 'modules', 'training');

  await page.locator('input[name="training_mode"][value="home"]').check();
  await page.locator('input[name="equipment"][value="dumbbells"]').check();
  await page.locator('#max_dumbbell_kg').fill('12,5');
  await next(page, 'training', 'schedule');

  await page.locator('input[name="fitness_level"][value="beginner"]').check();
  await page.locator('input[name="days_per_week"][value="4"]').check();
  await page.locator('input[name="session_minutes"][value="45"]').check();
  await next(page, 'schedule', 'diet');

  await page.locator('input[name="diet_type"][value="veg"]').check();
  await page.locator('input[name="budget"][value="hostel"]').check();
  await next(page, 'diet', 'routine');

  await page.locator('#sleep_target_h').fill('7,5');
  await next(page, 'routine', 'baseline');
}

async function startDayOne(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start Day 1' }).click();
  await page.waitForURL(/\/today/);
}

async function profileOf(id: string) {
  const { data } = await admin
    .from('profiles')
    .select('onboarded, height_cm, weight_kg, max_dumbbell_kg, sleep_target_h')
    .eq('id', id)
    .single();
  return data;
}

async function measurementsOf(id: string) {
  const { data } = await admin
    .from('body_measurements')
    .select('waist_cm, neck_cm, hip_cm, body_fat_pct')
    .eq('user_id', id);
  return data ?? [];
}

test('onboards with measurements typed with comma decimals', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  user = await createTestUser(admin, 'measure');
  await signIn(page, user);
  await fillThroughRoutine(page, 'male');

  await expect(page.locator('#hip_cm')).toHaveCount(0);
  await page.locator('#waist_cm').pressSequentially('80,5');
  await page.locator('#neck_cm').pressSequentially('38,2');
  await expect(page.locator('#waist_cm')).toHaveValue('80,5');
  await next(page, 'baseline', 'result', 'See my plan');

  await expect(page.getByText('Body fat estimate')).toBeVisible();
  await expect(page.getByText(/^\d+(\.\d+)?-\d+(\.\d+)?%$/)).toBeVisible();
  await startDayOne(page);

  expect(await profileOf(user.id)).toMatchObject({
    onboarded: true,
    height_cm: 175.5,
    weight_kg: 74.2,
    max_dumbbell_kg: 12.5,
    sleep_target_h: 7.5,
  });
  const rows = await measurementsOf(user.id);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ waist_cm: 80.5, neck_cm: 38.2, hip_cm: null });
  expect(rows[0]!.body_fat_pct).not.toBeNull();
  expect(errors).toEqual([]);
});

test('rejects out-of-range measurements with a clear message', async ({ page }) => {
  user = await createTestUser(admin, 'range');
  await signIn(page, user);
  await fillThroughRoutine(page, 'male');

  await page.locator('#waist_cm').fill('805');
  await page.locator('#neck_cm').fill('38');
  await page.getByRole('button', { name: 'See my plan' }).click();
  await expect(page.getByText('Waist in cm: 40-200.')).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding\/baseline$/);
});

test('skips measurements and still completes onboarding', async ({ page }) => {
  user = await createTestUser(admin, 'skip');
  await signIn(page, user);
  await fillThroughRoutine(page, 'female');

  await expect(page.locator('#hip_cm')).toBeVisible();
  await next(page, 'baseline', 'result', 'Skip — measure later');

  await expect(page.getByText('Add waist + neck on Body page.')).toBeVisible();
  await startDayOne(page);

  expect((await profileOf(user.id))?.onboarded).toBe(true);
  expect(await measurementsOf(user.id)).toHaveLength(0);
});

test('requires hip for women and accepts it with a comma', async ({ page }) => {
  user = await createTestUser(admin, 'hip');
  await signIn(page, user);
  await fillThroughRoutine(page, 'female');

  await page.locator('#waist_cm').fill('72');
  await page.locator('#neck_cm').fill('32,5');
  await page.locator('#hip_cm').fill('96,5');
  await next(page, 'baseline', 'result', 'See my plan');
  await startDayOne(page);

  const rows = await measurementsOf(user.id);
  expect(rows[0]).toMatchObject({ waist_cm: 72, neck_cm: 32.5, hip_cm: 96.5 });
});

test('resumes on another device where the user left off', async ({ page, browser }) => {
  user = await createTestUser(admin, 'resume');
  await signIn(page, user);
  await fillThroughRoutine(page, 'male');

  // A brand-new browser context: no cookies, no local state. Progress must
  // come from the database alone.
  const other = await browser.newContext({ viewport: { width: 400, height: 860 } });
  try {
    const second = await other.newPage();
    await second.goto('/login');
    await second.locator('#email').fill(user.email);
    await second.locator('#password').fill(user.password);
    await second.getByRole('button', { name: 'Sign in' }).click();
    await second.waitForURL(/\/onboarding/);
    await second.goto('/onboarding');
    await expect(second).toHaveURL(/\/onboarding\/baseline$/);

    await second.getByRole('button', { name: 'Skip — measure later' }).click();
    await second.waitForURL(/\/onboarding\/result$/);
  } finally {
    await other.close();
  }

  const { data } = await admin
    .from('profiles')
    .select('onboarding_step, skipped_baseline')
    .eq('id', user.id)
    .single();
  expect(data).toEqual({ onboarding_step: 8, skipped_baseline: true });
});
