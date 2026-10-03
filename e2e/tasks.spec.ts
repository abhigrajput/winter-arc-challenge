import { expect, test } from '@playwright/test';
import { adminClient, createOnboardedUser, deleteTestUser, type TestUser } from './support';
import { signIn } from './auth';

const admin = adminClient();
let user: TestUser | undefined;

test.afterEach(async () => {
  await deleteTestUser(admin, user);
  user = undefined;
});

test('custom task target "2,5" is saved as 2.5', async ({ page }) => {
  user = await createOnboardedUser(admin, 'task');
  await signIn(page, user, /\/today/);

  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Add a task' }).click();
  await page.locator('#title').fill('E2E water walk');
  await page.locator('#unit').selectOption('km');

  const target = page.locator('#target');
  await expect(target).toHaveAttribute('type', 'text');
  await expect(target).toHaveAttribute('inputmode', 'decimal');
  await target.fill('');
  await target.pressSequentially('2,5');
  await expect(target).toHaveValue('2,5');

  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('E2E water walk')).toBeVisible();

  await expect
    .poll(async () => {
      const { data } = await admin
        .from('user_tasks')
        .select('target, unit, is_custom')
        .eq('user_id', user!.id)
        .eq('title', 'E2E water walk')
        .maybeSingle();
      return data;
    })
    .toEqual({ target: 2.5, unit: 'km', is_custom: true });
});
