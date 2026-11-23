import { expect, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';

// Presentation fixtures only, not grants of real API privileges.
type Json = Record<string, unknown>;
const NOW = new Date('2026-11-18T05:00:00Z');
const posRule = { id: 'prule_pos', type: 'channel_rule', preferences: { channel_ids: ['ch_pos'] }, channels: [{ id: 'ch_pos', name: 'POS', code: 'pos' }] };
const priceList = (id: string, name: string, extra: Json = {}) => ({ id, name, description: null, status: 'active', position: 1, match_policy: 'all', starts_at: null, ends_at: null, price_rules: [], products_count: 0, prices_count: 0, price_adjustment_tiers: [], ...extra });
const variant = (id: string, sku: string, amount: string, options = '') => ({ id, sku, options_text: options, price: { amount, currency: 'VND' } });
const products = [
  { id: 'prod_rice', name: 'Gạo ST25', thumbnail_url: null, default_variant: { id: 'v_rice', sku: 'SP000001' }, variants: [variant('v_rice', 'SP000001', '100000')] },
  { id: 'prod_eggs', name: 'Trứng gà', thumbnail_url: null, default_variant: { id: 'v_eggs', sku: 'SP000002' }, variants: [variant('v_eggs', 'SP000002', '38000')] },
];

async function install(page: Page) {
  await page.clock.setFixedTime(NOW);
  const lists: Json[] = [
    priceList('pl_retail', 'Giá quầy', { description: 'BG000001', price_rules: [posRule] }),
    priceList('pl_summer', 'Khuyến mãi hè', { description: 'BG000002', status: 'scheduled', starts_at: '2026-12-01T00:00:00Z' }),
    priceList('pl_old', 'Giá cũ', { description: 'Bảng giá năm ngoái', status: 'inactive' }),
    priceList('pl_ended', 'Tết 2026', { description: 'BG000003', ends_at: '2026-02-01T00:00:00Z' }),
  ];
  const members: Record<string, string[]> = { pl_retail: ['prod_rice'] };
  const prices: Json[] = [{ id: 'price_r1', variant_id: 'v_rice', price_list_id: 'pl_retail', currency: 'VND', amount: '90000', min_quantity: 1 }];
  const state = { writes: [] as { method: string; path: string; body: unknown }[], lists };
  const page_ = (data: unknown[]) => ({ data, meta: { page: 1, limit: 100, count: data.length, pages: 1, from: data.length ? 1 : 0, to: data.length, previous: null, next: null } });
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v3/admin', ''); const method = request.method();
    const body = request.postData() ? (request.postDataJSON() as Json) : null;
    if (method !== 'GET') state.writes.push({ method, path, body });
    if (path === '/pos/context') return route.fulfill({ json: { staff: { id: 'staff_admin', full_name: 'Quản trị Hiền' }, store: { id: 'store_1', name: 'Siêu thị Hiền', currency: 'VND', timezone: 'Asia/Ho_Chi_Minh' }, administration: { read: true, write: true }, capabilities: [], branches: [{ id: 'branch_a', name: 'Chi nhánh Quận 1', code: 'q1', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'sloc_a', receiving_stock_location_id: null }], registers: [], selection: { branch_id: 'branch_a', register_id: null } } });
    if (path === '/price_lists' && method === 'GET') return route.fulfill({ json: page_(lists) });
    if (path === '/price_lists' && method === 'POST') {
      const rules = ((body?.rules as Json[]) ?? []).map((rule, index) => ({ id: `prule_new${index}`, ...rule }));
      const created = priceList('pl_new', String(body?.name), { ...body, status: 'draft', price_rules: rules });
      lists.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    const productsOf = /^\/price_lists\/([^/]+)\/products$/.exec(path);
    if (productsOf) {
      const ids = members[productsOf[1]] ?? [];
      if (method === 'GET') return route.fulfill({ json: page_(products.filter((row) => ids.includes(row.id)).map(({ id, name }) => ({ id, name, thumbnail_url: null }))) });
      members[productsOf[1]] = [...ids, ...((body?.product_ids as string[]) ?? [])];
      return route.fulfill({ status: 201, json: { added_count: 1 } });
    }
    const lifecycle = /^\/price_lists\/([^/]+)\/(activate|deactivate)$/.exec(path);
    if (lifecycle) {
      const row = lists.find((item) => item.id === lifecycle[1]);
      Object.assign(row ?? {}, { status: lifecycle[2] === 'activate' ? 'active' : 'inactive' });
      return route.fulfill({ json: row });
    }
    const one = /^\/price_lists\/([^/]+)$/.exec(path);
    if (one) {
      const index = lists.findIndex((item) => item.id === one[1]);
      if (method === 'DELETE') { lists.splice(index, 1); return route.fulfill({ status: 204 }); }
      Object.assign(lists[index], body);
      return route.fulfill({ json: lists[index] });
    }
    if (path === '/catalogs') return route.fulfill({ json: page_([]) });
    if (path === '/channels') return route.fulfill({ json: page_([{ id: 'ch_online', name: 'Online Store', code: 'online', active: true }, { id: 'ch_pos', name: 'POS', code: 'pos', active: true }]) });
    if (path === '/customer_groups') return route.fulfill({ json: page_([{ id: 'cg_wholesale', name: 'Khách sỉ' }]) });
    if (path === '/products') {
      const ids = url.searchParams.getAll('q[id_in][]');
      return route.fulfill({ json: page_(ids.length ? products.filter((row) => ids.includes(row.id)) : products) });
    }
    if (path === '/prices' && method === 'GET') {
      const listId = url.searchParams.get('q[price_list_id_eq]');
      return route.fulfill({ json: page_(prices.filter((row) => !listId || row.price_list_id === listId)) });
    }
    if (path === '/prices/bulk_upsert') return route.fulfill({ json: { price_count: ((body?.prices as Json[]) ?? []).length } });
    return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } } });
  });
  await installDashboardShell(page, { authenticated: true });
  await page.route('**/api/v3/admin/me', (route) => route.fulfill({ json: { id: 'staff_admin', email: 'admin@example.test', full_name: 'Quản trị Hiền', selected_locale: 'vi', stores: [{ id: 'store_1', name: 'Siêu thị Hiền', code: 'store_1', default_currency: 'VND' }], permissions: [], permission_keys: ['read_pos_topology', 'read_products', 'write_products', 'read_settings', 'read_customers'] } }));
  return state;
}
const MENU = /^(Open actions|Mở menu thao tác)$/;
const rowNamed = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

