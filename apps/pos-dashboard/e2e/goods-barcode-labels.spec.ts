import { expect, type Page, test } from '@playwright/test'
import { defaultProductLabel } from '@parkviet/pos-shared/product-label/defaults'
import { installDashboardShell } from './support/dashboard'

// Presentation fixtures for the barcode label screen: the branch catalog, base
// prices and the label data the server would return. They never touch the
// real API or grant real privileges.
const branch = {
  id: 'branch_main',
  name: 'Siêu thị Hiền',
  code: 'main',
  status: 'active',
  timezone: 'Asia/Ho_Chi_Minh',
  stock_location_id: 'stock_main',
  receiving_stock_location_id: null,
}
type Variant = {
  id: string
  product_id: string
  name: string
  sku: string
  barcode: string | null
  base: string
  price: string
  options: string | null
  stock: number | null
}
const variants: Variant[] = [
  { id: 'variant_rice_5', product_id: 'prod_rice', name: 'Gạo ST25', sku: 'ST25-5KG', barcode: '8930000000500', base: '200000', price: '180000', options: 'Túi 5kg', stock: 4 },
  { id: 'variant_rice_1', product_id: 'prod_rice', name: 'Gạo ST25', sku: 'ST25-1KG', barcode: null, base: '38000', price: '38000', options: 'Túi 1kg', stock: null },
  { id: 'variant_milk', product_id: 'prod_milk', name: 'Sữa tươi', sku: 'SUA-1L', barcode: '8930000000012', base: '32000', price: '32000', options: null, stock: -2 },
]
const template = {
  id: 'postpl_roll',
  name: 'Tem cuộn',
  paper: 'roll_50x30',
  is_default: true,
  document_type: 'product_label',
  status: 'active',
  current_version: 1,
  version: 1,
  created_at: '2026-11-08T02:00:00Z',
  updated_at: '2026-11-08T02:00:00Z',
  updated_by: null,
  config: defaultProductLabel('roll_50x30' as never),
}

async function install(page: Page) {
  const state = { priceQueries: [] as string[] }
  await page.addInitScript(() => {
    window.print = () => {
      const root = window.top as unknown as { printedLabels?: string[] }
      root.printedLabels ??= []
      root.printedLabels.push(`${document.body.dataset.paper}|${document.querySelectorAll('.label').length}`)
    }
  })
  const catalogRow = (variant: Variant) => ({
    id: variant.id,
    product_id: variant.product_id,
    name: variant.name,
    sku: variant.sku,
    barcode: variant.barcode,
    price: variant.price,
    compare_at_price: null,
    currency: 'VND',
    stock_on_hand: variant.stock,
  })
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v3/admin', '')
    const method = request.method()
    if (path === '/pos/context')
      return route.fulfill({
        json: {
          staff: { id: 'staff_admin', full_name: 'Quản trị Hiền' },
          store: { id: 'store_1', name: 'Siêu thị Hiền', currency: 'VND', timezone: 'Asia/Ho_Chi_Minh' },
          administration: { read: true, write: true },
          capabilities: [],
          branches: [branch],
          registers: [],
          shift: null,
          selection: { branch_id: 'branch_main', register_id: null },
        },
      })
    if (path === '/pos/catalog') {
      const q = (url.searchParams.get('q') ?? '').toLocaleLowerCase()
      const rows =
        url.searchParams.get('barcode') === 'true'
          ? variants.filter((variant) => variant.barcode === q)
          : variants.filter((variant) => [variant.name, variant.sku, variant.barcode ?? ''].some((text) => text.toLocaleLowerCase().includes(q)))
      return route.fulfill({ json: { data: rows.map(catalogRow), meta: { page: 1, pages: 1, count: rows.length, ambiguous: false } } })
    }
    if (path === '/prices' && method === 'GET') {
      state.priceQueries.push(url.search)
      const ids = url.searchParams.getAll('q[variant_id_in][]')
      const rows = variants
        .filter((variant) => ids.includes(variant.id))
        .map((variant) => ({ id: `price_${variant.id}`, variant_id: variant.id, amount: variant.base, compare_at_amount: null, currency: 'VND', price_list_id: null, min_quantity: 1 }))
      return route.fulfill({ json: { data: rows, meta: { page: 1, limit: 100, count: rows.length, pages: 1, next: null } } })
    }
    if (path === '/pos/branches/branch_main/product_labels/data' && method === 'POST') {
      const body = request.postDataJSON() as { items: { variant_id: string; quantity: number }[] }
      const data = body.items.map((item) => {
        const variant = variants.find((row) => row.id === item.variant_id) as Variant
        return { variant_id: variant.id, product_name: variant.name, variant_options: variant.options, sku: variant.sku, barcode: variant.barcode, unit: 'Cái', price: variant.price, original_price: null, currency: 'VND', quantity: item.quantity, warnings: [] }
      })
      return route.fulfill({ json: { data, store: { name: 'Siêu thị Hiền', address: '12 Lê Lợi, Quận 1' } } })
    }
    if (path === '/pos/receipt_templates' && method === 'GET') return route.fulfill({ json: { data: [template] } })
    if (path === '/pos/printers') return route.fulfill({ json: { data: [] } })
    return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } } })
  })
  await installDashboardShell(page, { authenticated: true })
  await page.route('**/api/v3/admin/me', (route) =>
    route.fulfill({
      json: {
        id: 'staff_admin',
        email: 'admin@example.test',
        full_name: 'Quản trị Hiền',
        selected_locale: 'vi',
        stores: [{ id: 'store_1', name: 'Siêu thị Hiền', code: 'store_1', default_currency: 'VND' }],
        permissions: [],
        permission_keys: ['read_pos_topology', 'write_pos_topology', 'read_products', 'write_products'],
      },
    }),
  )
  return state
}

