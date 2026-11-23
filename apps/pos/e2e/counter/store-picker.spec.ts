import { expect, type Page, test } from '@playwright/test';

const stores = [
  { id: 'st_retail', name: 'Bán lẻ', code: 'retail' },
  { id: 'st_food', name: 'Nhà hàng', code: 'food' },
];

async function mockApi(page: Page, stores: { id: string; name: string; code: string }[]) {
  const contextStores: (string | undefined)[] = [];
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const storeId = request.headers()['x-spree-store-id'];
    const store = stores.find((item) => item.id === storeId) ?? { id: 'st_default', name: 'Mặc định' };
    if (path.endsWith('/auth/login') || path.endsWith('/auth/refresh')) return route.fulfill({ json: { token: 'test-token' } });
    if (path.endsWith('/me')) return route.fulfill({ json: { user: { email: 'staff@example.test', full_name: 'Lan', stores } } });
    if (path.endsWith('/pos/context/branches')) return route.fulfill({ json: { data: [{ id: `br_${store.id}`, name: `Chi nhánh ${store.name}`, status: 'active' }], meta: { page: 1, pages: 1, count: 1 } } });
    if (path.endsWith('/pos/context/registers')) return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0 } } });
    if (path.endsWith('/pos/context')) {
      contextStores.push(storeId);
      return route.fulfill({ json: {
        staff: { id: 'stf_1', email: 'staff@example.test', full_name: 'Lan' },
        store: { id: store.id, name: store.name, currency: 'VND', locale: 'vi', timezone: 'Asia/Ho_Chi_Minh' },
        capabilities: [],
        branches: [{ id: `br_${store.id}`, name: `Chi nhánh ${store.name}`, status: 'active' }],
        registers: [],
        shift: null,
        selection: { branch_id: url.searchParams.get('branch_id'), register_id: null },
      } });
    }
    return route.fulfill({ status: 404, json: { error: { code: 'missing' } } });
  });
  return contextStores;
}

async function signIn(page: Page, redirect = '/pos') {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.locator('input[type="email"]').fill('staff@example.test');
  await page.locator('input[type="password"]').fill('password');
  await page.locator('button[type="submit"]').click();
}

test('a cashier of several stores picks the store the register sells for', async ({ page }) => {
  const contextStores = await mockApi(page, stores);
  await signIn(page, '/pos?store=st_food');

  await page.locator('.pos-context-details > summary').click();
  await expect(page.locator('.context-store')).toContainText('Nhà hàng');
  expect(contextStores.length).toBeGreaterThan(0);
  expect(new Set(contextStores)).toEqual(new Set(['st_food']));
  await expect(page.getByRole('button', { name: 'Đổi cửa hàng' })).toBeVisible();

  contextStores.length = 0;
  await page.goto('/pos?store=st_retail');
  await page.locator('.pos-context-details > summary').click();
  await expect(page.locator('.context-store')).toContainText('Bán lẻ');
  expect(new Set(contextStores)).toEqual(new Set(['st_retail']));

  contextStores.length = 0;
  await page.reload();
  await page.locator('.pos-context-details > summary').click();
  await expect(page.locator('.context-store')).toContainText('Bán lẻ');
  expect(new Set(contextStores)).toEqual(new Set(['st_retail']));
});

test('a cashier of a single store never sees the store picker', async ({ page }) => {
  await mockApi(page, stores.slice(0, 1));
  await signIn(page);
  await expect(page.locator('.pos-context-details > summary')).toContainText('Bán lẻ');
  await page.locator('.pos-context-details > summary').click();
  await expect(page.getByRole('button', { name: 'Đổi cửa hàng' })).toHaveCount(0);
});
