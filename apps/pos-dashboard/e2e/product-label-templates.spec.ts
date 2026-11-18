import { expect, type Page, test } from '@playwright/test'
import { defaultProductLabel } from '@parkviet/pos-shared/product-label/defaults'
import { PRODUCT_LABEL_PRESETS } from '@parkviet/pos-shared/product-label/presets'
import type { ProductLabelConfig } from '@parkviet/pos-shared/product-label/types'
import { DEFAULT_TEMPLATES } from '@parkviet/pos-shared/receipt-template/defaults'
import { installDashboardShell } from './support/dashboard'

// Presentation fixtures for the label template pages: they keep versions and
// stale writes the way the template store does, and never touch the real API.
type Template = {
  id: string
  document_type: 'product_label' | 'sale'
  name: string
  paper: string
  status: 'active' | 'disabled'
  is_default: boolean
  current_version: number
  updated_at: string
}
type Version = { version: number; config: unknown; created_at: string }
type Write = { method: string; path: string; body: Record<string, unknown> | null }

const staff = { id: 'staff_admin', full_name: 'Quản trị Hiền', email: 'admin@example.test' }
const branch = {
  id: 'branch_main',
  name: 'Chi nhánh Quận 1',
  code: 'q1',
  status: 'active',
  timezone: 'Asia/Ho_Chi_Minh',
  stock_location_id: 'stock_main',
  receiving_stock_location_id: null,
  receiving_note: null,
  return_window_days: 7,
}
const profile = {
  address: '12 Lê Lợi, Quận 1',
  contact_phone: '0901 234 567',
  customer_support_email: null,
  url: null,
  facebook: null,
  instagram: null,
  logo_url: null,
}
const PAPER_NAMES: Record<string, string> = {
  roll_50x30: '50×30mm',
  roll_40x30: '40×30mm',
  roll_75x25_2: '75×25mm · 2 tem',
  roll_72x22_2: '72×22mm · 2 tem',
  roll_110x22_3: '110×22mm · 3 tem',
  sheet_a4_100: 'A4 · 100 tem',
  sheet_a4_65: 'A4 · 65 tem',
  sheet_a4_180: 'A4 · 180 tem',
  sheet_a5_40: 'A5 · 40 tem',
}

