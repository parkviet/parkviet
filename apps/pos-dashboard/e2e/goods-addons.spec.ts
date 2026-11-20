import { expect, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';

// Presentation fixtures only, not grants of real API privileges.
type Json = Record<string, unknown>;
type Option = { id: string; name: string; price_delta: string; cost_price: string | null; variant_id: null; default_selected: boolean; position: number; active: boolean };
type Group = { id: string; name: string; min_select: number; max_select: number; allow_quantity: boolean; required: boolean; position: number; options: Option[] };
type Item = { product_id: string; name: string; kind: string; modifier_group_ids: string[] };
const branches = [{ id: 'branch_a', name: 'Chi nhánh Quận 1', code: 'q1', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'sloc_a', receiving_stock_location_id: null }];
// A row of GET /pos/products/settings: a prepared product's operating data.
const item = (id: string, name: string, groups: string[] = [], kind = 'single'): Item => ({ product_id: id, name, product_kind: 'prepared', kind, modifier_group_ids: groups, kitchen_category: null, cup_label: false, show_components_on_kds: true, qr_orderable: true, tax_category_id: null, components: [], drink_credit: null, drink_credit_categories: [], variants: [{ id: `v_${id}`, name: null, sku: null, price: '30000.0' }] } as Item);
const sugar: Group = { id: 'grp_sugar', name: 'Mức đường', min_select: 1, max_select: 1, allow_quantity: false, required: true, position: 0, options: [
  { id: 'opt_half', name: '50%', price_delta: '0.0', cost_price: null, variant_id: null, default_selected: false, position: 0, active: true },
  { id: 'opt_full', name: '100%', price_delta: '0.0', cost_price: null, variant_id: null, default_selected: true, position: 1, active: true },
] };

async function install(page: Page) {
  const groups: Group[] = [structuredClone(sugar)];
  const items: Item[] = [item('prod_tea', 'Trà sữa', ['grp_sugar']), item('prod_coffee', 'Cà phê sữa'), item('prod_combo', 'Combo sáng', [], 'combo')];
  const state = { writes: [] as { method: string; path: string; body: Json | null }[] };
  const saveGroup = (id: string, body: Json): Group => {
    const options = (body.options as Json[]).map((row, position) => ({ id: String(row.id ?? `opt_${id}_${position}`), name: String(row.name), price_delta: String(row.price_delta), cost_price: (row.cost_price as string | null) ?? null, variant_id: null, default_selected: Boolean(row.default_selected), position, active: Boolean(row.active) }));
    return { id, name: String(body.name), min_select: Number(body.min_select), max_select: Number(body.max_select), allow_quantity: Boolean(body.allow_quantity), required: Number(body.min_select) > 0, position: 0, options };
  };
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v3/admin', ''); const method = request.method();
    const body = method === 'GET' || method === 'DELETE' ? null : (request.postDataJSON() as Json);
    if (method !== 'GET') state.writes.push({ method, path, body });
    if (path === '/pos/context') return route.fulfill({ json: { staff: { id: 'staff_admin', full_name: 'Quản trị Hiền' }, store: { id: 'store_1', name: 'Quán Hiền', currency: 'VND' }, administration: { read: true, write: true }, capabilities: [], modules: { 'fnb.menu': true }, branches, registers: [], selection: { branch_id: 'branch_a', register_id: null } } });
    if (path === '/pos/modifier_groups' && method === 'GET') return route.fulfill({ json: { data: groups } });
    if (path === '/pos/modifier_groups' && method === 'POST') { const created = saveGroup('grp_new', body ?? {}); groups.push(created); return route.fulfill({ status: 201, json: { data: created } }); }
    const group = /^\/pos\/modifier_groups\/([^/]+)$/.exec(path);
    if (group) {
      const index = groups.findIndex((row) => row.id === group[1]);
      if (method === 'DELETE') { groups.splice(index, 1); for (const row of items) row.modifier_group_ids = row.modifier_group_ids.filter((id) => id !== group[1]); return route.fulfill({ json: { data: { id: group[1] } } }); }
      groups[index] = saveGroup(group[1], { ...groups[index], ...body });
      return route.fulfill({ json: { data: groups[index] } });
    }
    if (path === '/pos/products/settings') return route.fulfill({ json: { data: items } });
    const product = /^\/pos\/products\/([^/]+)\/modifier_groups$/.exec(path);
    if (product && method === 'PUT') { const row = items.find((entry) => entry.product_id === product[1]); if (row) row.modifier_group_ids = body?.modifier_group_ids as string[]; return route.fulfill({ json: { data: row } }); }
    return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } } });
  });
  await installDashboardShell(page, { authenticated: true });
  await page.route('**/api/v3/admin/me', (route) => route.fulfill({ json: { id: 'staff_admin', email: 'admin@example.test', full_name: 'Quản trị Hiền', selected_locale: 'vi', stores: [{ id: 'store_1', name: 'Quán Hiền', code: 'store_1', default_currency: 'VND' }], permissions: [], permission_keys: ['read_pos_topology', 'write_pos_topology'] } }));
  return state;
}

