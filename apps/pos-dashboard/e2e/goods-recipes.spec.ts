import { expect, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';

// Presentation fixtures only, not grants of real API privileges.
type Json = Record<string, unknown>;
type Ingredient = { variant_id: string; name: string; sku: string; quantity: string; unit_code: string };
const branches = [{ id: 'branch_a', name: 'Chi nhánh Quận 1', code: 'q1', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'sloc_a', receiving_stock_location_id: null }];
const variant = (id: string, sku: string, cost: string | null, options = '') => ({ id, sku, barcode: null, cost_price: cost, track_inventory: true, options_text: options, stock_levels: [] });
const ingredients = [
  { id: 'prod_milk', name: 'Sữa tươi', status: 'active', default_variant_id: 'v_milk', product_type_id: 'pt_ingredient', variants: [variant('v_milk', 'NL000001', '40')] },
  { id: 'prod_sugar', name: 'Đường', status: 'active', default_variant_id: 'v_sugar', product_type_id: 'pt_ingredient', variants: [variant('v_sugar', 'NL000002', '20')] },
];
const units: Record<string, string> = { v_milk: 'ml', v_sugar: 'g' };
const costs: Record<string, string> = { v_milk: '40', v_sugar: '20' };

async function install(page: Page, { modules = { 'fnb.recipes': true } as Json } = {}) {
  const goods = [
    { id: 'prod_tea', name: 'Trà sữa', status: 'active', default_variant_id: 'v_tea_master', product_type_id: 'pt_goods', variants: [variant('v_tea_m', 'TS-M', '5000', 'Size: M'), variant('v_tea_l', 'TS-L', null, 'Size: L')] },
    { id: 'prod_cake', name: 'Bánh flan', status: 'active', default_variant_id: 'v_cake', product_type_id: null, variants: [variant('v_cake', 'SP000002', null)] },
  ];
  const owners: Record<string, { product: (typeof goods)[number]; variantId: string }> = {
    v_tea_m: { product: goods[0], variantId: 'v_tea_m' }, v_tea_l: { product: goods[0], variantId: 'v_tea_l' }, v_cake: { product: goods[1], variantId: 'v_cake' },
  };
  const recipes: Record<string, { version: number; ingredients: Ingredient[] } | null> = {
    v_tea_m: { version: 1, ingredients: [{ variant_id: 'v_milk', name: 'Sữa tươi', sku: 'NL000001', quantity: '150.0', unit_code: 'ml' }] },
  };
  const state = { writes: [] as { method: string; path: string; body: Json | null }[], productLists: [] as URLSearchParams[] };
  const page_ = (data: unknown[]) => ({ data, meta: { page: 1, limit: 100, count: data.length, pages: 1, from: data.length ? 1 : 0, to: data.length, previous: null, next: null } });
  const costOf = (rows: Ingredient[]) => String(rows.reduce((sum, row) => sum + Number(row.quantity) * Number(costs[row.variant_id]), 0)) + '.0';
  const owner = (id: string) => {
    const recipe = recipes[id];
    return {
      owner_type: 'variant', owner_id: id, track_inventory: !recipe,
      active: recipe ? { id: `posrecipe_${id}`, version: recipe.version, active: true, created_at: '2026-11-18T08:00:00Z', estimated_cost: costOf(recipe.ingredients),
        ingredients: recipe.ingredients.map((row, index) => ({ id: `ing_${index}`, ...row, options_text: null, base_quantity: Number(row.quantity), base_unit: units[row.variant_id], unit_cost: costs[row.variant_id], cost: `${Number(row.quantity) * Number(costs[row.variant_id])}.0` })) } : null,
      versions: [],
    };
  };
  const listRow = (id: string) => {
    const { product, variantId } = owners[id]; const row = product.variants.find((item) => item.id === variantId);
    return { id: `posrecipe_${id}`, version: recipes[id]?.version, ingredients: recipes[id]?.ingredients.length, estimated_cost: costOf(recipes[id]?.ingredients ?? []), owner_type: 'variant', owner_id: id, product_id: product.id, name: product.name, options_text: row?.options_text || null, sku: row?.sku ?? null, group_name: null, cost_price: row?.cost_price ?? null, track_inventory: false };
  };
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v3/admin', ''); const method = request.method();
    const body = method === 'GET' || method === 'DELETE' ? null : (request.postDataJSON() as Json);
    if (method !== 'GET') state.writes.push({ method, path, body });
    if (path === '/pos/context') return route.fulfill({ json: { staff: { id: 'staff_admin', full_name: 'Quản trị Hiền' }, store: { id: 'store_1', name: 'Quán Hiền', currency: 'VND' }, administration: { read: true, write: true }, capabilities: [], modules, branches, registers: [], selection: { branch_id: 'branch_a', register_id: null } } });
    if (path === '/products' && method === 'GET') {
      if (url.searchParams.get('q[product_type_id_eq]') === 'pt_ingredient') return route.fulfill({ json: page_(ingredients) });
      state.productLists.push(url.searchParams);
      const term = (url.searchParams.get('q[search_with_barcode]') ?? '').toLowerCase();
      return route.fulfill({ json: page_(goods.filter((row) => row.name.toLowerCase().includes(term))) });
    }
    const variantPatch = /^\/products\/([^/]+)\/variants\/([^/]+)$/.exec(path);
    if (variantPatch && method === 'PATCH') {
      const row = goods.find((item) => item.id === variantPatch[1])?.variants.find((item) => item.id === variantPatch[2]);
      if (row) row.cost_price = String(body?.cost_price);
      return route.fulfill({ json: row });
    }
    if (path === '/product_types') return route.fulfill({ json: page_([{ id: 'pt_goods', name: 'Hàng hoá' }, { id: 'pt_service', name: 'Dịch vụ' }, { id: 'pt_ingredient', name: 'Nguyên liệu' }]) });
    if (path === '/pos/units/variants') return route.fulfill({ json: { data: (url.searchParams.get('variant_ids') ?? '').split(',').filter((id) => units[id]).map((id) => ({ variant_id: id, sale_unit: units[id], sale_unit_name: units[id], base_unit: units[id], ratio_numerator: 1, ratio_denominator: 1 })) } });
    if (path === '/pos/units') return route.fulfill({ json: { data: [
      { id: 'u_ml', code: 'ml', name: 'Mililit', dimension: 'volume', base_code: 'ml', factor_to_base: 1, sale_precision: 0, version: 1, status: 'active' },
      { id: 'u_l', code: 'l', name: 'Lít', dimension: 'volume', base_code: 'ml', factor_to_base: 1000, sale_precision: 2, version: 1, status: 'active' },
      { id: 'u_g', code: 'g', name: 'Gram', dimension: 'mass', base_code: 'g', factor_to_base: 1, sale_precision: 0, version: 1, status: 'active' },
      { id: 'u_kg', code: 'kg', name: 'Kilogram', dimension: 'mass', base_code: 'g', factor_to_base: 1000, sale_precision: 2, version: 1, status: 'active' },
    ] } });
    if (path === '/pos/recipes/list') {
      const ids = url.searchParams.get('variant_ids')?.split(',');
      const term = (url.searchParams.get('q') ?? '').toLowerCase();
      const rows = Object.keys(recipes).filter((id) => recipes[id] && (!ids || ids.includes(id))).map(listRow).filter((row) => row.name.toLowerCase().includes(term));
      return route.fulfill({ json: page_(rows) });
    }
    if (path === '/pos/recipes' && method === 'GET') return route.fulfill({ json: { data: owner(String(url.searchParams.get('variant_id'))) } });
    if (path === '/pos/recipes' && method === 'PUT') {
      const id = String(body?.variant_id); const rows = body?.ingredients as Ingredient[];
      const name = (variantId: string) => ingredients.find((row) => row.default_variant_id === variantId);
      recipes[id] = rows.length === 0 ? null : { version: (recipes[id]?.version ?? 0) + 1, ingredients: rows.map((row) => ({ ...row, name: String(name(row.variant_id)?.name), sku: String(name(row.variant_id)?.variants[0].sku) })) };
      return route.fulfill({ json: { data: owner(id) } });
    }
    return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } } });
  });
  await installDashboardShell(page, { authenticated: true });
  await page.route('**/api/v3/admin/me', (route) => route.fulfill({ json: { id: 'staff_admin', email: 'admin@example.test', full_name: 'Quản trị Hiền', selected_locale: 'vi', stores: [{ id: 'store_1', name: 'Quán Hiền', code: 'store_1', default_currency: 'VND' }], permissions: [], permission_keys: ['read_pos_topology', 'write_pos_topology', 'read_products', 'write_products', 'read_product_types'] } }));
  return state;
}
const MENU = /^(Open actions|Mở menu thao tác)$/;