async function install(page: Page, access = { read: true, write: true }) {
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
  const templates: Template[] = [
    {
      id: 'postpl_sale',
      document_type: 'sale',
      name: 'Phiếu bán hàng',
      paper: '80mm',
      status: 'active',
      is_default: true,
      current_version: 1,
      updated_at: '2026-11-08T02:00:00Z',
    },
    ...PRODUCT_LABEL_PRESETS.map((preset, index) => ({
      id: `postpl_L${index + 1}`,
      document_type: 'product_label' as const,
      name: `Tem ${PAPER_NAMES[preset.code]}`,
      paper: preset.code,
      status: 'active' as const,
      is_default: index === 0,
      current_version: 1,
      updated_at: '2026-11-08T02:00:00Z',
    })),
  ]
  const versions = new Map<string, Version[]>(
    templates.map((template) => [
      template.id,
      [
        {
          version: 1,
          config:
            template.document_type === 'sale'
              ? clone(DEFAULT_TEMPLATES.sale)
              : defaultProductLabel(template.paper as never),
          created_at: '2026-11-08T02:00:00Z',
        },
      ],
    ]),
  )
  const state = { writes: [] as Write[], nextPatch: '' as '' | 'conflict' }
  const toPos = (template: Template) => ({
    ...template,
    version: template.current_version,
    created_at: '2026-11-08T02:00:00Z',
    config: versions.get(template.id)?.find((version) => version.version === template.current_version)
      ?.config,
    updated_by: { id: staff.id, name: staff.full_name },
  })
  const revise = (template: Template, config: unknown) => {
    template.current_version += 1
    template.updated_at = '2026-11-08T03:00:00Z'
    versions
      .get(template.id)
      ?.push({ version: template.current_version, config: clone(config), created_at: template.updated_at })
  }
  const create = (source: Template, name: string, paper: string, config: unknown) => {
    const created: Template = {
      ...source,
      id: `postpl_L${templates.length + 1}`,
      name,
      paper,
      status: 'active',
      is_default: false,
      current_version: 1,
    }
    templates.push(created)
    versions.set(created.id, [
      { version: 1, config: clone(config), created_at: '2026-11-08T03:00:00Z' },
    ])
    return created
  }

  // Browser printing is recorded instead of opening a dialog.
  await page.addInitScript(() => {
    window.print = () => {
      const root = window.top as unknown as { printedLabels?: string[] }
      root.printedLabels ??= []
      root.printedLabels.push(`${document.body.dataset.paper}|${document.body.textContent}`)
    }
  })
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v3/admin', '')
    const method = request.method()
    const body = method === 'GET' ? null : ((request.postDataJSON() ?? {}) as Record<string, unknown>)
    if (method !== 'GET' && !/\/auth\//.test(path)) state.writes.push({ method, path, body })
    const notFound = () =>
      route.fulfill({ status: 404, json: { error: { code: 'not_found', message: 'Not found' } } })
    if (path === '/pos/context')
      return route.fulfill({
        json: {
          staff,
          store: {
            id: 'store_1',
            name: 'Park Việt',
            currency: 'VND',
            locale: 'vi',
            timezone: 'Asia/Ho_Chi_Minh',
            profile,
          },
          administration: access,
          capabilities: [],
          branches: [branch],
          registers: [],
          shift: null,
          selection: { branch_id: url.searchParams.get('branch_id'), register_id: null },
        },
      })
    if (path === '/pos/branches')
      return route.fulfill({ json: { data: [branch], meta: { next: null } } })
    const match =
      /^\/pos\/receipt_templates(?:\/([^/]+))?(?:\/(versions|duplicate|default|restore|disable|enable))?$/.exec(
        path,
      )
    if (!match)
      return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } } })
    const [, id, action] = match
    if (!id && method === 'GET') {
      const type = url.searchParams.get('document_type')
      return route.fulfill({
        json: {
          data: templates
            .filter((template) => !type || template.document_type === type)
            .filter(
              (template) =>
                url.searchParams.get('include_disabled') === '1' || template.status === 'active',
            )
            .map(toPos),
        },
      })
    }
    if (!id && method === 'POST') {
      const source = templates.find(
        (template) => template.document_type === body?.from_default && template.is_default,
      )
      if (!source) return notFound()
      return route.fulfill({
        status: 201,
        json: {
          data: toPos(
            create(
              source,
              String(body?.name),
              String(body?.paper),
              defaultProductLabel(String(body?.paper) as never),
            ),
          ),
        },
      })
    }
    const template = templates.find((item) => item.id === id)
    if (!template) return notFound()
    if (!action && method === 'GET') return route.fulfill({ json: { data: toPos(template) } })
    if (action === 'versions') {
      const rows = [...(versions.get(template.id) ?? [])]
        .reverse()
        .map((version) => ({ ...version, created_by: { id: staff.id, name: staff.full_name } }))
      return route.fulfill({ json: { data: rows, meta: { next: null } } })
    }
    if (!action && method === 'PATCH') {
      if (body?.expected_version !== template.current_version)
        return route.fulfill({
          status: 409,
          json: {
            error: {
              code: 'conflict',
              message: 'Stale.',
              details: { reason: 'template_version_conflict', current_version: template.current_version },
            },
          },
        })
      template.name = String(body?.name)
      template.paper = String(body?.paper)
      revise(template, body?.config)
      return route.fulfill({ json: { data: toPos(template) } })
    }
    if (action === 'duplicate')
      return route.fulfill({
        status: 201,
        json: {
          data: toPos(
            create(
              template,
              `${template.name} (bản sao)`,
              template.paper,
              versions.get(template.id)?.at(-1)?.config,
            ),
          ),
        },
      })
    if (action === 'default') {
      for (const other of templates)
        if (other.document_type === template.document_type) other.is_default = other.id === template.id
      return route.fulfill({ json: { data: toPos(template) } })
    }
    if (action === 'disable') {
      template.status = 'disabled'
      template.is_default = false
      return route.fulfill({ json: { data: toPos(template) } })
    }
    if (action === 'enable') {
      template.status = 'active'
      return route.fulfill({ json: { data: toPos(template) } })
    }
    if (action === 'restore') {
      if (body?.expected_version !== template.current_version) return notFound()
      const source = versions.get(template.id)?.find((version) => version.version === body?.version)
      if (!source) return notFound()
      revise(template, source.config)
      return route.fulfill({ json: { data: toPos(template) } })
    }
    return notFound()
  })
  await installDashboardShell(page, { ...access, authenticated: true })
  return { state, templates, versions }
}

