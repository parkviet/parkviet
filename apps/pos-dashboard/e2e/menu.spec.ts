import { expect, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';

// Presentation fixtures only, not grants of real API privileges.
type Json = Record<string, unknown>;
type Component = { id: string; variant_id: string; name: string; quantity: number };
const branches = [{ id: 'branch_a', name: 'Chi nhánh Quận 1', code: 'q1', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'sloc_a', receiving_stock_location_id: null }];
// A row of GET /pos/products/settings: a prepared product's operating data.
const config = (id: string, name: string, groups: string[] = [], components: Component[] = []) => ({ product_id: id, name, product_kind: 'prepared', kind: components.length > 0 ? 'combo' : 'single', kitchen_category: 'do_uong', cup_label: false, show_components_on_kds: true, qr_orderable: true, drink_credit: null, drink_credit_categories: [], tax_category_id: null, modifier_group_ids: groups, components, variants: [{ id: `v_${id}`, name: null, sku: null, price: '30000.0' }] });

async function install(page: Page) {
  const settings = [
    config('prod_tea', 'Trà sữa'),
    config('prod_coffee', 'Cà phê sữa', ['grp_sugar']),
    config('prod_combo', 'Combo sáng', [], [{ id: 'poscombo_1', variant_id: 'v_prod_tea', name: 'Trà sữa', quantity: 1 }]),
  ];
  const state = { writes: [] as { method: string; path: string; body: Json | null }[] };
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v3/admin', ''); const method = request.method();
    const body = method === 'GET' || method === 'DELETE' ? null : (request.postDataJSON() as Json);
    if (method !== 'GET') state.writes.push({ method, path, body });
    if (path === '/pos/context') return route.fulfill({ json: { staff: { id: 'staff_admin', full_name: 'Quản trị Hiền' }, store: { id: 'store_1', name: 'Quán Hiền', currency: 'VND' }, administration: { read: true, write: true }, capabilities: [], modules: { 'fnb.menu': true }, branches, registers: [], selection: { branch_id: 'branch_a', register_id: null } } });
    if (path === '/pos/products/settings') return route.fulfill({ json: { data: settings, meta: { tax_defaults: { food: null, alcohol: null } } } });
    const product = /^\/pos\/products\/([^/]+)\/(combo|modifier_groups)$/.exec(path);
    if (product && method === 'PUT') {
      const row = settings.find((entry) => entry.product_id === product[1]);
      if (row && product[2] === 'combo') { row.components = ((body?.components as { variant_id: string; quantity: number }[]) ?? []).map((part, index) => ({ id: `poscombo_new_${index}`, variant_id: part.variant_id, name: 'Trà sữa', quantity: part.quantity })); row.kind = row.components.length > 0 ? 'combo' : 'single'; }
      if (row && product[2] === 'modifier_groups') row.modifier_group_ids = body?.modifier_group_ids as string[];
      return route.fulfill({ json: { data: row } });
    }
    if (path === '/pos/menu') return route.fulfill({ json: { data: { branch_id: 'branch_a', currency: 'VND', business_date: '2026-11-20', module_enabled: true, categories: [{ id: 'ctg_drinks', name: 'Đồ uống', position: 0, parent_id: null }], items: settings.map((row) => ({ ...row, category_ids: ['ctg_drinks'], image_url: null, sold_out: false, variants: [{ id: `v_${row.product_id}`, name: row.name, sku: null, barcode: null, price: '30000.0', list_price: '30000.0', schedule_id: null }] })), modifier_groups: [], schedules: [], favorites: [], etag: 'e1' } } });
    if (path === '/pos/catalog') return route.fulfill({ json: { data: [{ id: 'v_prod_tea', product_id: 'prod_tea', name: 'Trà sữa' }], meta: { page: 1, pages: 1, count: 1, ambiguous: false } } });
    if (path === '/pos/menu_favorites') return route.fulfill({ json: { data: { branch_id: 'branch_a', product_ids: body?.product_ids } } });
    if (path === '/pos/menu_availabilities') return route.fulfill({ json: { data: { branch_id: 'branch_a', product_id: body?.product_id, sold_out: body?.sold_out } } });
    return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } } });
  });
  await installDashboardShell(page, { authenticated: true });
  await page.route('**/api/v3/admin/me', (route) => route.fulfill({ json: { id: 'staff_admin', email: 'admin@example.test', full_name: 'Quản trị Hiền', selected_locale: 'vi', stores: [{ id: 'store_1', name: 'Quán Hiền', code: 'store_1', default_currency: 'VND' }], permissions: [], permission_keys: ['read_pos_topology', 'write_pos_topology'] } }));
  return state;
}

test('favourites and sold-out marks are set by product at the selected branch', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/menu');
  // Products, categories and add-on groups are managed in Goods.
  await expect(page.getByRole('link', { name: 'Mở Hàng hoá' })).toHaveAttribute('href', '/store_1/goods/products');
  await expect(page.getByRole('button', { name: 'Thêm món' })).toHaveCount(0);
  const tea = page.getByRole('listitem').filter({ hasText: /^Trà sữa/ }).filter({ has: page.getByRole('button', { name: 'Báo hết' }) });
  await tea.getByRole('button', { name: 'Thêm vào món yêu thích' }).click();
  await tea.getByRole('button', { name: 'Báo hết' }).click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes).toEqual([
    { method: 'PUT', path: '/pos/menu_favorites', body: { branch_id: 'branch_a', product_ids: ['prod_tea'] } },
    { method: 'PUT', path: '/pos/menu_availabilities', body: { branch_id: 'branch_a', product_id: 'prod_tea', sold_out: true } },
  ]);
});

test('a prepared product becomes a combo without its add-on groups, and a combo goes back to single', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/menu');
  await expect(page.getByRole('link', { name: 'Combo sáng' })).toHaveAttribute('href', '/store_1/goods/products/prod_combo');

  await page.getByRole('button', { name: 'Thêm combo' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Sản phẩm bán thành combo').click();
  await page.getByRole('option', { name: 'Cà phê sữa', exact: true }).click();
  // Without contents there is nothing to save yet.
  await expect(dialog.getByRole('button', { name: 'Lưu', exact: true })).toBeDisabled();
  await dialog.getByLabel('Thêm thành phần').fill('tra');
  await dialog.getByRole('button', { name: 'Tìm', exact: true }).click();
  await dialog.getByRole('button', { name: 'Trà sữa', exact: true }).click();
  await dialog.getByLabel('Số lượng').fill('2');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(state.writes).toEqual([
    { method: 'PUT', path: '/pos/products/prod_coffee/modifier_groups', body: { modifier_group_ids: [] } },
    { method: 'PUT', path: '/pos/products/prod_coffee/combo', body: { components: [{ variant_id: 'v_prod_tea', quantity: 2 }] } },
  ]);

  await page.getByRole('listitem').filter({ hasText: /^Combo sáng/ }).getByRole('button', { name: 'Bỏ combo' }).first().click();
  await expect(page.getByText('Bỏ combo Combo sáng? Sản phẩm thành món lẻ, các đơn đã bán vẫn giữ nguyên.')).toBeVisible();
  await page.getByRole('button', { name: 'Bỏ combo', exact: true }).last().click();
  await expect.poll(() => state.writes.length).toBe(3);
  expect(state.writes.at(-1)).toEqual({ method: 'PUT', path: '/pos/products/prod_combo/combo', body: { components: [] } });
});
