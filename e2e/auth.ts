import type { Page } from '@playwright/test';
import type { TestUser } from './support';

/** Signs in through the real form and waits for the redirect away from /login. */
export async function signIn(page: Page, user: TestUser, landing: RegExp): Promise<void> {
  await page.goto('/login');
  await page.locator('#signin-email').fill(user.email);
  await page.locator('#signin-password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(landing);
}
