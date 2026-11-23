import { expect, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';

// Presentation fixtures only, not grants of real API privileges.
type Json = Record<string, unknown>;
const branches = [
  { id: 'branch_a', name: 'Chi nhánh Quận 1', code: 'q1', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'sloc_a', receiving_stock_location_id: null },
  { id: 'branch_b', name: 'Chi nhánh Thủ Đức', code: 'td', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'sloc_b', receiving_stock_location_id: null },
];
const level = (location: string, count: number) => ({ stock_location_id: location, count_on_hand: count });
const variant = (id: string, sku: string, extra: Json = {}) => ({ id, sku, barcode: `893${sku.replace(/\D/g, '')}`, cost_price: '9000', track_inventory: true, options_text: '', price: { amount: '25000', currency: 'VND' }, stock_levels: [level('sloc_a', 5)], ...extra });
function product(id: string, name: string, extra: Json = {}) {
  return { id, name, status: 'active', in_stock: true, thumbnail_url: null, default_variant_id: `${id}_v`, price: { amount: '25000', currency: 'VND' }, product_type_id: 'pt_goods', tax_category_id: 'taxcat_vat', total_on_hand: 5, metadata: {}, description: null, updated_at: '2026-11-18T08:00:00Z', categories: [], media: [], channels: [{ id: 'ch_pos', code: 'pos' }], variants: [variant(`${id}_v`, 'SP000001')], ...extra };
}

async function install(page: Page, options: { posChannel?: boolean; write?: boolean } = {}) {
  const write = options.write !== false;
  const channels = options.posChannel === false ? [] : [{ id: 'ch_pos', code: 'pos', name: 'POS', active: true }];
  const products = [
    product('prod_tea', 'Trà đào'),
    product('prod_coffee', 'Cà phê', {
      default_variant_id: 'prod_coffee_master',
      variants: [
        variant('prod_coffee_s', 'CF-S', { options_text: 'Size: S', price: { amount: '20000' }, stock_levels: [level('sloc_a', 3)] }),
        variant('prod_coffee_l', 'CF-L', { options_text: 'Size: L', price: { amount: '35000' }, stock_levels: [level('sloc_b', -8)] }),
      ],
    }),
  ];
  const unpublished = [product('prod_rice', 'Gạo thơm', { channels: [] })];
  const state = { writes: [] as { method: string; path: string; body: unknown }[], lists: [] as URLSearchParams[], refuseCreate: false };
  const page_ = (data: unknown[]) => ({ data, meta: { page: 1, limit: 25, count: data.length, pages: 1, from: data.length ? 1 : 0, to: data.length, previous: null, next: null } });
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v3/admin', ''); const method = request.method();
    const body = method === 'GET' || method === 'DELETE' ? null : (request.postDataJSON() as Json);
    if (method !== 'GET') state.writes.push({ method, path, body });
    if (path === '/pos/context') return route.fulfill({ json: { staff: { id: 'staff_admin', full_name: 'Quản trị Hiền' }, store: { id: 'store_1', name: 'Siêu thị Hiền', currency: 'VND' }, administration: { read: true, write: true }, capabilities: [], branches, registers: [], selection: { branch_id: 'branch_a', register_id: null } } });
    if (path === '/products' && method === 'GET') {
      state.lists.push(url.searchParams);
      const term = url.searchParams.get('q[search_with_barcode]');
      const rows = url.searchParams.get('q[not_in_channel]') === 'pos' ? unpublished : products;
      return route.fulfill({ json: page_(term ? rows.filter((row) => JSON.stringify(row).includes(term)) : rows) });
    }
    if (path === '/products' && method === 'POST') {
      if (state.refuseCreate) return route.fulfill({ status: 422, json: { error: { code: 'validation_error', message: 'Name has already been taken', details: { name: ['has already been taken'] } } } });
      const created = product('prod_new', String(body?.name), { variants: [variant('prod_new_v', 'SP000008')], channels: [{ id: 'ch_pos', code: 'pos' }] });
      products.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    // The server skips a product it refuses (on orders, a recipe ingredient) and counts the rest.
    if (path === '/products/bulk_destroy') return route.fulfill({ json: { product_count: 1 } });
    const one = /^\/products\/([^/]+)$/.exec(path);
    if (one) {
      const row = [...products, ...unpublished].find((item) => item.id === one[1]);
      if (method === 'DELETE') { products.splice(products.findIndex((item) => item.id === one[1]), 1); return route.fulfill({ status: 204 }); }
      if (method === 'PATCH') Object.assign(row ?? {}, { name: body?.name, updated_at: '2026-11-18T09:00:00Z' });
      return route.fulfill({ json: row });
    }
    if (path === '/products/bulk_add_to_channels') return route.fulfill({ json: { product_count: 1, channel_count: 1 } });
    if (path === '/channels' && method === 'GET') return route.fulfill({ json: page_(channels) });
    if (path === '/channels') { const created = { id: 'ch_new', code: 'pos', name: 'Point of Sale', active: true }; channels.push(created); return route.fulfill({ status: 201, json: created }); }
    if (path === '/product_types') return route.fulfill({ json: page_([{ id: 'pt_goods', name: 'Sản phẩm thường' }, { id: 'pt_prepared', name: 'Sản phẩm chế biến' }, { id: 'pt_service', name: 'Dịch vụ' }, { id: 'pt_ingredient', name: 'Nguyên liệu' }]) });
    if (path === '/categories') return route.fulfill({ json: page_([{ id: 'ctg_drinks', name: 'Đồ uống', pretty_name: 'Đồ uống' }]) });
    if (path === '/tax_categories') return route.fulfill({ json: page_([{ id: 'taxcat_vat', name: 'VAT' }]) });
    if (path === '/tax_rates') return route.fulfill({ json: page_([{ id: 'tr_1', tax_category_id: 'taxcat_vat', rate_percent: '8' }]) });
    if (path === '/variants') return route.fulfill({ json: page_(url.searchParams.get('q[sku_eq]') ? [] : [{ sku: 'SP000007' }]) });
    if (path === '/pos/units/variants') return route.fulfill({ json: { data: [{ variant_id: 'prod_tea_v', sale_unit: 'ly', sale_unit_name: 'Ly' }] } });
    if (path === '/pos/units') return route.fulfill({ json: { data: [{ id: 'u1', code: 'item', name: 'Cái', dimension: 'count', base_code: 'item', status: 'active' }, { id: 'u2', code: 'ly', name: 'Ly', dimension: 'count', base_code: 'ly', status: 'active' }] } });
    const assortment = /^\/pos\/branches\/([^/]+)\/products/.exec(path);
    if (assortment && method === 'GET') return route.fulfill({ json: page_(assortment[1] === 'branch_a' ? [{ id: url.searchParams.get('product_id'), assigned: true }] : []) });
    if (assortment) return route.fulfill({ status: 201, json: { data: {} } });
    return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } } });
  });
  await installDashboardShell(page, { authenticated: true });
  // The catalog keys this screen is gated on, beside the shell's topology keys.
  await page.route('**/api/v3/admin/me', (route) => route.fulfill({ json: { id: 'staff_admin', email: 'admin@example.test', full_name: 'Quản trị Hiền', selected_locale: 'vi', stores: [{ id: 'store_1', name: 'Siêu thị Hiền', code: 'store_1', default_currency: 'VND' }], permissions: [], permission_keys: ['read_pos_topology', 'write_pos_topology', 'read_products', 'read_product_types', ...(write ? ['write_products', 'write_product_types', 'write_settings', 'write_categories', 'read_categories'] : [])] } }));
  return state;
}
const MENU = /^(Open actions|Mở menu thao tác)$/;
const rowNamed = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

