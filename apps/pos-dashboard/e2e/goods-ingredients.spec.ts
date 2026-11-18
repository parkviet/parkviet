import { expect, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';

// Presentation fixtures only, not grants of real API privileges.
type Json = Record<string, unknown>;
const branches = [
  { id: 'branch_a', name: 'Chi nhánh Quận 1', code: 'q1', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'sloc_a', receiving_stock_location_id: null },
  { id: 'branch_b', name: 'Chi nhánh Thủ Đức', code: 'td', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'sloc_b', receiving_stock_location_id: null },
];
const level = (location: string, count: number) => ({ stock_location_id: location, count_on_hand: count });
function ingredient(id: string, name: string, sku: string, cost: string | null, levels: Json[], extra: Json = {}) {
  return { id, name, status: 'active', default_variant_id: `${id}_v`, product_type_id: 'pt_ingredient', updated_at: '2026-11-18T08:00:00Z', variants: [{ id: `${id}_v`, sku, cost_price: cost, track_inventory: true, options_text: '', stock_levels: levels }], ...extra };
}

async function install(page: Page) {
  const products = [
    ingredient('prod_flour', 'Bột mì', 'NL000001', '20', [level('sloc_a', 500), level('sloc_b', 50)]),
    ingredient('prod_milk', 'Sữa tươi', 'NL000002', '30', [level('sloc_a', -120)]),
    ingredient('prod_sugar', 'Đường', 'NL000003', null, [level('sloc_a', 0)], { status: 'archived' }),
  ];
  const units: Record<string, { code: string; name: string }> = { prod_flour_v: { code: 'g', name: 'Gram' }, prod_milk_v: { code: 'ml', name: 'Mililit' } };
  const alerts = [{ id: 'posstockalert_1', branch_id: 'branch_a', variant_id: 'prod_flour_v', name: 'Bột mì', sku: 'NL000001', options_text: null, base_unit: 'g', min_quantity: 1000, on_hand: 500, low: true }];
  const state = { writes: [] as { method: string; path: string; body: unknown }[], lists: [] as URLSearchParams[], refuseDelete: false };
  const page_ = (data: unknown[]) => ({ data, meta: { page: 1, limit: 100, count: data.length, pages: 1, from: data.length ? 1 : 0, to: data.length, previous: null, next: null } });
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v3/admin', ''); const method = request.method();
    const body = method === 'GET' || method === 'DELETE' ? null : (request.postDataJSON() as Json);
    if (method !== 'GET') state.writes.push({ method, path, body });
    if (path === '/pos/context') return route.fulfill({ json: { staff: { id: 'staff_admin', full_name: 'Quản trị Hiền' }, store: { id: 'store_1', name: 'Siêu thị Hiền', currency: 'VND' }, administration: { read: true, write: true }, capabilities: [], modules: { 'fnb.recipes': true }, branches, registers: [], selection: { branch_id: 'branch_a', register_id: null } } });
    if (path === '/products' && method === 'GET') {
      state.lists.push(url.searchParams);
      return route.fulfill({ json: page_(url.searchParams.get('q[product_type_id_eq]') === 'pt_ingredient' ? products : []) });
    }
    if (path === '/products' && method === 'POST') {
      const variant = (body?.variants as Json[])[0];
      const created = ingredient('prod_new', String(body?.name), String(variant.sku), (variant.cost_price as string | null) ?? null, (variant.stock_levels as Json[]) ?? []);
      products.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    const one = /^\/products\/([^/]+)(\/(archive|activate))?$/.exec(path);
    if (one) {
      const row = products.find((item) => item.id === one[1]);
      if (method === 'DELETE') {
        if (state.refuseDelete) return route.fulfill({ status: 422, json: { error: { code: 'validation_error', message: 'This product is an ingredient of an active recipe. Remove it from the recipe first.', details: { base: ['This product is an ingredient of an active recipe. Remove it from the recipe first.'] } } } });
        products.splice(products.findIndex((item) => item.id === one[1]), 1); return route.fulfill({ status: 204 });
      }
      if (one[3]) Object.assign(row ?? {}, { status: one[3] === 'archive' ? 'archived' : 'active' });
      else if (method === 'PATCH') Object.assign(row ?? {}, { name: body?.name });
      return route.fulfill({ json: row });
    }
    if (path === '/product_types') return route.fulfill({ json: page_([{ id: 'pt_goods', name: 'Hàng hoá' }, { id: 'pt_service', name: 'Dịch vụ' }, { id: 'pt_ingredient', name: 'Nguyên liệu' }]) });
    if (path === '/variants') return route.fulfill({ json: page_(url.searchParams.get('q[sku_eq]') ? [] : [{ sku: 'NL000003' }]) });
    if (path === '/pos/units/variants') return route.fulfill({ json: { data: (url.searchParams.get('variant_ids') ?? '').split(',').filter((id) => units[id]).map((id) => ({ variant_id: id, sale_unit: units[id].code, sale_unit_name: units[id].name })) } });
    if (path === '/pos/units/variant') { units[String(body?.variant_id)] = { code: String(body?.sale_unit), name: String(body?.sale_unit) }; return route.fulfill({ json: { data: {} } }); }
    if (path === '/pos/units') return route.fulfill({ json: { data: ['item', 'g', 'ml', 'chai'].map((code) => ({ id: `u_${code}`, code, name: code, dimension: 'mass', base_code: code, status: 'active' })).concat([{ id: 'u_kg', code: 'kg', name: 'Kilogram', dimension: 'mass', base_code: 'g', status: 'active' }]) } });
    if (path === '/pos/stock_alerts' && method === 'GET') return route.fulfill({ json: { data: url.searchParams.get('branch_id') === 'branch_a' ? alerts : [] } });
    if (path === '/pos/stock_alerts') { alerts.push({ ...alerts[0], id: 'posstockalert_2', variant_id: String(body?.variant_id), min_quantity: Number(body?.min_quantity) }); return route.fulfill({ json: { data: alerts } }); }
    return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } } });
  });
  await installDashboardShell(page, { authenticated: true });
  // The catalog keys this screen is gated on, beside the shell's topology keys.
  await page.route('**/api/v3/admin/me', (route) => route.fulfill({ json: { id: 'staff_admin', email: 'admin@example.test', full_name: 'Quản trị Hiền', selected_locale: 'vi', stores: [{ id: 'store_1', name: 'Siêu thị Hiền', code: 'store_1', default_currency: 'VND' }], permissions: [], permission_keys: ['read_pos_topology', 'write_pos_topology', 'read_products', 'write_products', 'read_product_types', 'write_product_types'] } }));
  return state;
}
const MENU = /^(Open actions|Mở menu thao tác)$/;
const rowNamed = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