const cards = (page: Page) => page.getByRole('article')
const card = (page: Page, name: string) => page.getByRole('article', { name, exact: true })
const labelFrame = (page: Page, testId = 'product-label-preview') =>
  page.frameLocator(`[data-testid="${testId}-frame"]`)
const printed = (page: Page) =>
  page.evaluate(() => (window as unknown as { printedLabels?: string[] }).printedLabels ?? [])

async function openLabels(page: Page) {
  await page.goto('/store_1/settings/receipt-templates?tab=labels')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mẫu in')
  await expect(page.getByTestId('label-template-gallery')).toBeVisible()
}
async function actOn(page: Page, name: string, item: string) {
  await card(page, name)
    .getByRole('button', { name: `Mở menu thao tác mẫu ${name}`, exact: true })
    .click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}
async function show(page: Page, pane: 'Chỉnh sửa' | 'Xem trước') {
  await page.getByLabel('Tên mẫu').waitFor({ state: 'attached' })
  const toggle = page.getByRole('button', { name: pane, exact: true })
  if (await toggle.isVisible()) await toggle.click()
  await expect(
    pane === 'Xem trước' ? labelFrame(page).locator('.label').first() : page.getByLabel('Tên mẫu'),
  ).toBeVisible()
}
async function openSection(page: Page, title: string) {
  const trigger = page.getByRole('button', { name: new RegExp(`^${title}`) })
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
}

