import { expect, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';

// Presentation fixtures only, not grants of real API privileges.
type Json = Record<string, unknown>;
type Category = { id: string; name: string; pretty_name: string; parent_id: string | null; depth: number; lft: number; position: number; products_count: number; children_count: number; image_url: null; members: string[] };
const category = (id: string, name: string, lft: number, extra: Partial<Category> = {}): Category => ({ id, name, pretty_name: name, parent_id: null, depth: 0, lft, position: 0, products_count: 0, children_count: 0, image_url: null, members: [], ...extra });
const product = (id: string, name: string, sku: string) => ({ id, name, status: 'active', thumbnail_url: null, default_variant_id: `${id}_v`, default_variant: { id: `${id}_v`, sku } });
const products = [product('prod_tea', 'Trà đào', 'SP000001'), product('prod_coffee', 'Cà phê sữa', 'SP000002'), product('prod_cake', 'Bánh flan', 'SP000003')];

async function install(page: Page, options: { write?: boolean } = {}) {
  const write = options.write !== false;
  const categories = [category('ctg_drinks', 'Đồ uống', 1, { products_count: 1, members: ['prod_tea'] }), category('ctg_food', 'Đồ ăn', 3)];
  const state = { writes: [] as { method: string; path: string; body: unknown }[], categories };
  const page_ = (data: unknown[]) => ({ data, meta: { page: 1, limit: 25, count: data.length, pages: 1, from: data.length ? 1 : 0, to: data.length, previous: null, next: null } });
  const shown = (row: Category) => { const { members: _members, ...rest } = row; return { ...rest, products_count: row.members.length }; };
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v3/admin', ''); const method = request.method();
    const body = request.postData() ? (request.postDataJSON() as Json) : null;
    if (method !== 'GET') state.writes.push({ method, path, body });
    if (path === '/pos/context') return route.fulfill({ json: { staff: { id: 'staff_admin', full_name: 'Quản trị Hiền' }, store: { id: 'store_1', name: 'Siêu thị Hiền', currency: 'VND' }, administration: { read: true, write: true }, capabilities: [], branches: [{ id: 'branch_a', name: 'Chi nhánh Quận 1', code: 'q1', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'sloc_a', receiving_stock_location_id: null }], registers: [], selection: { branch_id: 'branch_a', register_id: null } } });
    if (path === '/categories' && method === 'GET') return route.fulfill({ json: page_([...categories].sort((a, b) => a.lft - b.lft).map(shown)) });
    if (path === '/categories' && method === 'POST') {
      const created = category('ctg_new', String(body?.name), 5);
      categories.push(created);
      return route.fulfill({ status: 201, json: shown(created) });
    }
    const members = /^\/categories\/([^/]+)\/products$/.exec(path);
    if (members) {
      const row = categories.find((item) => item.id === members[1]);
      if (!row) return route.fulfill({ status: 404, json: {} });
      const ids = (body?.product_ids as string[] | undefined) ?? [];
      if (method === 'GET') return route.fulfill({ json: page_(products.filter((item) => row.members.includes(item.id))) });
      if (method === 'POST') { row.members.push(...ids.filter((id) => !row.members.includes(id))); return route.fulfill({ status: 201, json: { added_count: ids.length } }); }
      row.members = row.members.filter((id) => !ids.includes(id));
      return route.fulfill({ json: { removed_count: ids.length } });
    }
    const reposition = /^\/categories\/([^/]+)\/reposition$/.exec(path);
    if (reposition) {
      const row = categories.find((item) => item.id === reposition[1]);
      if (row && body?.new_position === 1) row.lft = 10;
      return route.fulfill({ json: row && shown(row) });
    }
    const one = /^\/categories\/([^/]+)$/.exec(path);
    if (one) {
      const index = categories.findIndex((item) => item.id === one[1]);
      if (method === 'DELETE') { categories.splice(index, 1); return route.fulfill({ status: 204 }); }
      if (method === 'PATCH') Object.assign(categories[index], { name: body?.name, pretty_name: body?.name });
      return route.fulfill({ json: shown(categories[index]) });
    }
    if (path === '/products' && method === 'GET') {
      const term = url.searchParams.get('q[search_with_barcode]');
      return route.fulfill({ json: page_(term ? products.filter((row) => JSON.stringify(row).includes(term)) : products) });
    }
    return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } } });
  });
  await installDashboardShell(page, { authenticated: true });
  await page.route('**/api/v3/admin/me', (route) => route.fulfill({ json: { id: 'staff_admin', email: 'admin@example.test', full_name: 'Quản trị Hiền', selected_locale: 'vi', stores: [{ id: 'store_1', name: 'Siêu thị Hiền', code: 'store_1', default_currency: 'VND' }], permissions: [], permission_keys: ['read_pos_topology', 'read_categories', ...(write ? ['write_categories'] : [])] } }));
  return state;
}
const MENU = /^(Open actions|Mở menu thao tác)$/;
const rowNamed = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