test('a recipe of two ingredients is created and sets the product cost', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/goods/recipes');
  if (test.info().project.name !== 'mobile') await expect(page.locator('[data-sidebar="sidebar"]').first().getByRole('link', { name: 'Công thức chế biến', exact: true })).toHaveAttribute('href', '/store_1/goods/recipes');
  const tea = page.locator('[data-recipe="v_tea_m"]');
  await expect(tea).toContainText('Trà sữa · Size: M');
  await expect(tea).toContainText('Giá vốn: 6.000 ₫');
  await expect(tea).toContainText('1 nguyên liệu');

  await page.getByRole('button', { name: 'Tạo công thức' }).click();
  const sheet = page.getByRole('dialog');
  const products = sheet.getByRole('list', { name: 'Sản phẩm' });
  await expect(products.getByRole('listitem').filter({ hasText: 'Trà sữa · Size: M' })).toContainText('Đã có');
  await expect(products.getByRole('listitem').filter({ hasText: 'Trà sữa · Size: L' })).not.toContainText('Đã có');
  // Ingredients are left out of what recipes make.
  expect(state.productLists.at(-1)?.get('q[g][0][product_type_id_not_eq]')).toBe('pt_ingredient');
  await sheet.getByRole('button', { name: 'Chọn Bánh flan' }).click();
  await expect(sheet.locator('[data-recipe-target]')).toHaveText('Bánh flan');

  await sheet.getByLabel('Thêm nguyên liệu').first().fill('sữa');
  await sheet.getByRole('button', { name: /Sữa tươi/ }).click();
  await sheet.getByRole('textbox', { name: 'Định lượng Sữa tươi', exact: true }).fill('99');
  await sheet.getByRole('button', { name: 'Tăng định lượng Sữa tươi' }).click();
  await expect(sheet.getByRole('textbox', { name: 'Định lượng Sữa tươi', exact: true })).toHaveValue('100');
  await sheet.getByLabel('Thêm nguyên liệu').first().fill('NL000002');
  await sheet.getByRole('button', { name: /Đường/ }).click();
  await sheet.getByRole('textbox', { name: 'Định lượng Đường', exact: true }).fill('10');
  const milk = sheet.locator('[data-recipe-line="v_milk"]');
  await expect(milk).toContainText('1');
  await expect(milk).toContainText('4.000 ₫');
  await expect(sheet.locator('[data-recipe-line="v_sugar"]')).toContainText('200 ₫');
  await expect(sheet.locator('[data-recipe-total]')).toHaveText('4.200 ₫');
  await expect(sheet.getByRole('switch', { name: 'Giá vốn theo nguyên liệu' })).toBeChecked();

  await sheet.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText('Đã lưu công thức của Bánh flan và đặt giá vốn 4.200 ₫.')).toBeVisible();
  expect(state.writes.map((write) => [write.method, write.path])).toEqual([
    ['PUT', '/pos/recipes'],
    ['PATCH', '/products/prod_cake/variants/v_cake'],
  ]);
  expect(state.writes[0].body).toMatchObject({ variant_id: 'v_cake', ingredients: [
    { variant_id: 'v_milk', quantity: '100', unit_code: 'ml' },
    { variant_id: 'v_sugar', quantity: '10', unit_code: 'g' },
  ] });
  expect(state.writes[1].body).toEqual({ cost_price: '4200' });
  const cake = page.locator('[data-recipe="v_cake"]');
  await expect(cake).toContainText('Giá vốn: 4.200 ₫');
  await expect(cake).toContainText('2 nguyên liệu');
});

