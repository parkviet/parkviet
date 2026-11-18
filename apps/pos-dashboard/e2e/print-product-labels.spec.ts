import { expect, type Page, test } from '@playwright/test'
import { defaultProductLabel } from '@parkviet/pos-shared/product-label/defaults'
import { installDashboardShell } from './support/dashboard'

// Presentation fixtures for the label print dialog: the branch products, their
// variants and the label data the server would return. They never touch the
// real API.
const staff = { id: 'staff_admin', full_name: 'Quản trị Hiền', email: 'admin@example.test' }
const branch = {
  id: 'branch_main',
  name: 'Siêu thị Hiền',
  code: 'main',
  status: 'active',
  timezone: 'Asia/Ho_Chi_Minh',
  stock_location_id: 'stock_main',
  receiving_stock_location_id: null,
  receiving_note: null,
}
const products = [
  { id: 'prod_rice', name: 'Gạo ST25', status: 'active', skus: ['ST25-5KG', 'ST25-1KG'], assigned: true },
  { id: 'prod_milk', name: 'Sữa tươi', status: 'active', skus: ['SUA-1L'], assigned: true },
  { id: 'prod_tea', name: 'Trà xanh', status: 'active', skus: ['TRA-01'], assigned: false },
]
type Variant = {
  id: string
  product_id: string
  name: string
  sku: string
  barcode: string | null
  price: string | null
  options: string | null
}
const variants: Variant[] = [
  { id: 'variant_rice_5', product_id: 'prod_rice', name: 'Gạo ST25', sku: 'ST25-5KG', barcode: '8930000000500', price: '180000', options: 'Túi 5kg' },
  { id: 'variant_rice_1', product_id: 'prod_rice', name: 'Gạo ST25', sku: 'ST25-1KG', barcode: null, price: '38000', options: 'Túi 1kg' },
  { id: 'variant_milk', product_id: 'prod_milk', name: 'Sữa tươi', sku: 'SUA-1L', barcode: '8930000000012', price: null, options: null },
]
const templates = [
  { id: 'postpl_roll', name: 'Tem cuộn', paper: 'roll_50x30', is_default: true },
  { id: 'postpl_a4', name: 'Tem tờ A4', paper: 'sheet_a4_100', is_default: false },
].map((template) => ({
  ...template,
  document_type: 'product_label',
  status: 'active',
  current_version: 1,
  version: 1,
  created_at: '2026-11-08T02:00:00Z',
  updated_at: '2026-11-08T02:00:00Z',
  updated_by: null,
  config: defaultProductLabel(template.paper as never),
}))

const printer = (id: string, name: string, roles: string[], status = 'active') => ({
  id,
  branch_id: 'branch_main',
  name,
  connection: 'sunmi_builtin',
  address: null,
  bluetooth_id: null,
  paper: '58mm',
  command_language: roles.includes('product_label') ? 'tspl' : 'escpos',
  roles,
  print_station_device_id: 'posdevice_1',
  register_id: null,
  status,
  settings: {},
})
const printers = [
  printer('posprinter_labels', 'Máy tem kho', ['product_label']),
  printer('posprinter_labels_off', 'Máy tem cũ', ['product_label'], 'disabled'),
  printer('posprinter_kitchen', 'Máy bếp', ['kitchen_ticket']),
]

