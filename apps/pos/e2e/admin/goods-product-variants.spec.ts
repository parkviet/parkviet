import { expect, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';

// Presentation fixtures only, not grants of real API privileges.
type Json = Record<string, unknown>;
const branches = [
  { id: 'branch_a', name: 'Chi nhánh Quận 1', code: 'q1', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'sloc_a', receiving_stock_location_id: null },
];
const optionValue = (type: string, typeLabel: string, label: string, position: number) => ({ id: `ov_${type}_${label}`, option_type_id: `ot_${type}`, option_type_name: type, option_type_label: typeLabel, name: label.toLowerCase(), label, position });
const variant = (id: string, sku: string, values: ReturnType<typeof optionValue>[], amount: string) => ({ id, sku, barcode: null, cost_price: null, track_inventory: true, options_text: values.map((value) => value.label).join(' / '), price: { amount, currency: 'VND' }, stock_levels: [{ stock_location_id: 'sloc_a', count_on_hand: 0 }], option_values: values });
function product(id: string, name: string, variants: ReturnType<typeof variant>[]) {
  return { id, name, status: 'active', in_stock: true, thumbnail_url: null, default_variant_id: variants[0].id, price: variants[0].price, product_type_id: 'pt_goods', tax_category_id: null, total_on_hand: 0, metadata: {}, description: null, updated_at: '2026-11-18T08:00:00Z', categories: [], media: [], channels: [{ id: 'ch_pos', code: 'pos' }], variants };
}
const color = (label: string, position: number) => optionValue('color', 'Màu sắc', label, position);
const size = (label: string, position: number) => optionValue('size', 'Size', label, position);

async function install(page: Page) {
  const products: Json[] = [
    product('prod_tee', 'Áo polo', [variant('v_s', 'POLO-S', [size('S', 1)], '200000'), variant('v_m', 'POLO-M', [size('M', 2)], '210000')]),
  ];
  const prices: Json[] = [];
  // POS operating data of the store's prepared products, keyed by product.
  const settings: Json[] = [];
  const config = (id: string, name: string) => ({ product_id: id, name, product_kind: 'prepared', kind: 'single', kitchen_category: null, cup_label: false, show_components_on_kds: true, qr_orderable: true, drink_credit: null, drink_credit_categories: [], tax_category_id: 'tax_food', modifier_group_ids: [] as string[], components: [], variants: [] });
  const state = { writes: [] as { method: string; path: string; body: unknown }[], refuseDelete: false };
  const page_ = (data: unknown[]) => ({ data, meta: { page: 1, limit: 100, count: data.length, pages: 1, from: data.length ? 1 : 0, to: data.length, previous: null, next: null } });
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v3/admin', ''); const method = request.method();
    const body = method === 'GET' || method === 'DELETE' ? null : (request.postDataJSON() as Json);
    if (method !== 'GET') state.writes.push({ method, path, body });
    if (path === '/pos/context') return route.fulfill({ json: { staff: { id: 'staff_admin', full_name: 'Quản trị Hiền' }, store: { id: 'store_1', name: 'Cửa hàng Hiền', currency: 'VND' }, administration: { read: true, write: true }, capabilities: [], modules: { 'fnb.menu': true }, branches, registers: [], selection: { branch_id: 'branch_a', register_id: null } } });
    if (path === '/products' && method === 'POST') {
      const rows = (body?.variants as { sku: string; options: { value: string }[]; prices: { amount: string }[] }[]) ?? [];
      const created = product('prod_new', String(body?.name), rows.map((row, index) => variant(`v_new_${index}`, row.sku, [color(row.options[0].value === 'do' ? 'Đỏ' : 'Xanh', row.options[0].value === 'do' ? 1 : 2), size(row.options[1].value.toUpperCase(), row.options[1].value === 'm' ? 1 : 2)], row.prices[0].amount)));
      Object.assign(created, { product_type_id: body?.product_type_id, tax_category_id: body?.tax_category_id ?? null });
      products.push(created);
      if (body?.product_type_id === 'pt_prepared') settings.push(config('prod_new', String(body?.name)));
      return route.fulfill({ status: 201, json: created });
    }
    const one = /^\/products\/([^/]+)$/.exec(path);
    if (one) {
      const row = products.find((item) => item.id === one[1]);
      if (method === 'PATCH') Object.assign(row ?? {}, { updated_at: '2026-11-18T09:00:00Z' });
      return route.fulfill({ json: row });
    }
    const nested = /^\/products\/([^/]+)\/variants(?:\/([^/]+))?$/.exec(path);
    if (nested && method === 'DELETE') {
      if (state.refuseDelete) return route.fulfill({ status: 422, json: { error: { code: 'validation_error', message: 'Variant is on orders and cannot be deleted' } } });
      return route.fulfill({ status: 204 });
    }
    if (nested && method === 'POST') return route.fulfill({ status: 201, json: { id: 'v_l' } });
    if (path === '/option_types' && method === 'GET') return route.fulfill({ json: page_([{ id: 'ot_size', name: 'size', label: 'Size', option_values: [{ id: 'ov_size_S', name: 's', label: 'S', position: 1 }, { id: 'ov_size_M', name: 'm', label: 'M', position: 2 }] }]) });
    if (path.startsWith('/option_types')) return route.fulfill({ status: method === 'POST' ? 201 : 200, json: { id: 'ot_new', ...body } });
    if (path === '/channels') return route.fulfill({ json: page_([{ id: 'ch_pos', code: 'pos', name: 'POS', active: true }]) });
    if (path === '/product_types') return route.fulfill({ json: page_([{ id: 'pt_goods', name: 'Sản phẩm thường' }, { id: 'pt_prepared', name: 'Sản phẩm chế biến' }, { id: 'pt_service', name: 'Dịch vụ' }, { id: 'pt_ingredient', name: 'Nguyên liệu' }]) });
    if (path === '/categories' || path === '/tax_categories' || path === '/tax_rates') return route.fulfill({ json: page_([]) });
    if (path === '/variants') return route.fulfill({ json: page_(url.searchParams.get('q[sku_eq]') ? [] : [{ sku: 'SP000007' }]) });
    if (path === '/price_lists') return route.fulfill({ json: page_([{ id: 'pl_wholesale', name: 'Giá sỉ', status: 'active', starts_at: '2026-11-01T00:00:00Z', ends_at: null, price_rules: [{ type: 'volume_rule', preferences: { min_quantity: 1, max_quantity: null } }] }]) });
    if (path === '/price_lists/pl_wholesale/products') return route.fulfill({ status: 201, json: { added_count: 1 } });
    if (path === '/prices' && method === 'GET') return route.fulfill({ json: page_(prices) });
    if (path === '/prices/bulk_upsert') {
      for (const row of (body?.prices as Json[]) ?? []) prices.push({ id: `price_${prices.length}`, min_quantity: 1, ...row });
      return route.fulfill({ json: { price_count: prices.length } });
    }
    if (path === '/pos/modifier_groups') return route.fulfill({ json: { data: [{ id: 'grp_topping', name: 'Topping', min_select: 0, max_select: 2, allow_quantity: false, required: false, position: 0, options: [{ id: 'opt_1', name: 'Trân châu', price_delta: '5000' }] }] } });
    if (path === '/pos/products/settings') return route.fulfill({ json: { data: settings } });
    const groups = /^\/pos\/products\/([^/]+)\/modifier_groups$/.exec(path);
    if (groups) {
      const row = settings.find((item) => item.product_id === groups[1]);
      if (row) row.modifier_group_ids = body?.modifier_group_ids;
      return route.fulfill({ json: { data: row } });
    }
    if (path === '/pos/units/variants') return route.fulfill({ json: { data: [] } });
    if (path === '/pos/units/variant') return route.fulfill({ json: { data: { variant_id: url.searchParams.get('variant_id'), sale_unit: 'item', base_unit: 'item', price_unit: 'item', ratio_numerator: 1, ratio_denominator: 1, tracked_mode: 'none', version: 1, status: 'default' } } });
    if (path === '/pos/units') return route.fulfill({ json: { data: [{ id: 'u1', code: 'item', name: 'Cái', dimension: 'count', base_code: 'item', status: 'active' }] } });
    const assortment = /^\/pos\/branches\/([^/]+)\/products/.exec(path);
    if (assortment && method === 'GET') return route.fulfill({ json: page_([{ id: url.searchParams.get('product_id'), assigned: true }]) });
    if (assortment) return route.fulfill({ status: 201, json: { data: {} } });
    return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } } });
  });
  await installDashboardShell(page, { authenticated: true });
  await page.route('**/api/v3/admin/me', (route) => route.fulfill({ json: { id: 'staff_admin', email: 'admin@example.test', full_name: 'Quản trị Hiền', selected_locale: 'vi', stores: [{ id: 'store_1', name: 'Cửa hàng Hiền', code: 'store_1', default_currency: 'VND' }], permissions: [], permission_keys: ['read_pos_topology', 'write_pos_topology', 'read_products', 'write_products', 'read_product_types', 'write_product_types', 'write_settings', 'read_categories', 'write_categories'] } }));
  return state;
}

