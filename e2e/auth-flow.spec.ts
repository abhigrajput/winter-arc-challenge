import { expect, test, type Page } from '@playwright/test';
import { adminClient, deleteTestUser, type TestUser } from './support';

/**
 * Instant signup (email confirmation is off): create account → onboarding
 * with no email step; sign out; sign in → today. Plus the plain-text errors,
 * the honeypot and the per-IP signup limit.
 */

const admin = adminClient();
const created: TestUser[] = [];
/**
 * Highest signup_attempts id before each test. Anchoring on the identity
 * column, not timestamps, keeps cleanup exact even if this machine's clock
 * and the database's disagree.
 */
let lastAttemptId = 0;

test.describe.configure({ mode: 'default' });

test.beforeEach(async () => {
  const { data } = await admin.from('signup_attempts').select('id').order('id', { ascending: false }).limit(1);
  lastAttemptId = data?.[0]?.id ?? 0;
});

test.afterEach(async () => {
  // Accounts made through the UI: find them by email and delete.
  const { data } = await admin.auth.admin.listUsers({ perPage: 500 });
  for (const u of data.users) {
    if (created.some((c) => c.email === u.email)) await deleteTestUser(admin, { id: u.id, email: u.email!, password: '' });
  }
  created.length = 0;
  // This run's signup attempts, so repeated test runs don't trip the 5/hour limit.
  await admin.from('signup_attempts').delete().gt('id', lastAttemptId);
});

function newUser(tag: string): TestUser & { name: string } {
  return {
    id: '',
    email: `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`,
    password: `E2e-${Math.random().toString(36).slice(2)}-9!`,
    name: `E2E ${tag}`,
  };
}

async function openSignup(page: Page) {
  await page.goto('/login?tab=signup');
  await expect(page.getByRole('tab', { name: 'Create account' })).toHaveAttribute('aria-selected', 'true');
}

/** Submits the signup form and waits for the server action's response. */
async function submitSignup(page: Page) {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/login'),
    page.getByRole('button', { name: 'Create account' }).click(),
  ]);
}

async function fillSignup(page: Page, u: { name: string; email: string; password: string }, confirm = u.password) {
  await page.locator('#signup-name').fill(u.name);
  await page.locator('#signup-email').fill(u.email);
  await page.locator('#signup-password').fill(u.password);
  await page.locator('#signup-confirm').fill(confirm);
}

test('create account → onboarding (no email step); sign out; sign in → today', async ({ page }) => {
  const u = newUser('signup');
  created.push(u);

  await openSignup(page);
  // Only name, email, password, confirm. (The honeypot is off-screen, not display:none — bots skip those.)
  await expect(page.locator('#panel-signup input:visible:not([name="company"])')).toHaveCount(4);
  await fillSignup(page, u);
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL(/\/onboarding/);
  await expect(page.getByText(/check your email|confirm/i)).toHaveCount(0);

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 500 });
  const authUser = list.users.find((x) => x.email === u.email)!;
  expect(authUser.email_confirmed_at).not.toBeNull();
  const { data: profile } = await admin.from('profiles').select('display_name, onboarded').eq('id', authUser.id).single();
  expect(profile).toEqual({ display_name: u.name, onboarded: false });

  // Fast-forward onboarding so the account can reach /today and /settings.
  await admin
    .from('profiles')
    .update({
      username: `e2e${Date.now().toString().slice(-9)}`,
      sex: 'male', age: 26, height_cm: 176, weight_kg: 75, target_weight_kg: 70, activity_level: 1.55,
      goal: 'recomp', training_mode: 'home', fitness_level: 'beginner', days_per_week: 4, session_minutes: 45,
      diet_type: 'veg', budget: 'normal', calorie_target: 2200, onboarded: true,
    })
    .eq('id', authUser.id);

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login/);

  await page.locator('#signin-email').fill(u.email);
  await page.locator('#signin-password').fill(u.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/today/);
});

test('not-yet-onboarded users signing in go to onboarding', async ({ page }) => {
  const u = newUser('resume');
  created.push(u);
  await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });

  await page.goto('/login');
  await page.locator('#signin-email').fill(u.email);
  await page.locator('#signin-password').fill(u.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/onboarding/);
});

test('plain-text errors and the password eye toggle', async ({ page }) => {
  const existing = newUser('dupe');
  created.push(existing);
  await admin.auth.admin.createUser({ email: existing.email, password: existing.password, email_confirm: true });

  await openSignup(page);
  await fillSignup(page, { ...existing, name: 'Short' }, 'short12');
  await page.locator('#signup-password').fill('short12');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Password too short')).toBeVisible();
  // What was typed survives a failed submit (never the password).
  await expect(page.locator('#signup-email')).toHaveValue(existing.email);

  await fillSignup(page, { ...existing, name: 'Mismatch' }, 'something-else-1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Passwords do not match')).toBeVisible();

  await fillSignup(page, { ...existing, name: 'Dupe' });
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Email already registered')).toBeVisible();

  // Eye toggle flips the input type and never submits.
  const pw = page.locator('#signup-password');
  await expect(pw).toHaveAttribute('type', 'password');
  await page.locator('#panel-signup').getByRole('button', { name: 'Show password' }).first().click();
  await expect(pw).toHaveAttribute('type', 'text');
  await expect(page).toHaveURL(/\/login/);

  await page.getByRole('tab', { name: 'Sign in' }).click();
  await page.locator('#signin-email').fill(existing.email);
  await page.locator('#signin-password').fill('definitely-wrong-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Wrong email or password')).toBeVisible();

  // No reset link until SMTP exists, and no Google button while it is disabled.
  await expect(page.getByText('Forgot password?')).toHaveCount(0);
  await expect(page.getByText('Continue with Google')).toHaveCount(0);
});

test('honeypot: a filled hidden field creates nothing', async ({ page }) => {
  const u = newUser('bot');
  created.push(u);
  await openSignup(page);
  await fillSignup(page, u);
  await page.locator('#company').evaluate((el: HTMLInputElement) => {
    el.value = 'Acme Bots';
  });
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Something went wrong. Try again.')).toBeVisible();
  const { data } = await admin.auth.admin.listUsers({ perPage: 500 });
  expect(data.users.some((x) => x.email === u.email)).toBe(false);
});

test('at most 5 signups per IP per hour', async ({ page }) => {
  // Re-using a registered email: attempts count, but no accounts are created.
  const existing = newUser('limit');
  created.push(existing);
  await admin.auth.admin.createUser({ email: existing.email, password: existing.password, email_confirm: true });

  await openSignup(page);
  for (let i = 0; i < 5; i += 1) {
    await fillSignup(page, { ...existing, name: `Try ${i}` });
    await submitSignup(page);
    await expect(page.getByText('Email already registered')).toBeVisible();
  }
  const { count } = await admin.from('signup_attempts').select('id', { count: 'exact', head: true }).gt('id', lastAttemptId);
  expect(count).toBe(5);

  await fillSignup(page, { ...existing, name: 'Try 6' });
  await submitSignup(page);
  await expect(page.getByText('Too many accounts from this network. Try again in an hour.')).toBeVisible();
});
