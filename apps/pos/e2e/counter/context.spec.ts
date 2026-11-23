import { expect, test } from '@playwright/test';

test('an anonymous visit to an inner page returns to the Vietnamese login screen', async ({ page }) => {
  await page.route('**/api/v3/admin/auth/refresh', (route) =>
    route.fulfill({ status: 401, json: { error: { code: 'unauthorized' } } }),
  );
  await page.goto('/store_1/sell/shifts');
  await expect(page).toHaveURL(/\/login(\?|$)/);
  await expect(page.getByRole('heading', { name: 'Chào mừng trở lại' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).focus();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: /thu tiền|thanh toán|pay/i })).toHaveCount(0);
});