test('label tab lists the nine stocks with real previews, filters, duplicates, defaults and disables', async ({
  page,
}) => {
  const { state } = await install(page)
  page.on('dialog', (dialog) => dialog.accept())
  await openLabels(page)

  await expect(cards(page)).toHaveCount(9)
  await expect(card(page, 'Tem 50×30mm')).toContainText('Mặc định')
  await expect(card(page, 'Tem 50×30mm')).toHaveAttribute('data-default', 'true')
  // The thumbnail is the label markup, not a placeholder image.
  await expect(
    card(page, 'Tem 50×30mm').frameLocator('iframe').locator('.label').first(),
  ).toContainText('Sữa tươi tiệt trùng 1L')
  await expect(card(page, 'Tem A4 · 100 tem').frameLocator('iframe').locator('.label')).toHaveCount(1)
  await expect(card(page, 'Tem 110×22mm · 3 tem').frameLocator('iframe').locator('.label')).toHaveCount(3)

  // Filter by stock family and search by name.
  await page.getByRole('combobox', { name: 'Khổ tem', exact: true }).click()
  await page.getByRole('option', { name: 'Tờ A4', exact: true }).click()
  await expect(page).toHaveURL(/group=a4/)
  await expect(cards(page)).toHaveCount(3)
  await page.getByRole('combobox', { name: 'Khổ tem', exact: true }).click()
  await page.getByRole('option', { name: 'Cuộn 2 tem', exact: true }).click()
  await expect(cards(page)).toHaveCount(2)
  await page.getByRole('combobox', { name: 'Khổ tem', exact: true }).click()
  await page.getByRole('option', { name: 'Tất cả khổ tem', exact: true }).click()
  await expect(cards(page)).toHaveCount(9)
  await page.getByRole('searchbox', { name: 'Tìm theo tên' }).fill('40×30')
  await expect(cards(page)).toHaveCount(1)
  await page.getByRole('searchbox', { name: 'Tìm theo tên' }).fill('không có tem này')
  await expect(page.getByText('Không có mẫu tem nào khớp bộ lọc.')).toBeVisible()
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).first().click()
  await expect(cards(page)).toHaveCount(9)

  await actOn(page, 'Tem A4 · 65 tem', 'Đặt mặc định')
  await expect(
    page.getByRole('status').filter({ hasText: '“Tem A4 · 65 tem” là mẫu mặc định.' }),
  ).toBeVisible()
  await expect(card(page, 'Tem A4 · 65 tem')).toHaveAttribute('data-default', 'true')
  await expect(card(page, 'Tem 50×30mm')).not.toHaveAttribute('data-default', 'true')

  await actOn(page, 'Tem 40×30mm', 'Nhân bản')
  await expect(card(page, 'Tem 40×30mm (bản sao)')).toBeVisible()
  await actOn(page, 'Tem 40×30mm (bản sao)', 'Ngừng dùng')
  await page.getByRole('dialog').getByRole('button', { name: 'Ngừng dùng', exact: true }).click()
  await expect(card(page, 'Tem 40×30mm (bản sao)')).toHaveAttribute('data-status', 'disabled')
  expect(state.writes.map((write) => write.path).slice(-3)).toEqual([
    '/pos/receipt_templates/postpl_L7/default',
    '/pos/receipt_templates/postpl_L2/duplicate',
    '/pos/receipt_templates/postpl_L11/disable',
  ])
  await actOn(page, 'Tem 40×30mm (bản sao)', 'Dùng lại')
  await expect(card(page, 'Tem 40×30mm (bản sao)')).toHaveAttribute('data-status', 'active')
  expect(state.writes.at(-1)?.path).toBe('/pos/receipt_templates/postpl_L11/enable')
  await actOn(page, 'Tem 40×30mm (bản sao)', 'Ngừng dùng')
  await page.getByRole('dialog').getByRole('button', { name: 'Ngừng dùng', exact: true }).click()
  await expect(card(page, 'Tem 40×30mm (bản sao)')).toHaveAttribute('data-status', 'disabled')

  // Preview dialog of a card.
  await card(page, 'Tem 75×25mm · 2 tem')
    .getByRole('button', { name: 'Xem trước mẫu Tem 75×25mm · 2 tem' })
    .first()
    .click()
  const dialog = page.getByRole('dialog', { name: 'Xem trước · Tem 75×25mm · 2 tem' })
  await expect(dialog).toBeVisible()
  await expect(labelFrame(page, 'product-label-dialog-preview').locator('.label')).toHaveCount(2)
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click()

  // Create from a chosen stock.
  await page.getByRole('button', { name: 'Tạo mẫu tem', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'Tạo mẫu tem sản phẩm' })
  await create.getByRole('radio', { name: /^A5 · 40 tem/ }).check()
  await expect(create.getByLabel('Tên mẫu')).toHaveValue('Tem A5 · 40 tem')
  await create.getByLabel('Tên mẫu').fill('Tem A5 cửa hàng')
  await create.getByRole('button', { name: 'Tạo và chỉnh sửa', exact: true }).click()
  await expect(page).toHaveURL(/\/settings\/receipt-templates\/postpl_L12$/)
  expect(state.writes.at(-1)).toEqual({
    method: 'POST',
    path: '/pos/receipt_templates',
    body: { from_default: 'product_label', name: 'Tem A5 cửa hàng', paper: 'sheet_a5_40' },
  })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sửa mẫu tem · Tem A5 cửa hàng')

  // The receipts tab is untouched and holds no label templates.
  await page.goto('/store_1/settings/receipt-templates')
  await expect(page.getByRole('article', { name: 'Phiếu bán hàng', exact: true })).toBeVisible()
  await expect(page.getByRole('article', { name: /^Tem / })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Tem sản phẩm' }).click()
  await expect(page).toHaveURL(/tab=labels/)
  await expect(page.getByTestId('label-template-gallery')).toBeVisible()
})

