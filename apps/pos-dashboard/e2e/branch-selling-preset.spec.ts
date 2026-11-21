import { expect, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';

async function install(page: Page, options: { tables: boolean; write?: boolean; preset?: string | null }) {
  const state = { preset: options.preset ?? null, writes: [] as { path: string; body: Record<string, unknown> }[] };
  const modules = { 'fnb.tables': options.tables };
  await page.route('**/api/v3/admin/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v3/admin', '');
    const branch = () => ({ id: 'br_1', name: 'Chi nhánh chính', code: 'main', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'stock_1', selling_preset: state.preset });
    if (path === '/pos/context') return route.fulfill({ json: { staff: { id: 'staff_admin', full_name: 'Quản trị Hiền' }, store: { id: 'store_1', name: 'Siêu thị Hiền', currency: 'VND' }, administration: { read: true, write: options.write !== false }, capabilities: [], branches: [branch()], registers: [], modules, selection: { branch_id: url.searchParams.get('branch_id'), register_id: null }, onboarding: { required: false, can_setup: true } } });
    if (path === '/pos/branches' || path === '/pos/context/branches') return route.fulfill({ json: { data: [branch()], meta: { next: null } } });
    if (path === '/pos/branches/br_1' && route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.writes.push({ path, body });
      state.preset = (body.selling_preset as string) || null;
      return route.fulfill({ json: branch() });
    }
    return route.fulfill({ json: { data: [], meta: { next: null } } });
  });
  await installDashboardShell(page, { authenticated: true, write: options.write !== false });
  await page.goto('/store_1/branches/br_1/features');
  return state;
}

const card = (page: Page) => page.getByRole('region', { name: 'Màn bán hàng mặc định' });

test('administrator picks the branch default selling screen and clears it', async ({ page }) => {
  const state = await install(page, { tables: true });
  const group = card(page).getByRole('group', { name: 'Màn bán hàng mặc định' });
  await expect(group.getByRole('radio', { name: /Tự động theo chức năng/ })).toBeChecked();
  await group.getByText('Chọn nhanh, tính tiền sau').click();
  await expect(group.getByRole('radio', { name: /Chọn nhanh, tính tiền sau/ })).toBeChecked();
  await expect(card(page).getByRole('status')).toBeVisible();
  await group.getByText('Tự động theo chức năng').click();
  await expect(group.getByRole('radio', { name: /Tự động theo chức năng/ })).toBeChecked();
  expect(state.writes.map((write) => write.body)).toEqual([{ selling_preset: 'quick' }, { selling_preset: '' }]);
});

test('the saved default is checked on load', async ({ page }) => {
  await install(page, { tables: true, preset: 'big_menu' });
  await expect(card(page).getByRole('radio', { name: /Menu lớn, chạm dễ/ })).toBeChecked();
});

test('tables first is locked while the branch has no tables module', async ({ page }) => {
  const state = await install(page, { tables: false });
  await expect(card(page).getByRole('radio', { name: /Bàn trước, gọi món sau/ })).toBeDisabled();
  await expect(card(page).getByText('Cần bật chức năng Bàn cho chi nhánh này.')).toBeVisible();
  await expect(card(page).getByRole('radio', { name: /Bán & thanh toán một màn/ })).toBeEnabled();
  expect(state.writes).toEqual([]);
});

test('a reader cannot change the default', async ({ page }) => {
  const state = await install(page, { tables: true, write: false });
  for (const radio of await card(page).getByRole('radio').all()) await expect(radio).toBeDisabled();
  expect(state.writes).toEqual([]);
});