async function install(page: Page) {
  const state = {
    dataRequests: [] as unknown[],
    failData: false,
    printRequests: [] as { body: Record<string, unknown>; key: string | undefined }[],
    printFailures: 0,
  }
  // Browser printing is recorded instead of opening a dialog.
  await page.addInitScript(() => {
    window.print = () => {
      const root = window.top as unknown as { printedLabels?: string[] }
      root.printedLabels ??= []
      root.printedLabels.push(`${document.body.dataset.paper}|${document.querySelectorAll('.label').length}`)
    }
  })
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v3/admin', '')
    const method = request.method()
    if (path === '/pos/context')
      return route.fulfill({
        json: {
          staff,
          store: { id: 'store_1', name: 'Siêu thị Hiền', currency: 'VND', timezone: 'Asia/Ho_Chi_Minh' },
          administration: { read: true, write: true },
          capabilities: [],
          branches: [branch],
          registers: [],
          shift: null,
          selection: { branch_id: url.searchParams.get('branch_id'), register_id: null },
        },
      })
    if (path === '/pos/branches') return route.fulfill({ json: { data: [branch], meta: { next: null } } })
    if (path === '/pos/configuration/locations')
      return route.fulfill({ json: { data: [{ id: 'stock_main', name: 'Kho hàng trung tâm', active: true }] } })
    if (path === '/pos/branches/branch_main/products' && method === 'GET') {
      const q = (url.searchParams.get('q') ?? '').toLocaleLowerCase()
      const rows = products.filter((product) => !q || product.name.toLocaleLowerCase().includes(q))
      return route.fulfill({
        json: { data: rows, meta: { page: 1, limit: 25, pages: 1, count: rows.length, from: 1, to: rows.length, previous: null, next: null } },
      })
    }
    if (path === '/pos/catalog') {
      const q = (url.searchParams.get('q') ?? '').toLocaleLowerCase()
      const rows = variants
        .filter((variant) => products.find((p) => p.id === variant.product_id)?.assigned)
        .filter((variant) => [variant.name, variant.sku, variant.barcode ?? ''].some((text) => text.toLocaleLowerCase().includes(q)))
        .map((variant) => ({ ...variant, compare_at_price: null, currency: 'VND', stock_on_hand: 3 }))
      return route.fulfill({ json: { data: rows, meta: { page: 1, pages: 1, count: rows.length, ambiguous: false } } })
    }
    if (path === '/pos/branches/branch_main/product_labels/data' && method === 'POST') {
      const body = request.postDataJSON() as { items: { variant_id: string; quantity: number }[] }
      state.dataRequests.push(body)
      if (state.failData)
        return route.fulfill({ status: 422, json: { error: { code: 'invalid', message: 'Variant not found.' } } })
      const data = body.items.map((item) => {
        const variant = variants.find((v) => v.id === item.variant_id)
        if (!variant) throw new Error(`unknown ${item.variant_id}`)
        const warnings = variant.price === null ? ['no_price'] : []
        return {
          variant_id: variant.id,
          product_name: variant.name,
          variant_options: variant.options,
          sku: variant.sku,
          barcode: variant.barcode,
          unit: 'Cái',
          price: variant.price,
          original_price: null,
          currency: 'VND',
          quantity: item.quantity,
          warnings,
        }
      })
      return route.fulfill({ json: { data, store: { name: 'Siêu thị Hiền', address: '12 Lê Lợi, Quận 1' } } })
    }
    if (path === '/pos/printers' && method === 'GET') return route.fulfill({ json: { data: printers } })
    if (path === '/pos/branches/branch_main/product_labels/print' && method === 'POST') {
      state.printRequests.push({ body: request.postDataJSON() as Record<string, unknown>, key: request.headers()['idempotency-key'] })
      if (state.printFailures > 0) {
        state.printFailures -= 1
        return route.fulfill({ status: 409, json: { error: { code: 'conflict', message: 'x', details: { reason: 'printer_station_unavailable' } } } })
      }
      return route.fulfill({ status: 201, json: { data: { print_jobs: [{ id: 'posprintjob_1', kind: 'product_label' }, { id: 'posprintjob_2', kind: 'product_label' }] } } })
    }
    if (path === '/pos/receipt_templates' && method === 'GET')
      return route.fulfill({ json: { data: templates } })
    return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } } })
  })
  await installDashboardShell(page, { read: true, write: true, authenticated: true })
  return state
}

const printed = (page: Page) =>
  page.evaluate(() => (window as unknown as { printedLabels?: string[] }).printedLabels ?? [])
const dialog = (page: Page) => page.getByRole('dialog')
const preview = (page: Page) => page.frameLocator('[data-testid="product-label-print-preview-frame"]')

async function openDialog(page: Page) {
  await page.goto('/store_1/branches/branch_main/products')
  await page.getByRole('checkbox', { name: 'Chọn Gạo ST25 để in tem' }).check()
  await page.getByRole('checkbox', { name: 'Chọn Sữa tươi để in tem' }).check()
  await page.getByRole('button', { name: 'In tem (2)' }).click()
  await expect(dialog(page).getByTestId('label-row')).toHaveCount(3)
}