test('label editor: switch a field off, save, reload, undo, order, overrides and default', async ({
  page,
}) => {
  const { state } = await install(page)
  await page.goto('/store_1/settings/receipt-templates/postpl_L1')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sửa mẫu tem · Tem 50×30mm')
  await show(page, 'Xem trước')
  await expect(labelFrame(page).locator('.label')).toHaveCount(1)
  await expect(labelFrame(page).locator('.label').first()).toContainText('Sữa tươi tiệt trùng 1L')
  await expect(labelFrame(page).locator('.label').first()).toContainText('32.000')

  await show(page, 'Chỉnh sửa')
  const price = page.getByRole('checkbox', { name: 'Giá bán', exact: true })
  await expect(price).toBeChecked()
  await price.uncheck()
  await show(page, 'Xem trước')
  await expect(labelFrame(page).locator('.label').first()).not.toContainText('32.000')
  await show(page, 'Chỉnh sửa')

  // Undo brings it back; redo takes it away again.
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click()
  await expect(price).toBeChecked()
  await page.getByRole('button', { name: 'Làm lại', exact: true }).click()
  await expect(price).not.toBeChecked()

  // Reorder: the barcode goes above the name; the print order follows.
  await page.getByRole('button', { name: 'Chuyển lên: Mã vạch' }).click()
  await page.getByRole('button', { name: 'Chuyển lên: Mã vạch' }).click()
  await expect(page.getByRole('listitem', { name: 'Mã vạch, vị trí 3' })).toBeVisible()

  // Store name override and caption.
  await page.getByRole('checkbox', { name: 'Tên cửa hàng', exact: true }).check()
  await page.getByLabel('Nội dung in thay cho Tên cửa hàng').fill('Cửa hàng Hiền')
  await page.getByRole('checkbox', { name: 'Mã hàng (SKU)', exact: true }).check()
  await page.getByLabel('Nhãn đứng trước Mã hàng (SKU)').fill('Mã')
  await show(page, 'Xem trước')
  await expect(labelFrame(page).locator('.label').first()).toContainText('Cửa hàng Hiền')
  await expect(labelFrame(page).locator('.label').first()).toContainText('Mã SP000101')
  await show(page, 'Chỉnh sửa')

  await page.getByRole('button', { name: 'Lưu', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu phiên bản 2.' })).toBeVisible()
  const saved = state.writes.at(-1)
  expect(saved).toMatchObject({
    method: 'PATCH',
    path: '/pos/receipt_templates/postpl_L1',
    body: { expected_version: 1, name: 'Tem 50×30mm', paper: 'roll_50x30' },
  })
  const config = saved?.body?.config as ProductLabelConfig
  expect(config.fields.map((field) => field.key).slice(0, 4)).toEqual([
    'store_name',
    'store_address',
    'barcode',
    'product_name',
  ])
  expect(config.fields.find((field) => field.key === 'price')).toMatchObject({ enabled: false })
  expect(config.fields.find((field) => field.key === 'store_name')).toMatchObject({
    enabled: true,
    text: 'Cửa hàng Hiền',
  })

  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Giá bán', exact: true })).not.toBeChecked()
  await expect(page.getByLabel('Nội dung in thay cho Tên cửa hàng')).toHaveValue('Cửa hàng Hiền')

  // Make another stock's template the default from its editor.
  await page.goto('/store_1/settings/receipt-templates/postpl_L2')
  await page.getByRole('button', { name: 'Lưu & đặt mặc định', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: '“Tem 40×30mm” là mẫu mặc định.' }),
  ).toBeVisible()
  expect(state.writes.at(-1)?.path).toBe('/pos/receipt_templates/postpl_L2/default')
})

test('label editor: appearance, stock change, overflow warning, test print and history', async ({
  page,
}) => {
  const { state } = await install(page)
  await page.goto('/store_1/settings/receipt-templates/postpl_L1')
  await show(page, 'Xem trước')
  await expect(page.getByTestId('label-overflow-warning')).toHaveCount(0)

  await show(page, 'Chỉnh sửa')
  await openSection(page, 'Giao diện')
  await page.getByRole('radio', { name: '14 pt', exact: true }).check()
  await show(page, 'Xem trước')
  await expect(page.getByTestId('label-overflow-warning')).toBeVisible()
  await show(page, 'Chỉnh sửa')
  await page.getByRole('radio', { name: '9 pt', exact: true }).check()
  await show(page, 'Xem trước')
  await expect(page.getByTestId('label-overflow-warning')).toHaveCount(0)

  // Margins use the stepper, within 0 to 5 mm.
  await show(page, 'Chỉnh sửa')
  const top = page.getByLabel('Lề trên', { exact: true })
  await expect(top).toHaveValue('1')
  await page.getByRole('button', { name: 'Tăng Lề trên' }).click()
  await expect(top).toHaveValue('1.5')

  // Another stock keeps the fields and changes only the layout.
  await page.getByRole('radio', { name: /^110×22mm · 3 tem/ }).check()
  await show(page, 'Xem trước')
  await expect(labelFrame(page).locator('.label')).toHaveCount(3)

  // Sample items.
  await page.getByRole('radio', { name: 'Chỉ có SKU', exact: true }).check()
  await expect(labelFrame(page).locator('.label').first()).toContainText('Gạo thơm ST25')
  await page.getByRole('radio', { name: 'Tên dài', exact: true }).check()
  await expect(labelFrame(page).locator('.label').first()).toContainText('Nước giặt')

  // Test print goes through the browser with the stock's sheet.
  await page.getByRole('button', { name: 'In thử', exact: true }).click()
  await expect.poll(async () => (await printed(page)).length).toBe(1)
  expect((await printed(page))[0]).toContain('roll_110x22_3|')
  expect((await printed(page))[0]).toContain('Nước giặt')
  expect(state.writes.filter((write) => write.method !== 'GET')).toEqual([])

  await page.getByRole('button', { name: 'Lưu', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu phiên bản 2.' })).toBeVisible()
  expect(state.writes.at(-1)?.body).toMatchObject({ paper: 'roll_110x22_3' })

  // History shows both versions and restores the first.
  await page.getByRole('button', { name: 'Lịch sử', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Lịch sử phiên bản · Tem 50×30mm' })
  const list = drawer.getByRole('list', { name: 'Các phiên bản' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(
    labelFrame(page, 'product-label-version-preview').locator('.label').first(),
  ).toBeVisible()
  await drawer.getByRole('button', { name: 'Khôi phục phiên bản 1' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã khôi phục phiên bản 1 thành phiên bản 3.' }),
  ).toBeVisible()
})

test('read-only administrators see label previews without write controls', async ({ page }) => {
  await install(page, { read: true, write: false })
  await openLabels(page)
  await expect(cards(page)).toHaveCount(9)
  await expect(page.getByRole('button', { name: 'Tạo mẫu tem', exact: true })).toHaveCount(0)
  await expect(card(page, 'Tem 50×30mm').getByRole('button', { name: 'Đặt mặc định' })).toHaveCount(0)
  await page.goto('/store_1/settings/receipt-templates/postpl_L1')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sửa mẫu tem')
  await expect(page.getByLabel('Tên mẫu')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0)
})
