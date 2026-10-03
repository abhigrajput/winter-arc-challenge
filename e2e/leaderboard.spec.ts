import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  SEEDED_BODY,
  adminClient,
  completeToday,
  createOnboardedUser,
  deleteTestUser,
  type TestUser,
} from './support';

/**
 * Phase 13, from an anonymous visitor's point of view: the leaderboard and
 * public profiles are readable, and no body data is reachable anywhere —
 * rendered pages or the database API with the public anon key.
 */

const admin = adminClient();
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

test.describe.configure({ mode: 'default' });

let pub: (TestUser & { username: string }) | undefined;
let priv: (TestUser & { username: string }) | undefined;
let taskCount = 0;

test.beforeAll(async () => {
  pub = await createOnboardedUser(admin, 'pub');
  priv = await createOnboardedUser(admin, 'priv', { isPublic: false });
  taskCount = await completeToday(admin, pub.id);
  await completeToday(admin, priv.id);
});

test.afterAll(async () => {
  await deleteTestUser(admin, pub);
  await deleteTestUser(admin, priv);
});

/** Every way the seeded body numbers could be printed. */
const BODY_PATTERNS = Object.values(SEEDED_BODY).flatMap((n) => [String(n), String(n).replace('.', ',')]);

async function expectNoBodyData(page: Page): Promise<void> {
  const html = await page.content();
  for (const pattern of BODY_PATTERNS) {
    expect(html, `page leaks ${pattern}`).not.toContain(pattern);
  }
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/\b\d+(\.\d+)?\s?kg\b/i);
  expect(text).not.toMatch(/body fat|waist|kcal/i);
}

test('anon visitor sees the public user ranked, never the private one', async ({ page }) => {
  await page.goto('/leaderboard');
  await expect(page).toHaveURL(/\/leaderboard$/);
  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();

  const row = page.getByTestId('leaderboard-row').filter({ hasText: `@${pub!.username}` });
  await expect(row).toBeVisible();
  // §4 points: 10 per task + 20 for a full day.
  await expect(row).toContainText(`${taskCount * 10 + 20}`);
  await expect(page.getByText(`@${priv!.username}`)).toHaveCount(0);
  await expectNoBodyData(page);

  await page.getByRole('link', { name: 'All time' }).click();
  await expect(page).toHaveURL(/range=all/);
  await expect(page.getByTestId('leaderboard-row').filter({ hasText: `@${pub!.username}` })).toBeVisible();
  await expect(page.getByText(`@${priv!.username}`)).toHaveCount(0);
});

test('anon visitor can open a public profile with day, streak and heatmap only', async ({ page }) => {
  await page.goto('/leaderboard');
  await page.getByRole('link', { name: new RegExp(`E2E pub`) }).first().click();
  await expect(page).toHaveURL(new RegExp(`/u/${pub!.username}$`));

  await expect(page.getByRole('heading', { name: 'E2E pub' })).toBeVisible();
  await expect(page.getByTestId('profile-day')).toContainText('/90');
  await expect(page.getByTestId('profile-streak')).toHaveText('1');
  await expect(page.getByText('Completion')).toBeVisible();
  await expectNoBodyData(page);
});

test('private profiles are a plain 404', async ({ page }) => {
  const response = await page.goto(`/u/${priv!.username}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByText('Nothing here.')).toBeVisible();
  await expectNoBodyData(page);
});

test('private app pages send anon visitors to sign in', async ({ page }) => {
  for (const path of ['/body', '/stats', '/nutrition', '/face', '/today']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login\?next=/);
  }
});

test('the anon key cannot read body data from the database', async () => {
  for (const table of ['profiles', 'body_measurements', 'progress_photos', 'food_entries', 'checkins', 'sleep_logs', 'skin_logs']) {
    const { data, error } = await anon.from(table).select('*').limit(5);
    expect(error === null ? data : [], `anon read ${table}`).toEqual([]);
  }

  const { data: profiles } = await anon.from('public_profiles').select('*').eq('username', pub!.username);
  expect(profiles).toHaveLength(1);
  expect(Object.keys(profiles![0]!).sort()).toEqual(['avatar_url', 'challenge_start', 'display_name', 'id', 'username']);

  const { data: privateRows } = await anon.from('public_profiles').select('id').eq('username', priv!.username);
  expect(privateRows).toEqual([]);

  const { data: stats } = await anon.rpc('get_public_profile', { p_username: pub!.username });
  expect(Object.keys(stats as object).sort()).toEqual(['achievements', 'days', 'today']);
  expect(JSON.stringify(stats)).not.toMatch(/weight|waist|neck|hip|kcal|calorie|body_fat/i);

  const { data: privateStats } = await anon.rpc('get_public_profile', { p_username: priv!.username });
  expect(privateStats).toBeNull();
});

test('get_streak is 0 for a private user unless you are that user', async () => {
  const { data: publicStreak } = await anon.rpc('get_streak', { p_user: pub!.id });
  expect(publicStreak).toBe(1);

  const { data: privateStreak } = await anon.rpc('get_streak', { p_user: priv!.id });
  expect(privateStreak).toBe(0);

  const self = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  await self.auth.signInWithPassword({ email: priv!.email, password: priv!.password });
  const { data: ownStreak } = await self.rpc('get_streak', { p_user: priv!.id });
  expect(ownStreak).toBe(1);
});
