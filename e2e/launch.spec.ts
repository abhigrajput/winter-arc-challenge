import { expect, test } from '@playwright/test';
import { adminClient, completeToday, createOnboardedUser, deleteTestUser, type TestUser } from './support';
import { signIn } from './auth';

/**
 * Phase 15 launch readiness: legal pages, share images, error pages, security
 * headers, and the account controls (password, export, delete).
 */

const admin = adminClient();
let user: (TestUser & { username: string }) | undefined;

test.afterEach(async () => {
  await deleteTestUser(admin, user);
  user = undefined;
});

test('privacy and terms are public and linked from signup and the landing footer', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
  await expect(page.getByText('Never sent to DeepSeek:')).toBeVisible();
  await expect(page.getByText(/photos, your username, your name, your email/)).toBeVisible();
  await expect(page.getByTestId('grievance-officer')).toContainText('abhigrajput05@gmail.com');
  await expect(page.getByText('Data Protection Board of India')).toBeVisible();

  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: 'Terms of use' })).toBeVisible();

  await page.goto('/login?tab=signup');
  const signup = page.locator('#panel-signup');
  await expect(signup.getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '/privacy');
  await expect(signup.getByRole('link', { name: 'terms' })).toHaveAttribute('href', '/terms');

  await page.goto('/');
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Privacy' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Terms' })).toBeVisible();
});

test('branded 404 for unknown routes and private profiles', async ({ page }) => {
  const res = await page.goto('/u/definitely-not-a-user-zz');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Nothing here.' })).toBeVisible();
});

test('share images render for /, /leaderboard and /u/[username]', async ({ page, request }) => {
  user = await createOnboardedUser(admin, 'og');
  await completeToday(admin, user.id);

  for (const path of ['/', '/leaderboard', `/u/${user.username}`]) {
    await page.goto(path);
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og, path).toBeTruthy();
    const image = await request.get(new URL(og!).pathname + new URL(og!).search);
    expect(image.status(), og!).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  }
});

test('security headers are set, CSP in report-only mode', async ({ request }) => {
  const res = await request.get('/login');
  const h = res.headers();
  expect(h['content-security-policy-report-only']).toContain("frame-ancestors 'none'");
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-powered-by']).toBeUndefined();

  const report = await request.post('/api/csp-report', {
    data: { 'csp-report': { 'effective-directive': 'img-src', 'blocked-uri': 'https://e2e.invalid/x.png' } },
    headers: { 'content-type': 'application/csp-report' },
  });
  expect(report.status()).toBe(204);
});

test('change password, export data, then delete the account with everything in it', async ({ page }) => {
  user = await createOnboardedUser(admin, 'acct');
  await completeToday(admin, user.id);
  const photoPath = `${user.id}/2026-01-01-front.jpg`;
  const upload = await admin.storage
    .from('progress')
    .upload(photoPath, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])]), { contentType: 'image/jpeg' });
  expect(upload.error).toBeNull();
  await admin.from('progress_photos').insert({ user_id: user.id, log_date: '2026-01-01', angle: 'front', storage_path: photoPath });
  await admin.from('push_subscriptions').insert({
    user_id: user.id,
    endpoint: `https://push.e2e.invalid/${Date.now()}`,
    p256dh: 'e2e-secret-p256dh-key',
    auth: 'e2e-secret-auth',
  });

  await signIn(page, user, /\/today/);
  await page.goto('/settings');

  // Change password: wrong current is rejected, right one works.
  const newPassword = `${user.password}-new`;
  await page.locator('#current-password').fill('wrong-password-123');
  await page.locator('#new-password').fill(newPassword);
  await page.locator('#confirm-password').fill(newPassword);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Current password is wrong')).toBeVisible();
  // The form resets after each submit, so every field is typed again.
  await page.locator('#current-password').fill(user.password);
  await page.locator('#new-password').fill(newPassword);
  await page.locator('#confirm-password').fill(newPassword);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Password changed.')).toBeVisible();
  user.password = newPassword;

  // Export: own rows, photo list, no push credentials.
  const res = await page.request.get('/api/account/export');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-disposition']).toMatch(/attachment; filename="winter-arc-export-\d{4}-\d{2}-\d{2}\.json"/);
  const data = await res.json();
  expect(data.account.id).toBe(user.id);
  expect(data.tables.profiles[0].username).toBe(user.username);
  expect(data.tables.daily_logs.length).toBeGreaterThan(0);
  expect(data.photo_files).toEqual([photoPath]);
  expect(JSON.stringify(data)).not.toContain('e2e-secret');

  // Delete: button stays disabled until DELETE is typed exactly.
  const button = page.getByRole('button', { name: 'Delete my account' });
  await expect(button).toBeDisabled();
  await page.locator('#delete-confirm').fill('delete');
  await expect(button).toBeDisabled();
  await page.locator('#delete-confirm').fill('DELETE');
  await button.click();
  await page.waitForURL(/\/login\?deleted=1/);
  await expect(page.getByText('Account deleted.')).toBeVisible();

  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  expect(authUser.user).toBeNull();
  for (const table of ['profiles', 'daily_logs', 'user_tasks', 'body_measurements', 'progress_photos', 'push_subscriptions']) {
    const { count } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(table === 'profiles' ? 'id' : 'user_id', user.id);
    expect(count, table).toBe(0);
  }
  const { data: files } = await admin.storage.from('progress').list(user.id);
  expect(files ?? []).toHaveLength(0);

  // Gone means gone: the session is dead and the app bounces to /login.
  await page.goto('/today');
  await expect(page).toHaveURL(/\/login/);
  user = undefined;
});