test('a category is created with products, loses one, then is deleted keeping its products', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/categories');
  // The sidebar is a closed drawer on phones.
  if (test.info().project.name !== 'mobile') await expect(page.locator('[data-sidebar="sidebar"]').first().getByRole('link', { name: 'Danh mục', exact: true })).toHaveAttribute('href', '/store_1/goods/categories');
  await expect(rowNamed(page, 'Đồ uống')).toContainText('1 sản phẩm');

  await page.getByRole('button', { name: 'Tạo danh mục' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Chưa chọn sản phẩm nào. Danh mục rỗng vẫn lưu được.')).toBeVisible();
  await dialog.getByLabel('Tên danh mục').fill('Món mới');
  await dialog.getByRole('searchbox', { name: 'Tên, SKU hoặc mã vạch…' }).fill('SP00000');
  await dialog.getByRole('checkbox', { name: 'Trà đào' }).check();
  await dialog.getByRole('button', { name: 'Chọn cả trang này' }).click();
  await expect(dialog.getByText('Đã chọn (3)')).toBeVisible();
  await dialog.getByRole('button', { name: 'Bỏ Bánh flan' }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Bánh flan' })).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu danh mục Món mới.' })).toBeVisible();
  expect(state.writes.slice(0, 2)).toEqual([
    { method: 'POST', path: '/categories', body: { name: 'Món mới' } },
    { method: 'POST', path: '/categories/ctg_new/products', body: { product_ids: ['prod_tea', 'prod_coffee'] } },
  ]);
  await expect(rowNamed(page, 'Món mới')).toContainText('2 sản phẩm');

  state.writes.length = 0;
  await rowNamed(page, 'Món mới').getByRole('button', { name: 'Món mới', exact: true }).click();
  await expect(dialog.getByText('Đã chọn (2)')).toBeVisible();
  await dialog.getByRole('button', { name: 'Bỏ Cà phê sữa' }).click();
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(rowNamed(page, 'Món mới')).toContainText('1 sản phẩm');
  expect(state.writes).toEqual([{ method: 'DELETE', path: '/categories/ctg_new/products', body: { product_ids: ['prod_coffee'] } }]);

  state.writes.length = 0;
  await rowNamed(page, 'Món mới').getByRole('button', { name: MENU }).click();
  await page.getByRole('menuitem', { name: 'Xoá', exact: true }).click();
  await expect(page.getByText('Xoá danh mục Món mới? Sản phẩm trong danh mục vẫn được giữ.')).toBeVisible();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Xoá', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã xoá danh mục Món mới.' })).toBeVisible();
  await expect(rowNamed(page, 'Món mới')).toHaveCount(0);
  expect(state.writes).toEqual([{ method: 'DELETE', path: '/categories/ctg_new', body: null }]);
});

test('categories are reordered among their siblings and shown as a grid', async ({ page }) => {
  const state = await install(page); await page.goto('/store_1/goods/categories');
  await expect(page.getByRole('button', { name: 'Đưa Đồ uống lên' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Đưa Đồ ăn xuống' })).toBeDisabled();
  await page.getByRole('button', { name: 'Đưa Đồ uống xuống' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã đổi thứ tự Đồ uống.' })).toBeVisible();
  expect(state.writes).toEqual([{ method: 'PATCH', path: '/categories/ctg_drinks/reposition', body: { new_parent_id: null, new_position: 1 } }]);
  await expect(page.getByRole('row').nth(1)).toContainText('Đồ ăn');

  await page.getByRole('tab', { name: 'Lưới' }).click();
  await expect(page).toHaveURL(/layout=grid/);
  await expect(page.locator('[data-category-card]')).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Tìm danh mục…' }).fill('uống');
  await expect(page.locator('[data-category-card]')).toHaveCount(1);
  await expect(page.locator('[data-category-card="ctg_drinks"]')).toContainText('1 sản phẩm');
});

test('read-only staff see categories without write actions', async ({ page }) => {
  const state = await install(page, { write: false }); await page.goto('/store_1/goods/categories');
  await expect(page.getByText('Chỉ xem', { exact: true })).toBeVisible();
  await expect(rowNamed(page, 'Đồ uống')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo danh mục' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Đưa Đồ uống xuống' })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