test('the products list shows variants, price ranges, negative stock and deletes after confirming', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/products');
  if (test.info().project.name !== 'mobile') await expect(page.locator('[data-sidebar="sidebar"]').first().getByRole('link', { name: 'Sản phẩm', exact: true })).toHaveAttribute('href', '/store_1/goods/products');
  const coffee = rowNamed(page, 'Cà phê');
  await expect(coffee).toContainText('+2 phiên bản');
  await expect(coffee).toContainText('20.000 ₫ – 35.000 ₫');
  await expect(coffee.locator('[data-negative]')).toHaveText('-5');
  await expect(rowNamed(page, 'Trà đào')).toContainText('Ly');
  expect(state.lists[0].get('q[channels_code_eq]')).toBe('pos');
  expect(state.lists[0].get('expand')).toContain('variants.stock_levels');

  if (test.info().project.name === 'desktop') {
    await page.getByPlaceholder('Tên, SKU hoặc mã vạch…').fill('893000001');
    await expect(page.getByRole('row').filter({ hasText: 'Cà phê' })).toHaveCount(0);
    await expect(rowNamed(page, 'Trà đào')).toBeVisible();
    expect(state.lists.at(-1)?.get('q[search_with_barcode]')).toBe('893000001');
    await page.getByPlaceholder('Tên, SKU hoặc mã vạch…').fill('');
  }

  await rowNamed(page, 'Trà đào').getByRole('button', { name: MENU }).click();
  await page.getByRole('menuitem', { name: 'Xoá', exact: true }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Hủy', exact: true }).click();
  expect(state.writes.filter((write) => write.method === 'DELETE')).toEqual([]);
  await rowNamed(page, 'Trà đào').getByRole('button', { name: MENU }).click();
  await page.getByRole('menuitem', { name: 'Xoá', exact: true }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Xoá', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã xoá Trà đào.' })).toBeVisible();
  expect(state.writes).toContainEqual({ method: 'DELETE', path: '/products/prod_tea', body: null });
});

