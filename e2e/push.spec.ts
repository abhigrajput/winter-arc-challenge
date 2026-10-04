import { expect, test, type Page } from '@playwright/test';
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { adminClient, createOnboardedUser, deleteTestUser, type TestUser } from './support';
import { signIn } from './auth';
import { localClock } from '../lib/reminders/due';

/**
 * Phase 14 push flow. Headless Chromium has no push service, so the browser
 * side (Notification permission + PushManager) is mocked; everything from the
 * subscribe API onward is real: the database rows, the cron route, dedupe,
 * and real push services answering for dead subscriptions.
 */

const admin = adminClient();
let user: (TestUser & { username: string }) | undefined;

test.afterEach(async () => {
  await deleteTestUser(admin, user);
  user = undefined;
});

/** A syntactically valid P-256 key + auth secret, so web-push can encrypt. */
function fakeKeys() {
  const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' });
  const p256dh = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(jwk.x!, 'base64url'),
    Buffer.from(jwk.y!, 'base64url'),
  ]).toString('base64url');
  return { p256dh, auth: randomBytes(16).toString('base64url') };
}

/** Grants notification permission and fakes PushManager for one page. */
async function mockPush(page: Page, endpoint: string, keys: { p256dh: string; auth: string }) {
  await page.addInitScript(
    ({ endpoint, keys }) => {
      let permission: NotificationPermission = 'default';
      Object.defineProperty(Notification, 'permission', { get: () => permission });
      Notification.requestPermission = async () => {
        permission = 'granted';
        return permission;
      };

      let current: PushSubscription | null = null;
      const make = () =>
        ({
          endpoint,
          expirationTime: null,
          options: { userVisibleOnly: true, applicationServerKey: null },
          getKey: () => null,
          toJSON: () => ({ endpoint, expirationTime: null, keys }),
          unsubscribe: async () => {
            current = null;
            return true;
          },
        }) as unknown as PushSubscription;

      PushManager.prototype.subscribe = async function () {
        current = make();
        return current;
      };
      PushManager.prototype.getSubscription = async function () {
        return current;
      };
    },
    { endpoint, keys },
  );
}

async function subscriptionsOf(userId: string) {
  const { data } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth, user_agent').eq('user_id', userId);
  return data ?? [];
}