test('the ingredients list shows branch stock, value, thresholds and negative stock', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/ingredients');
  await expect(page.locator('[data-sidebar="sidebar"]').first().getByRole('link', { name: 'Nguyên liệu', exact: true })).toHaveAttribute('href', '/store_1/goods/ingredients');
  const flour = rowNamed(page, 'Bột mì');
  await expect(flour).toContainText('NL000001');
  await expect(flour).toContainText('Gram');
  await expect(flour).toContainText('10.000 ₫');
  await expect(flour).toContainText('Dưới mức cảnh báo');
  await expect(flour).toContainText('1000');
  const milk = rowNamed(page, 'Sữa tươi');
  await expect(milk.locator('[data-negative]')).toHaveText('-120');
  await expect(milk).toContainText('Hết hàng');
  await expect(milk).toContainText('Tồn âm, hãy kiểm kho lại.');
  await expect(milk).toContainText('Chưa đặt');
  await expect(rowNamed(page, 'Đường')).toContainText('Ngừng kinh doanh');
  expect(state.lists[0].get('q[product_type_id_eq]')).toBe('pt_ingredient');
  expect(state.lists[0].get('expand')).toContain('variants.stock_levels');

  await page.getByPlaceholder('Mã hoặc tên nguyên liệu…').fill('NL000002');
  await expect(rowNamed(page, 'Bột mì')).toHaveCount(0);
  await expect(rowNamed(page, 'Sữa tươi')).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('creating an ingredient sets opening stock, the unit and the threshold, then starts another', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/ingredients');
  await page.getByRole('button', { name: 'Thêm nguyên liệu' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Tên nguyên liệu').fill('Bơ lạt');
  await sheet.getByRole('button', { name: 'ml', exact: true }).click();
  await sheet.getByLabel('Giá vốn / ml').fill('150');
  await sheet.getByLabel('Mức cảnh báo tồn thấp').fill('200');
  await sheet.getByLabel('Tồn đầu kỳ – Chi nhánh Quận 1 (ml)').fill('750');
  await sheet.getByRole('button', { name: 'Lưu và tạo tiếp' }).click();
  await expect(sheet.getByRole('status').filter({ hasText: 'Đã tạo Bơ lạt.' })).toBeVisible();
  await expect(sheet.getByLabel('Tên nguyên liệu')).toHaveValue('');
  const create = state.writes.find((write) => write.path === '/products' && write.method === 'POST');
  expect(create?.body).toEqual({
    name: 'Bơ lạt', status: 'active', product_type_id: 'pt_ingredient',
    variants: [{ sku: 'NL000004', cost_price: '150', cost_currency: 'VND', track_inventory: true, stock_levels: [{ stock_location_id: 'sloc_a', count_on_hand: 750 }, { stock_location_id: 'sloc_b', count_on_hand: 0 }] }],
  });
  expect(JSON.stringify(create?.body)).not.toContain('product_publications');
  expect(state.writes.find((write) => write.path === '/pos/units/variant')?.body).toEqual({ variant_id: 'prod_new_v', sale_unit: 'ml' });
  expect(state.writes.find((write) => write.path === '/pos/stock_alerts')?.body).toEqual({ branch_id: 'branch_a', variant_id: 'prod_new_v', min_quantity: 200 });
  await sheet.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(rowNamed(page, 'Bơ lạt')).toContainText('750');
});

test('a new ingredient needs a name and a unit', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/ingredients');
  await page.getByRole('button', { name: 'Thêm nguyên liệu' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Mức cảnh báo tồn thấp').fill('1,5');
  await sheet.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(sheet.getByText('Nhập tên nguyên liệu (tối đa 255 ký tự).')).toBeVisible();
  await expect(sheet.getByText('Mức cảnh báo là số nguyên không âm, tối đa 9 chữ số.')).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('editing patches without stock levels, and stop, resume and delete go through the server', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/ingredients');
  await rowNamed(page, 'Bột mì').getByRole('button', { name: MENU }).click();
  await page.getByRole('menuitem', { name: 'Chỉnh sửa', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByLabel('Mức cảnh báo tồn thấp')).toHaveValue('1000');
  await expect(sheet.getByText('Tồn đầu kỳ', { exact: true })).toHaveCount(0);
  await sheet.getByLabel('Tên nguyên liệu').fill('Bột mì số 8');
  await sheet.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  const patch = state.writes.find((write) => write.method === 'PATCH');
  expect(patch).toEqual({ method: 'PATCH', path: '/products/prod_flour', body: { name: 'Bột mì số 8', variants: [{ id: 'prod_flour_v', sku: 'NL000001', cost_price: '20', cost_currency: 'VND' }] } });
  expect(state.writes.filter((write) => write.path.startsWith('/pos/'))).toEqual([]);

  await rowNamed(page, 'Sữa tươi').getByRole('button', { name: MENU }).click();
  await page.getByRole('menuitem', { name: 'Ngừng kinh doanh', exact: true }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Ngừng kinh doanh', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã ngừng kinh doanh Sữa tươi.' })).toBeVisible();
  expect(state.writes.map((write) => write.path)).toContain('/products/prod_milk/archive');

  state.refuseDelete = true;
  await rowNamed(page, 'Đường').getByRole('button', { name: MENU }).click();
  await page.getByRole('menuitem', { name: 'Xoá', exact: true }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Xoá', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Không xoá được Đường.' })).toContainText('ingredient of an active recipe');
  await expect(rowNamed(page, 'Đường')).toBeVisible();
});
