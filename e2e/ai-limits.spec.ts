import { expect, test } from '@playwright/test';
import { adminClient, createOnboardedUser, deleteTestUser, type TestUser } from './support';
import { signIn } from './auth';

/**
 * §8.9 server-side AI rate limits, against the real routes. The user's quota
 * is pre-filled in ai_usage, so every call must be refused with 429 before
 * the model is ever called (no AI spend). Signed-out calls must get 401.
 */

const admin = adminClient();
let user: (TestUser & { username: string }) | undefined;

test.afterEach(async () => {
  await deleteTestUser(admin, user);
  user = undefined;
});

const CALLS = [
  { path: '/api/ai/plan', body: { type: 'workout', week: 1 }, route: 'ai/plan:workout', max: 3 },
  { path: '/api/ai/plan', body: { type: 'diet', week: 1 }, route: 'ai/plan:diet', max: 3 },
  { path: '/api/ai/plan', body: { type: 'skincare', week: 1 }, route: 'ai/plan:skincare', max: 3 },
  { path: '/api/ai/checkin', body: { notes: 'limit probe' }, route: 'ai/checkin', max: 1 },
  { path: '/api/ai/meal-estimate', body: { description: '2 roti, dal' }, route: 'ai/meal-estimate', max: 30 },
] as const;

test('every AI route refuses signed-out callers', async ({ playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL });
  for (const call of CALLS) {
    const res = await anon.post(call.path, { data: call.body });
    expect(res.status(), call.path).toBe(401);
  }
  await anon.dispose();
});

test('every AI route returns 429 once the quota is used up', async ({ page }) => {
  user = await createOnboardedUser(admin, 'ailimit');
  const rows = CALLS.flatMap((call) => Array.from({ length: call.max }, () => ({ user_id: user!.id, route: call.route })));
  const { error } = await admin.from('ai_usage').insert(rows);
  expect(error).toBeNull();

  await signIn(page, user, /\/today/);
  for (const call of CALLS) {
    const res = await page.request.post(call.path, { data: call.body });
    expect(res.status(), `${call.path} ${call.route}`).toBe(429);
    expect((await res.json()).error).toMatch(/Limit reached/);
  }

  // Refusals are not charged: the quota rows are exactly what was seeded.
  const { count } = await admin.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  expect(count).toBe(rows.length);
});
