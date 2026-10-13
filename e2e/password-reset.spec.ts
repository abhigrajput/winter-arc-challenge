import { expect, test } from '@playwright/test';
import { adminClient, createOnboardedUser, deleteTestUser, type TestUser } from './support';
import { signIn } from './auth';

/**
 * Forgot password, end to end. The email is mocked: admin.generateLink
 * returns the same one-time token the reset email would carry, and the test
 * opens the link the email template points at (/auth/callback?token_hash=…).
 * No email is ever sent to the throwaway addresses.
 *
 * Skipped when the target runs with FORGOT_PASSWORD_ENABLED off (the pages
 * then 404, which the last test checks instead).
 */

const admin = adminClient();
let user: (TestUser & { username: string }) | undefined;

test.afterEach(async () => {
  await deleteTestUser(admin, user);
  user = undefined;
});

async function enabled(request: import('@playwright/test').APIRequestContext): Promise<boolean> {
  return (await request.get('/auth/forgot')).status() === 200;
}

async function recoveryLink(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  if (error || !data.properties?.hashed_token) throw error ?? new Error('generateLink returned no token');
  return `/auth/callback?token_hash=${data.properties.hashed_token}&type=recovery&next=/auth/reset`;
}

test('request → email link → new password → signed in; old password stops working', async ({ page, request }) => {
  test.skip(!(await enabled(request)), 'FORGOT_PASSWORD_ENABLED is off on this target');
  user = await createOnboardedUser(admin, 'reset');

  // The sign-in form links to the request page; bad input is caught before any email.
  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL(/\/auth\/forgot$/);
  await page.locator('#reset-email').fill('not-an-email@');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.locator('#reset-email')).toHaveJSProperty('validity.valid', false);

  // The email link: signs in with a recovery session and lands on the form.
  await page.goto(await recoveryLink(user.email));
  await expect(page).toHaveURL(/\/auth\/reset$/);
  await expect(page.getByRole('heading', { name: 'New password.' })).toBeVisible();

  // Validation, then the real change.
  const newPassword = `${user.password}-reset`;
  await page.locator('#reset-password').fill(newPassword);
  await page.locator('#reset-confirm').fill(`${newPassword}x`);
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByText('Passwords do not match')).toBeVisible();
  await page.locator('#reset-password').fill(newPassword);
  await page.locator('#reset-confirm').fill(newPassword);
  await page.getByRole('button', { name: 'Set new password' }).click();
  await page.waitForURL(/\/today/);

  // Old password is dead, new one works.
  await page.context().clearCookies();
  await page.goto('/login');
  await page.locator('#signin-email').fill(user.email);
  await page.locator('#signin-password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Wrong email or password')).toBeVisible();
  user.password = newPassword;
  await page.context().clearCookies();
  await signIn(page, user, /\/today/);
});

test('a reset link works once', async ({ page, request }) => {
  test.skip(!(await enabled(request)), 'FORGOT_PASSWORD_ENABLED is off on this target');
  user = await createOnboardedUser(admin, 'reset1x');
  const link = await recoveryLink(user.email);

  await page.goto(link);
  await expect(page).toHaveURL(/\/auth\/reset$/);
  await page.context().clearCookies();

  await page.goto(link);
  await expect(page).toHaveURL(/\/login\?error=/);
});

test('an ordinary signed-in session cannot use /auth/reset to skip the current password', async ({ page, request }) => {
  test.skip(!(await enabled(request)), 'FORGOT_PASSWORD_ENABLED is off on this target');
  user = await createOnboardedUser(admin, 'resetpw');
  await signIn(page, user, /\/today/);

  await page.goto('/auth/reset');
  await expect(page.getByRole('heading', { name: 'Link expired.' })).toBeVisible();
  await expect(page.locator('#reset-password')).toHaveCount(0);
});

test('request page answers the same whether or not the account exists', async ({ page, request }) => {
  test.skip(!(await enabled(request)), 'FORGOT_PASSWORD_ENABLED is off on this target');
  // .invalid is a reserved TLD: Supabase has no such user, so no email is sent.
  await page.goto('/auth/forgot');
  await page.locator('#reset-email').fill('nobody@winter-arc.invalid');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If an account exists for nobody@winter-arc.invalid');
});

test('with the flag off, the pages 404 and the link is hidden', async ({ page, request }) => {
  test.skip(await enabled(request), 'FORGOT_PASSWORD_ENABLED is on on this target');
  expect((await request.get('/auth/reset')).status()).toBe(404);
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveCount(0);
});