test('a bulk delete says how many selected products the server refused', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/products');
  await rowNamed(page, 'Trà đào').getByRole('checkbox').check();
  await rowNamed(page, 'Cà phê').getByRole('checkbox').check();
  const deleteBtn = page.getByRole('button', { name: 'Xoá', exact: true });
  if (await deleteBtn.isVisible()) {
    await deleteBtn.click();
  } else {
    await page.getByRole('button', { name: /^(More actions|Thao tác khác)$/ }).click();
    await page.getByRole('menuitem', { name: 'Xoá', exact: true }).click();
  }
  await page.getByRole('dialog').last().getByRole('button', { name: 'Xoá', exact: true }).click();
  await expect.poll(() => state.writes.map((write) => write.path)).toContain('/products/bulk_destroy');
  await expect(page.getByText('Đã xoá 1 sản phẩm.')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '1 sản phẩm đã chọn chưa được xoá' })).toBeVisible();
});

test('products not on the pos channel are published in bulk, creating the channel when missing', async ({ page }) => {
  const state = await install(page, { posChannel: false }); await page.goto('/store_1/goods/products');
  await page.getByRole('tab', { name: 'Chưa lên kênh POS' }).click();
  await expect(rowNamed(page, 'Gạo thơm')).toBeVisible();
  expect(state.lists.at(-1)?.get('q[not_in_channel]')).toBe('pos');
  // Ingredients are never published there; products without a type stay listed.
  expect(state.lists.at(-1)?.get('q[g][0][m]')).toBe('or');
  expect(state.lists.at(-1)?.get('q[g][0][product_type_id_null]')).toBe('1');
  expect(state.lists.at(-1)?.get('q[g][0][product_type_id_not_eq]')).toBe('pt_ingredient');
  await rowNamed(page, 'Gạo thơm').getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Đưa lên kênh POS' }).click();
  await expect.poll(() => state.writes.map((write) => write.path)).toContain('/products/bulk_add_to_channels');
  expect(state.writes.find((write) => write.path === '/channels')?.body).toEqual({ name: 'Point of Sale', code: 'pos', active: true, default: false });
  expect(state.writes.find((write) => write.path === '/products/bulk_add_to_channels')?.body).toEqual({ ids: ['prod_rice'], channel_ids: ['ch_new'] });
});