const printed = (page: Page) =>
  page.evaluate(() => (window as unknown as { printedLabels?: string[] }).printedLabels ?? [])
const rows = (page: Page) => page.getByTestId('barcode-label-row')
const search = (page: Page) => page.getByRole('searchbox', { name: 'Tìm hoặc quét hàng' })

test('pick goods by search and scan, set counts, print through the label dialog', async ({ page }) => {
  const state = await install(page)
  await page.goto('/store_1/goods/barcode-labels')
  await expect(
    page.locator('[data-sidebar="sidebar"]').first().getByRole('link', { name: 'In tem mã vạch', exact: true }),
  ).toHaveAttribute('href', '/store_1/goods/barcode-labels')
  await expect(page.getByRole('link', { name: 'Mẫu tem sản phẩm' })).toHaveAttribute('href', '/store_1/settings/receipt-templates?tab=labels')
  await expect(page.getByRole('link', { name: 'Tem cân' })).toHaveAttribute('href', '/store_1/scale-labels')

  // A search lists the branch's variants; picking one adds a row.
  await search(page).fill('Gạo')
  const results = page.getByTestId('barcode-label-results')
  await expect(results.getByRole('button')).toHaveCount(2)
  await results.getByRole('button', { name: /ST25-5KG/ }).click()
  await expect(rows(page)).toHaveCount(1)
  await expect(search(page)).toHaveValue('')

  // A scanned barcode adds its variant; scanning it again asks for one more label.
  await search(page).fill('8930000000012')
  await search(page).press('Enter')
  await expect(rows(page)).toHaveCount(2)
  await search(page).fill('8930000000012')
  await search(page).press('Enter')
  await expect(rows(page)).toHaveCount(2)
  await expect(page.getByLabel('Số tem Sữa tươi', { exact: true })).toHaveValue('2')

  // The selling price is the base price; a POS price list shows as the promotional price.
  const rice = rows(page).filter({ hasText: 'ST25-5KG' })
  await expect(rice).toContainText('Gạo ST25 · Túi 5kg')
  await expect(rice.getByTestId('price')).toHaveText('200.000 ₫')
  await expect(rice.getByTestId('promo')).toHaveText('180.000 ₫')
  await expect(rice.getByTestId('stock')).toHaveText('4')
  const milk = rows(page).filter({ hasText: 'SUA-1L' })
  await expect(milk.getByTestId('price')).toHaveText('32.000 ₫')
  await expect(milk.getByTestId('promo')).toHaveText('—')
  await expect(milk.getByTestId('stock')).toHaveText('-2')
  expect(state.priceQueries.some((query) => decodeURIComponent(query).includes('q[price_list_id_null]=true'))).toBe(true)

  // Labels per product applied to all, then counts from stock.
  await page.getByLabel('Số tem mỗi sản phẩm').fill('3')
  await page.getByRole('button', { name: 'Áp dụng cho tất cả' }).click()
  await expect(page.getByLabel('Số tem Gạo ST25 · Túi 5kg', { exact: true })).toHaveValue('3')
  await expect(page.getByLabel('Số tem Sữa tươi', { exact: true })).toHaveValue('3')
  await expect(page.getByTestId('barcode-label-total')).toHaveText('2 hàng · 6 tem')
  await page.getByRole('button', { name: 'Theo tồn kho' }).click()
  await expect(page.getByLabel('Số tem Gạo ST25 · Túi 5kg', { exact: true })).toHaveValue('4')
  await expect(page.getByLabel('Số tem Sữa tươi', { exact: true })).toHaveValue('0')
  await expect(page.getByTestId('barcode-label-total')).toHaveText('1 hàng · 4 tem')
  await page.getByRole('button', { name: 'Tăng số tem Gạo ST25 · Túi 5kg' }).click()

  // The shared dialog opens with the rows that have labels, and prints from the browser.
  await page.getByRole('button', { name: 'In tem (5)' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByTestId('label-row')).toHaveCount(1)
  await expect(dialog.getByTestId('label-row').getByLabel('Số tem', { exact: true })).toHaveValue('5')
  await expect(dialog.getByTestId('label-counts')).toHaveText('5 trang · 5 tem')
  await dialog.getByRole('button', { name: 'In 5 tem' }).click()
  await expect.poll(async () => (await printed(page)).length).toBe(1)
  expect((await printed(page))[0]).toBe('roll_50x30|5')
})

test('nothing to print until a row has labels, and clearing asks first', async ({ page }) => {
  await install(page)
  await page.goto('/store_1/goods/barcode-labels')
  await expect(page.getByText('Chưa chọn hàng nào. Tìm hoặc quét mã để thêm.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'In tem (0)' })).toBeDisabled()

  await search(page).fill('khong-co')
  await search(page).press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Không có đúng một hàng khớp' })).toBeVisible()

  await search(page).fill('SUA-1L')
  await search(page).press('Enter')
  await expect(rows(page)).toHaveCount(1)
  await page.getByRole('button', { name: 'Giảm số tem Sữa tươi' }).click()
  await expect(page.getByRole('button', { name: 'In tem (0)' })).toBeDisabled()

  await page.getByRole('button', { name: 'Xoá danh sách' }).click()
  await page.getByRole('dialog', { name: 'Xoá danh sách in tem?' }).getByRole('button', { name: 'Xoá danh sách' }).click()
  await expect(rows(page)).toHaveCount(0)
})