async function addAttribute(page: Page, name: string, values: string) {
  await page.getByRole('button', { name: 'Thêm thuộc tính' }).click();
  await page.getByLabel('Tên thuộc tính', { exact: true }).last().fill(name);
  const input = page.getByLabel(`Thêm giá trị cho ${name}`);
  await input.fill(values);
  await input.press('Enter');
}

test('creates a prepared product with two attributes and an add-on group, then prices it in a volume price list', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/products/new');
  await page.getByLabel('Tên sản phẩm').fill('Áo thun');
  // Add-on groups, combo and kitchen settings are offered on a prepared product only.
  await expect(page.getByRole('checkbox', { name: 'Topping' })).toHaveCount(0);
  await page.getByLabel('Loại', { exact: true }).click();
  await page.getByRole('option', { name: 'Sản phẩm chế biến', exact: true }).click();
  await expect(page.getByLabel('Nhóm bếp', { exact: true })).toBeVisible();
  await page.getByLabel('Giá bán', { exact: true }).fill('150.000');
  await addAttribute(page, 'Màu sắc', 'Đỏ, Xanh');
  await addAttribute(page, 'Size', 'M');
  await page.getByLabel('Thêm giá trị cho Size').fill('L');
  await page.getByLabel('Thêm giá trị cho Size').press('Enter');
  // Four combinations, prefilled with the price typed above.
  await expect(page.getByRole('table').getByRole('rowheader')).toHaveText(['Đỏ / M', 'Đỏ / L', 'Xanh / M', 'Xanh / L']);
  await expect(page.getByLabel('Giá bán – Đỏ / L', { exact: true })).toHaveValue('150.000');
  await expect(page.getByLabel('Giá bán', { exact: true })).toBeDisabled();
  await page.getByLabel('Giá bán – Xanh / M', { exact: true }).fill('160.000');
  await page.getByLabel('SKU – Đỏ / M', { exact: true }).fill('AT-DO-M');
  await page.getByLabel('Tồn đầu kỳ – Chi nhánh Quận 1 – Đỏ / M').fill('5');
  await page.getByRole('button', { name: 'Bỏ phiên bản Xanh / L' }).click();
  await page.getByRole('checkbox', { name: 'Topping' }).check();
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();

  await expect(page).toHaveURL(/\/goods\/products\/prod_new$/);
  await expect(page.getByRole('status').filter({ hasText: 'Đã tạo sản phẩm' })).toBeVisible();
  const optionTypes = state.writes.filter((write) => write.path === '/option_types');
  expect(optionTypes.map((write) => write.body)).toEqual([
    { name: 'mau-sac', label: 'Màu sắc', option_values: [{ name: 'do', label: 'Đỏ', position: 1 }, { name: 'xanh', label: 'Xanh', position: 2 }] },
  ]);
  expect(state.writes.find((write) => write.path === '/option_types/ot_size')?.body).toEqual({
    option_values: [{ id: 'ov_size_S', name: 's', label: 'S', position: 1 }, { id: 'ov_size_M', name: 'm', label: 'M', position: 2 }, { name: 'l', label: 'L', position: 3 }],
  });
  const created = state.writes.find((write) => write.path === '/products' && write.method === 'POST')?.body as Json;
  expect(created).not.toHaveProperty('prices');
  expect(created).toMatchObject({ product_type_id: 'pt_prepared' });
  expect(created.variants).toEqual([
    { options: [{ name: 'mau-sac', value: 'do' }, { name: 'size', value: 'm' }], sku: 'AT-DO-M', barcode: '', cost_price: null, track_inventory: true, prices: [{ currency: 'VND', amount: '150000' }], stock_levels: [{ stock_location_id: 'sloc_a', count_on_hand: 5 }] },
    { options: [{ name: 'mau-sac', value: 'do' }, { name: 'size', value: 'l' }], sku: 'SP000008', barcode: '', cost_price: null, track_inventory: true, prices: [{ currency: 'VND', amount: '150000' }], stock_levels: [{ stock_location_id: 'sloc_a', count_on_hand: 0 }] },
    { options: [{ name: 'mau-sac', value: 'xanh' }, { name: 'size', value: 'm' }], sku: 'SP000009', barcode: '', cost_price: null, track_inventory: true, prices: [{ currency: 'VND', amount: '160000' }], stock_levels: [{ stock_location_id: 'sloc_a', count_on_hand: 0 }] },
  ]);
  // Unchanged kitchen settings and an empty combo are not written; the groups are.
  expect(state.writes.filter((write) => write.path.startsWith('/pos/products/'))).toEqual([
    { method: 'PUT', path: '/pos/products/prod_new/modifier_groups', body: { modifier_group_ids: ['grp_topping'] } },
  ]);

  // The edit page reads the matrix back and offers the price lists.
  await expect(page.getByRole('table').getByRole('rowheader')).toHaveText(['Đỏ / M', 'Đỏ / L', 'Xanh / M', 'Xanh / LKhông bán']);
  await expect(page.getByRole('checkbox', { name: 'Topping' })).toBeChecked();
  await page.getByLabel('Thêm vào bảng giá', { exact: true }).click();
  await page.getByRole('option', { name: 'Giá sỉ', exact: true }).click();
  await page.getByRole('button', { name: 'Đặt giá', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Bảng giá áp dụng khi mua từ 1 sản phẩm.');
  await dialog.getByLabel('Giá trong bảng giá – Đỏ / M').fill('140.000');
  await dialog.getByRole('button', { name: 'Thêm bậc giá cho Đỏ / M' }).click();
  await dialog.getByLabel('Từ số lượng – Đỏ / M – bậc 1').fill('10');
  await dialog.getByLabel('Giá – Đỏ / M – bậc 1').fill('120.000');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes.find((write) => write.path === '/price_lists/pl_wholesale/products')?.method).toBe('POST');
  expect(state.writes.find((write) => write.path === '/prices/bulk_upsert')?.body).toEqual({
    prices: [
      { variant_id: 'v_new_0', currency: 'VND', price_list_id: 'pl_wholesale', amount: '140000' },
      { variant_id: 'v_new_0', currency: 'VND', price_list_id: 'pl_wholesale', min_quantity: 10, amount: '120000' },
    ],
  });
  await expect(page.getByRole('list', { name: 'Bảng giá' })).toContainText('Giá sỉ');
  // The product form itself was not saved again by the price list.
  expect(state.writes.filter((write) => write.method === 'PATCH' && write.path.startsWith('/products'))).toEqual([]);
});