test('creating a product publishes it on a new pos channel with opening stock and branches', async ({ page }) => {
  const state = await install(page, { posChannel: false }); await page.goto('/store_1/goods/products');
  await page.getByRole('button', { name: 'Tạo sản phẩm' }).click();
  await expect(page).toHaveURL(/\/goods\/products\/new$/);
  await page.getByLabel('Tên sản phẩm').fill('Trà vải');
  await page.getByLabel('Giá bán').fill('30.000');
  await page.getByLabel('Giá vốn').fill('11000');
  await page.getByRole('button', { name: '5 phút', exact: true }).click();
  await page.getByLabel('Tồn đầu kỳ – Chi nhánh Quận 1').fill('20');
  await page.getByRole('checkbox', { name: 'Đồ uống' }).check();
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page).toHaveURL(/\/goods\/products\/prod_new$/);
  await expect(page.getByRole('status').filter({ hasText: 'Đã tạo sản phẩm' })).toBeVisible();
  expect(state.writes.find((write) => write.path === '/channels')).toBeTruthy();
  expect(state.writes.find((write) => write.path === '/products' && write.method === 'POST')?.body).toEqual({
    name: 'Trà vải', status: 'active', product_type_id: 'pt_goods', category_ids: ['ctg_drinks'], metadata: { prep_minutes: 5 },
    prices: [{ currency: 'VND', amount: '30000' }], product_publications: [{ channel_id: 'ch_new' }],
    variants: [{ sku: 'SP000008', barcode: '', cost_price: '11000', cost_currency: 'VND', track_inventory: true, stock_levels: [{ stock_location_id: 'sloc_a', count_on_hand: 20 }, { stock_location_id: 'sloc_b', count_on_hand: 0 }] }],
  });
  expect(state.writes.filter((write) => write.path.startsWith('/pos/branches')).map((write) => write.path)).toEqual(['/pos/branches/branch_a/products', '/pos/branches/branch_b/products']);
});

test('a refused product keeps the form and shows the field error', async ({ page }) => {
  const state = await install(page); state.refuseCreate = true; await page.goto('/store_1/goods/products/new');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Nhập tên sản phẩm (tối đa 255 ký tự).')).toBeVisible();
  await expect(page.getByText('Nhập giá bán hợp lệ, ví dụ 25000 hoặc 25.000.')).toBeVisible();
  expect(state.writes).toEqual([]);
  await page.getByLabel('Tên sản phẩm').fill('Trà đào');
  await page.getByLabel('Giá bán').fill('25000');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  // The 422 detail lands on the name field and in the summary above the form.
  await expect(page.getByRole('alert').filter({ hasText: 'has already been taken' })).toHaveCount(2);
  await expect(page).toHaveURL(/\/goods\/products\/new$/);
  expect(state.writes.filter((write) => write.path.startsWith('/pos/branches'))).toEqual([]);
});

test('editing a product patches it without touching stock levels', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/products/prod_tea');
  await expect(page.getByLabel('Tên sản phẩm')).toHaveValue('Trà đào');
  await expect(page.getByLabel('SKU')).toHaveValue('SP000001');
  await expect(page.getByRole('checkbox', { name: 'Chi nhánh Quận 1' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Chi nhánh Thủ Đức' })).not.toBeChecked();
  await page.getByLabel('Tên sản phẩm').fill('Trà đào cam sả');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu.' })).toBeVisible();
  const patch = state.writes.find((write) => write.method === 'PATCH');
  expect(patch).toMatchObject({ path: '/products/prod_tea', body: { name: 'Trà đào cam sả', prices: [{ currency: 'VND', amount: '25000' }], variants: [{ id: 'prod_tea_v', sku: 'SP000001' }] } });
  expect(JSON.stringify(patch?.body)).not.toContain('stock_levels');
  expect(state.writes.filter((write) => write.path.startsWith('/pos/'))).toEqual([]);
});

test('read-only staff see products without write actions', async ({ page }) => {
  const state = await install(page, { write: false }); await page.goto('/store_1/goods/products');
  await expect(page.getByText('Chỉ xem', { exact: true })).toBeVisible();
  await expect(rowNamed(page, 'Trà đào')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo sản phẩm' })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