test('the list counts lists by state, filters by tab and searches by code', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/price-lists');
  if (test.info().project.name !== 'mobile') await expect(page.locator('[data-sidebar="sidebar"]').first().getByRole('link', { name: 'Bảng giá', exact: true })).toHaveAttribute('href', '/store_1/goods/price-lists');
  const tabs = page.getByRole('tablist', { name: 'Trạng thái bảng giá' });
  await expect(tabs.getByRole('tab', { name: /Tất cả\s*4/ })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: /Đang áp dụng\s*1/ })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: /Chưa áp dụng\s*1/ })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: /Tạm dừng\s*1/ })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: /Hết hiệu lực\s*1/ })).toBeVisible();
  const retail = rowNamed(page, 'Giá quầy');
  await expect(retail).toContainText('BG000001');
  await expect(retail).toContainText('POS');
  await expect(retail).toContainText('Giá cố định từng sản phẩm');
  await expect(rowNamed(page, 'Giá cũ')).toContainText('Mọi kênh bán');
  await expect(rowNamed(page, 'Khuyến mãi hè')).toContainText('01/12/2026');

  await tabs.getByRole('tab', { name: /Tạm dừng/ }).click();
  await expect(page).toHaveURL(/state=paused/);
  await expect(rowNamed(page, 'Giá quầy')).toHaveCount(0);
  await expect(rowNamed(page, 'Giá cũ')).toBeVisible();
  await tabs.getByRole('tab', { name: /Tất cả/ }).click();
  if (test.info().project.name === 'desktop') {
    await page.getByPlaceholder('Tìm theo mã hoặc tên bảng giá').fill('BG000003');
    await expect(rowNamed(page, 'Giá quầy')).toHaveCount(0);
    await expect(rowNamed(page, 'Tết 2026')).toBeVisible();
  }
  expect(state.writes).toEqual([]);
});