test('a recipe is edited without touching a cost it does not follow, then deleted', async ({ page }) => {
  const state = await install(page, { modules: {} });
  await page.goto('/store_1/goods/recipes');
  // The selected branch does not run recipes: writing them still works.
  await expect(page.getByText('Chi nhánh Quận 1 chưa bật Công thức chế biến')).toBeVisible();
  await page.getByRole('button', { name: 'Trà sữa · Size: M' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('textbox', { name: 'Định lượng Sữa tươi', exact: true })).toHaveValue('150');
  // Its cost (5.000 ₫) is not the recipe's (6.000 ₫), so it is left alone.
  await expect(sheet.getByRole('switch', { name: 'Giá vốn theo nguyên liệu' })).not.toBeChecked();
  await expect(sheet.getByText('Giá vốn hiện tại: 5.000 ₫')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Lưu và tạo tiếp' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Giảm định lượng Sữa tươi' }).click();
  await expect(sheet.locator('[data-recipe-total]')).toHaveText('5.960 ₫');
  await sheet.getByRole('textbox', { name: 'Định lượng Sữa tươi', exact: true }).fill('0');
  await sheet.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(sheet.getByText('Nhập định lượng lớn hơn 0')).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await sheet.getByRole('textbox', { name: 'Định lượng Sữa tươi', exact: true }).fill('120');
  await sheet.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText('Đã lưu công thức của Trà sữa · Size: M.')).toBeVisible();
  expect(state.writes.map((write) => [write.method, write.path])).toEqual([['PUT', '/pos/recipes']]);
  await expect(page.locator('[data-recipe="v_tea_m"]')).toContainText('Giá vốn: 4.800 ₫');

  await page.locator('[data-recipe="v_tea_m"]').getByRole('button', { name: MENU }).click();
  await page.getByRole('menuitem', { name: 'Xoá công thức' }).click();
  await expect(page.getByText('Xoá công thức của Trà sữa · Size: M?', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Xoá công thức', exact: true }).click();
  await expect(page.getByText('Đã xoá công thức của Trà sữa · Size: M.')).toBeVisible();
  await expect(page.getByText('Chưa có công thức nào.')).toBeVisible();
  expect(state.writes.at(-1)).toEqual({ method: 'PUT', path: '/pos/recipes', body: expect.objectContaining({ variant_id: 'v_tea_m', ingredients: [] }) });
});