test('editing variants deletes a removed value, creates a new one and reports a refused delete', async ({ page }) => {
  const state = await install(page); state.refuseDelete = true; await page.goto('/store_1/goods/products/prod_tee');
  await expect(page.getByLabel('Tên thuộc tính', { exact: true })).toHaveValue('Size');
  await expect(page.getByLabel('Tên thuộc tính', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Bỏ giá trị S' }).click();
  await expect(page.getByRole('note')).toContainText('S');
  await page.getByLabel('Thêm giá trị cho Size').fill('L');
  await page.getByLabel('Thêm giá trị cho Size').press('Enter');
  await page.getByLabel('Giá bán – L', { exact: true }).fill('220000');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Sản phẩm đã được lưu nhưng còn bước chưa xong' })).toContainText('Xoá phiên bản S');
  const patch = state.writes.find((write) => write.method === 'PATCH' && write.path === '/products/prod_tee')?.body as Json;
  // The variant to delete rides along unchanged, so only its own delete can refuse it.
  expect(patch.variants).toEqual([expect.objectContaining({ id: 'v_m', sku: 'POLO-M', prices: [{ currency: 'VND', amount: '210000' }] }), { id: 'v_s' }]);
  expect(patch).not.toHaveProperty('prices');
  expect(state.writes.find((write) => write.method === 'DELETE')?.path).toBe('/products/prod_tee/variants/v_s');
  expect(state.writes.find((write) => write.method === 'POST' && write.path === '/products/prod_tee/variants')?.body).toMatchObject({
    options: [{ name: 'size', value: 'l' }], sku: 'SP000008', prices: [{ currency: 'VND', amount: '220000' }], stock_levels: [{ stock_location_id: 'sloc_a', count_on_hand: 0 }],
  });
});