test('pausing, activating and deleting go through Spree with a confirmation', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/price-lists');
  await rowNamed(page, 'Giá quầy').getByRole('button', { name: MENU }).click();
  await page.getByRole('menuitem', { name: 'Tạm dừng' }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await expect(page.getByText('Đã tạm dừng bảng giá Giá quầy.')).toBeVisible();
  await rowNamed(page, 'Giá cũ').getByRole('button', { name: MENU }).click();
  await page.getByRole('menuitem', { name: 'Kích hoạt' }).click();
  await expect(page.getByText('Đã kích hoạt bảng giá Giá cũ.')).toBeVisible();
  await rowNamed(page, 'Tết 2026').getByRole('button', { name: MENU }).click();
  await page.getByRole('menuitem', { name: 'Xoá' }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Xoá', exact: true }).click();
  await expect(rowNamed(page, 'Tết 2026')).toHaveCount(0);
  expect(state.writes.map((write) => `${write.method} ${write.path}`)).toEqual([
    'PATCH /price_lists/pl_retail/deactivate',
    'PATCH /price_lists/pl_old/activate',
    'DELETE /price_lists/pl_ended',
  ]);
});

test('a fixed price list on the POS channel is created, then priced per product', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/price-lists');
  await page.getByRole('button', { name: 'Tạo bảng giá' }).click();
  await expect(page.getByLabel('Mã bảng giá')).toHaveAttribute('placeholder', 'BG000004');
  await expect(page.getByLabel('Ngày bắt đầu')).toHaveValue('2026-11-18');
  await expect(page.getByRole('checkbox', { name: 'POS' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Online Store' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Nhập tên bảng giá.')).toBeVisible();
  await page.getByLabel('Tên bảng giá').fill('Giá thành viên');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Đã tạo bảng giá Giá thành viên.', { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/goods\/price-lists\/pl_new$/);
  const create = state.writes.find((write) => write.method === 'POST' && write.path === '/price_lists');
  expect(create?.body).toEqual({
    name: 'Giá thành viên', description: 'BG000004', starts_at: '2026-11-17T17:00:00.000Z', ends_at: null, match_policy: 'all',
    rules: [{ type: 'channel_rule', preferences: { channel_ids: ['ch_pos'] } }],
  });
  expect(state.writes.some((write) => write.path === '/price_lists/pl_new/activate')).toBe(true);

  await page.getByRole('button', { name: 'Thêm sản phẩm' }).click();
  const picker = page.getByRole('dialog');
  await picker.getByRole('checkbox', { name: 'Trứng gà' }).click();
  await picker.getByRole('button', { name: 'Thêm 1 sản phẩm' }).click();
  await expect(page.getByText('Đã thêm 1 sản phẩm.')).toBeVisible();
  expect(state.writes.find((write) => write.path === '/price_lists/pl_new/products')?.body).toEqual({ product_ids: ['prod_eggs'] });
  await page.getByRole('button', { name: 'Sửa giá Trứng gà' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Giá trong bảng giá – Trứng gà').fill('35.000');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes.find((write) => write.path === '/prices/bulk_upsert')?.body).toEqual({
    prices: [{ variant_id: 'v_eggs', currency: 'VND', price_list_id: 'pl_new', amount: '35000' }],
  });
});

test('a wholesale list carries a volume rule and quantity breaks per variant', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/price-lists/new');
  await page.getByLabel('Mã bảng giá').fill('SI-01');
  await page.getByLabel('Tên bảng giá').fill('Giá sỉ');
  await page.getByRole('checkbox', { name: 'Không có ngày kết thúc' }).click();
  await page.getByRole('textbox', { name: 'Ngày kết thúc' }).fill('2026-12-31');
  await page.getByRole('radio', { name: /Giá sỉ theo số lượng/ }).check();
  await page.getByLabel('Áp dụng từ số lượng').fill('10');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page).toHaveURL(/\/goods\/price-lists\/pl_new$/);
  const create = state.writes.find((write) => write.method === 'POST' && write.path === '/price_lists');
  expect(create?.body).toEqual({
    name: 'Giá sỉ', description: 'SI-01', starts_at: '2026-11-17T17:00:00.000Z', ends_at: '2026-12-31T16:59:59.000Z', match_policy: 'all',
    rules: [
      { type: 'channel_rule', preferences: { channel_ids: ['ch_pos'] } },
      { type: 'volume_rule', preferences: { min_quantity: 10, max_quantity: null } },
    ],
  });
  await expect(page.getByText('Bảng giá áp dụng khi mua từ 10 sản phẩm.')).toBeVisible();

  await page.getByRole('button', { name: 'Thêm sản phẩm' }).click();
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Gạo ST25' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Thêm 1 sản phẩm' }).click();
  await page.getByRole('button', { name: 'Sửa giá Gạo ST25' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Giá trong bảng giá – Gạo ST25').fill('95000');
  await dialog.getByRole('button', { name: 'Thêm bậc giá cho Gạo ST25' }).click();
  await dialog.getByLabel('Từ số lượng – Gạo ST25 – bậc 1').fill('50');
  await dialog.getByLabel('Giá – Gạo ST25 – bậc 1').fill('90000');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes.find((write) => write.path === '/prices/bulk_upsert')?.body).toEqual({
    prices: [
      { variant_id: 'v_rice', currency: 'VND', price_list_id: 'pl_new', amount: '95000' },
      { variant_id: 'v_rice', currency: 'VND', price_list_id: 'pl_new', min_quantity: 50, amount: '90000' },
    ],
  });
});

test('a formula list prices added products from their selling price', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/price-lists/pl_retail');
  await expect(page.getByLabel('Mã bảng giá')).toHaveValue('BG000001');
  await expect(page.getByText('Gạo ST25')).toBeVisible();
  await expect(page.getByText('Giá bảng 90.000 ₫', { exact: false })).toBeVisible();
  await page.getByRole('radio', { name: /Giá theo công thức/ }).check();
  await page.getByLabel('Giá trị').fill('10');
  await page.getByRole('button', { name: 'Thêm sản phẩm' }).click();
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Trứng gà' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Thêm 1 sản phẩm' }).click();
  await expect(page.getByText('Đã thêm 1 sản phẩm.')).toBeVisible();
  expect(state.writes.find((write) => write.path === '/prices/bulk_upsert')?.body).toEqual({
    prices: [{ variant_id: 'v_eggs', currency: 'VND', price_list_id: 'pl_retail', amount: '34200' }],
  });
});