test('subscribe, save reminders, send test, unsubscribe', async ({ page }) => {
  user = await createOnboardedUser(admin, 'push');
  const endpoint = `https://push.e2e.invalid/sub/${randomBytes(6).toString('hex')}`;
  const keys = fakeKeys();
  await mockPush(page, endpoint, keys);
  await signIn(page, user, /\/today/);

  await page.goto('/settings');
  const panel = page.getByTestId('push-panel');
  await expect(panel).toHaveAttribute('data-status', 'off');

  await page.getByRole('button', { name: 'Turn on notifications' }).click();
  await expect(panel).toHaveAttribute('data-status', 'on');
  await expect(page.getByText('Notifications on for this device.')).toBeVisible();
  await expect.poll(() => subscriptionsOf(user!.id)).toEqual([
    expect.objectContaining({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
  ]);

  // Reminder preferences: water on, workout moved.
  await page.locator('#water_enabled').check();
  await page.getByLabel('Workout time').fill('07:15');
  await page.getByRole('button', { name: 'Save reminders' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  const { data: row } = await admin.from('reminder_settings').select('settings').eq('user_id', user.id).single();
  expect(row?.settings).toMatchObject({ water: { enabled: true }, workout: { enabled: true, time: '07:15' } });

  // The test push goes to a host that does not exist: reported, row kept.
  await page.getByRole('button', { name: 'Send test' }).click();
  await expect(page.getByText('No device accepted it.')).toBeVisible();
  expect(await subscriptionsOf(user.id)).toHaveLength(1);

  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(panel).toHaveAttribute('data-status', 'off');
  await expect.poll(() => subscriptionsOf(user!.id)).toEqual([]);
});

test('iOS Safari gets Add to Home Screen steps instead of an enable button', async ({ browser }) => {
  user = await createOnboardedUser(admin, 'ios');
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  });
  try {
    const page = await context.newPage();
    // Safari outside the Home Screen has no PushManager at all.
    await page.addInitScript(() => {
      // @ts-expect-error -- simulating Safari, where these do not exist
      delete window.PushManager;
    });
    await signIn(page, user, /\/today/);

    await expect(page.getByTestId('install-prompt')).toBeVisible();
    await expect(page.getByTestId('install-prompt').getByText('Add Winter Arc to your Home Screen first.')).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByTestId('push-panel')).toHaveAttribute('data-status', 'support');
    await expect(page.getByTestId('ios-install-steps')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turn on notifications' })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test.describe('cron route', () => {
  const secret = process.env.CRON_SECRET;
  test.skip(!secret, 'CRON_SECRET not set');

  test('rejects calls without the secret', async ({ request }) => {
    expect((await request.post('/api/cron/reminders')).status()).toBe(401);
    expect(
      (await request.post('/api/cron/reminders', { headers: { authorization: 'Bearer wrong' } })).status(),
    ).toBe(401);
  });

  test('sends a due reminder once, and deletes subscriptions the push service rejects', async ({ request }) => {
    test.slow();
    user = await createOnboardedUser(admin, 'cron');
    // Don't start in the last 90 s of a 15-minute window: the requests below
    // must land in the same window the reminder time was picked from.
    const secondsIntoWindow = (Date.now() / 1000) % (15 * 60);
    if (secondsIntoWindow > 15 * 60 - 90) {
      await new Promise((resolve) => setTimeout(resolve, (15 * 60 - secondsIntoWindow + 5) * 1000));
    }
    const clock = localClock(new Date(), 'Asia/Kolkata');
    const hh = String(Math.floor(clock.windowStart / 60)).padStart(2, '0');
    const mm = String(clock.windowStart % 60).padStart(2, '0');

    // Only "wake" is on, due right now in the user's timezone.
    await admin.from('reminder_settings').upsert({
      user_id: user.id,
      settings: {
        wake: { enabled: true, time: `${hh}:${mm}` },
        workout: { enabled: false, time: '18:00' },
        water: { enabled: false },
        skincare_pm: { enabled: false, time: '21:30' },
        wind_down: { enabled: false, time: '22:00' },
        streak_risk: { enabled: false },
      },
    });

    // Two devices: one the push service says is gone (Mozilla answers 404 for
    // an unknown token), one on a host that does not resolve (transient).
    const gone = `https://updates.push.services.mozilla.com/wpush/v2/e2e-${randomBytes(8).toString('hex')}`;
    const flaky = `https://push.e2e.invalid/sub/${randomBytes(6).toString('hex')}`;
    const { error } = await admin.from('push_subscriptions').insert([
      { user_id: user.id, endpoint: gone, ...fakeKeys() },
      { user_id: user.id, endpoint: flaky, ...fakeKeys() },
    ]);
    expect(error).toBeNull();

    const headers = { authorization: `Bearer ${secret}` };
    const first = await request.post('/api/cron/reminders', { headers });
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true });

    const { data: log } = await admin.from('reminder_log').select('kind, local_date').eq('user_id', user.id);
    expect(log).toEqual([{ kind: 'wake', local_date: clock.date }]);

    // 404 from the push service → deleted. DNS failure → kept.
    const remaining = (await subscriptionsOf(user.id)).map((s) => s.endpoint);
    expect(remaining).toEqual([flaky]);

    // A second run in the same window sends nothing new.
    const second = await request.post('/api/cron/reminders', { headers });
    expect(second.status()).toBe(200);
    const { data: logAgain } = await admin.from('reminder_log').select('kind').eq('user_id', user.id);
    expect(logAgain).toHaveLength(1);
  });
});