test('an add-on group with three options is created and offered on a prepared product', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/goods/addons');
  if (test.info().project.name !== 'mobile') await expect(page.locator('[data-sidebar="sidebar"]').first().getByRole('link', { name: 'Nhóm bán kèm', exact: true })).toHaveAttribute('href', '/store_1/goods/addons');
  const sugarCard = page.locator('[data-addon-group="grp_sugar"]');
  await expect(sugarCard).toContainText('Bắt buộc · chọn 1');
  await expect(sugarCard).toContainText('Áp dụng cho 1 sản phẩm');

  await page.getByRole('button', { name: 'Tạo nhóm bán kèm' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog.getByText('Nhập tên nhóm.')).toBeVisible();
  await expect(state.writes).toHaveLength(0);

  await dialog.getByLabel('Tên nhóm').fill('Topping');
  await dialog.getByRole('switch', { name: 'Chọn nhiều tuỳ chọn' }).click();
  await dialog.getByRole('switch', { name: 'Cho tăng số lượng một tuỳ chọn' }).click();
  await dialog.getByLabel('Tối đa (tính cả số lượng)').fill('5');
  const names = dialog.getByLabel('Tên tuỳ chọn');
  const prices = dialog.getByLabel('Giá bán thêm');
  const costs = dialog.getByLabel('Giá vốn');
  await names.nth(0).fill('Trân châu');
  await prices.nth(0).fill('5000');
  await costs.nth(0).fill('1500');
  await dialog.getByRole('button', { name: 'Thêm tuỳ chọn' }).click();
  await names.nth(1).fill('Thạch');
  await prices.nth(1).fill('4000');
  await dialog.getByRole('button', { name: 'Thêm tuỳ chọn' }).click();
  await names.nth(2).fill('Kem cheese');
  await prices.nth(2).fill('8000');
  await dialog.getByRole('checkbox', { name: 'Kem cheese còn hàng' }).uncheck();
  await dialog.getByRole('button', { name: 'Đưa Thạch lên' }).click();

  const preview = dialog.locator('[data-addon-preview]');
  await expect(preview).toContainText('Không bắt buộc · tối đa 5 · được tăng số lượng');
  await expect(preview).toContainText('Thạch');
  await expect(preview).not.toContainText('Kem cheese');
  await expect(preview).toContainText('1 tuỳ chọn hết hàng không hiện ở quầy.');

  // A combo lists its contents, so it is not offered.
  await expect(dialog.getByRole('checkbox', { name: 'Combo sáng' })).toHaveCount(0);
  await dialog.getByRole('checkbox', { name: 'Cà phê sữa' }).check();
  await expect(dialog.getByText('Áp dụng cho 1 sản phẩm')).toBeVisible();
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Đã lưu nhóm Topping.')).toBeVisible();

  expect(state.writes[0]).toEqual({ method: 'POST', path: '/pos/modifier_groups', body: {
    name: 'Topping', min_select: 0, max_select: 5, allow_quantity: true,
    options: [
      { name: 'Thạch', price_delta: '4000', cost_price: null, active: true, default_selected: false, position: 0 },
      { name: 'Trân châu', price_delta: '5000', cost_price: '1500', active: true, default_selected: false, position: 1 },
      { name: 'Kem cheese', price_delta: '8000', cost_price: null, active: false, default_selected: false, position: 2 },
    ],
  } });
  expect(state.writes.slice(1)).toEqual([
    { method: 'PUT', path: '/pos/products/prod_coffee/modifier_groups', body: { modifier_group_ids: ['grp_new'] } },
  ]);
  const card = page.locator('[data-addon-group="grp_new"]');
  await expect(card).toContainText('Áp dụng cho 1 sản phẩm');
  await expect(card.getByRole('list', { name: 'Tuỳ chọn của Topping' })).toContainText('Kem cheese');
});

test('a group is edited and deleted after confirming', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/goods/addons');
  await page.locator('[data-addon-group="grp_sugar"]').getByRole('button', { name: 'Mức đường', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('switch', { name: 'Bắt buộc chọn' })).toBeChecked();
  await dialog.getByRole('checkbox', { name: 'Trà sữa' }).uncheck();
  await dialog.getByRole('checkbox', { name: '50% còn hàng' }).uncheck();
  await expect(dialog.locator('[data-addon-preview]')).toContainText('Bắt buộc · chọn 1');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(state.writes.map((write) => [write.method, write.path])).toEqual([
    ['PATCH', '/pos/modifier_groups/grp_sugar'],
    ['PUT', '/pos/products/prod_tea/modifier_groups'],
  ]);
  expect((state.writes[0].body?.options as Json[])[0]).toMatchObject({ id: 'opt_half', active: false, cost_price: null });

  const card = page.locator('[data-addon-group="grp_sugar"]');
  await expect(card).toContainText('Áp dụng cho 0 sản phẩm');
  await card.getByRole('button', { name: /^(Open actions|Mở menu thao tác)$/ }).click();
  await page.getByRole('menuitem', { name: 'Xoá' }).click();
  await expect(page.getByText('Xoá nhóm Mức đường? Sản phẩm thôi có nhóm này, các đơn đã bán vẫn giữ nguyên.')).toBeVisible();
  await page.getByRole('button', { name: 'Xoá', exact: true }).click();
  await expect(page.getByText('Đã xoá nhóm Mức đường.')).toBeVisible();
  await expect(page.getByText('Chưa có nhóm bán kèm nào.')).toBeVisible();
  expect(state.writes.at(-1)).toMatchObject({ method: 'DELETE', path: '/pos/modifier_groups/grp_sugar' });
});