test('print dialog: copies, template, start cell, preview counts and browser print', async ({ page }) => {
  const state = await install(page)
  await openDialog(page)

  // Rows show the variant, its code, unit and price; a missing price warns.
  const rows = dialog(page).getByTestId('label-row')
  await expect(rows.nth(0)).toContainText('Gạo ST25 · Túi 5kg')
  await expect(rows.nth(0)).toContainText('8930000000500')
  await expect(rows.nth(0).getByTestId('label-row-price')).toContainText('180000')
  await expect(rows.nth(2).locator('[data-warning="no_price"]')).toBeVisible()
  expect(state.dataRequests).toHaveLength(1)

  // One roll label per row: three pages.
  await expect(dialog(page).getByTestId('label-counts')).toHaveText('3 trang · 3 tem')

  // Copies change the counts without asking the server again.
  await rows.nth(0).getByRole('button', { name: 'Tăng số tem' }).click()
  await rows.nth(0).getByRole('button', { name: 'Tăng số tem' }).click()
  await expect(rows.nth(0).getByLabel('Số tem', { exact: true })).toHaveValue('3')
  await expect(dialog(page).getByTestId('label-counts')).toHaveText('5 trang · 5 tem')
  expect(state.dataRequests).toHaveLength(1)

  // A4 sheet of 100: the start cell leaves the first cells empty.
  await dialog(page).getByLabel('Mẫu tem', { exact: true }).click()
  await page.getByRole('option', { name: /Tem tờ A4/ }).click()
  await expect(dialog(page).getByTestId('label-start-cell')).toBeVisible()
  await expect(dialog(page).getByTestId('label-counts')).toHaveText('1 trang · 5 tem')
  await dialog(page).getByRole('button', { name: 'Ô 5', exact: true }).click()
  await expect(dialog(page).getByRole('button', { name: 'Ô 5', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(preview(page).locator('.label')).toHaveCount(5)
  await dialog(page).getByRole('button', { name: 'Ô 99', exact: true }).click()
  await expect(dialog(page).getByTestId('label-counts')).toHaveText('2 trang · 5 tem')

  // Removing a row drops its labels.
  await rows.nth(1).getByRole('button', { name: 'Xoá dòng' }).click()
  await expect(rows).toHaveCount(2)
  await expect(dialog(page).getByTestId('label-counts')).toHaveText('2 trang · 4 tem')

  // Adding a variant by search.
  await dialog(page).getByPlaceholder('Tìm theo tên, mã hàng hoặc mã vạch').fill('ST25-1KG')
  await dialog(page).getByTestId('label-variant-results').getByRole('button', { name: /Gạo ST25/ }).click()
  await expect(rows).toHaveCount(3)

  // Printing goes through the browser with the chosen stock.
  await dialog(page).getByRole('button', { name: /^In \d+ tem$/ }).click()
  await expect.poll(async () => (await printed(page)).length).toBe(1)
  expect((await printed(page))[0]).toMatch(/^sheet_a4_100\|5$/)
})

test('print dialog: selection rules and a failed data request', async ({ page }) => {
  const state = await install(page)
  await page.goto('/store_1/branches/branch_main/products')
  // A product that is not sold at the branch cannot be chosen.
  await expect(page.getByRole('checkbox', { name: /Trà xanh chưa bán ở chi nhánh/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'In tem (0)' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Chọn tất cả trong trang' }).first().check()
  await expect(page.getByRole('button', { name: 'In tem (2)' })).toBeEnabled()

  state.failData = true
  await page.getByRole('button', { name: 'In tem (2)' }).click()
  await expect(dialog(page).getByRole('alert')).toContainText('Không tải được dữ liệu tem')
  await expect(dialog(page).getByRole('button', { name: /^In \d* ?tem$|^In 0 tem$/ })).toBeDisabled()
  expect(await printed(page)).toEqual([])
})

test('print dialog: sends a roll to a label printer, retrying a failure under one key', async ({ page }) => {
  const state = await install(page)
  await openDialog(page)
  const printerSelect = dialog(page).getByLabel('Máy in', { exact: true })

  // Only the active label printer is offered next to the browser.
  await printerSelect.click()
  await expect(page.getByRole('option')).toHaveText(['Trình duyệt', 'Máy tem kho'])
  await page.getByRole('option', { name: 'Máy tem kho', exact: true }).click()
  await expect(dialog(page).getByText('Trong hộp thoại in, chọn đúng khổ giấy')).toHaveCount(0)

  // A failed send says why and a retry reuses its key; success reports the jobs.
  state.printFailures = 1
  await dialog(page).getByRole('button', { name: /^In \d+ tem$/ }).click()
  await expect(dialog(page).getByRole('alert')).toContainText('Không gửi được tem tới máy in')
  await dialog(page).getByRole('button', { name: /^In \d+ tem$/ }).click()
  await expect(dialog(page).getByTestId('label-sent')).toHaveText('Đã gửi 3 tem tới Máy tem kho (2 lệnh in).')
  expect(state.printRequests).toHaveLength(2)
  expect(state.printRequests[1].key).toBe(state.printRequests[0].key)
  expect(state.printRequests[1].body).toEqual({
    template_id: 'postpl_roll',
    printer_id: 'posprinter_labels',
    items: [
      { variant_id: 'variant_rice_5', quantity: 1 },
      { variant_id: 'variant_rice_1', quantity: 1 },
      { variant_id: 'variant_milk', quantity: 1 },
    ],
  })
  expect(await printed(page)).toEqual([])
})

test('print dialog: a sheet stock prints from the browser only', async ({ page }) => {
  const state = await install(page)
  await openDialog(page)
  await dialog(page).getByLabel('Mẫu tem', { exact: true }).click()
  await page.getByRole('option', { name: /Tem tờ A4/ }).click()

  await dialog(page).getByLabel('Máy in', { exact: true }).click()
  await expect(page.getByRole('option')).toHaveText(['Trình duyệt'])
  await page.keyboard.press('Escape')
  await expect(dialog(page).getByText('Tờ decal chỉ in được bằng trình duyệt.')).toBeVisible()
  await dialog(page).getByRole('button', { name: /^In \d+ tem$/ }).click()
  await expect.poll(async () => (await printed(page)).length).toBe(1)
  expect(state.printRequests).toEqual([])
})
