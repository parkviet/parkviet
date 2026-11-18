import { expect, type Page, test } from '@playwright/test'
import { installDashboardShell } from './support/dashboard'
import { posContext } from './support/pos-context'

// Presentation fixtures only: the real API checks the catalog combinations and
// computes the preview. The mock below answers the preview from the draft it
// is sent, so what the page shows can be told apart from anything it computes.
type Option = { label: string; industry: string | null; name: string | null; vat: number | null; pit: number | null }
const OPTIONS: Record<string, Option> = {
  'direct.production_transport_food': { label: 'GTGT 3% – TNCN 1,5%', industry: 'production_transport_food', name: 'Dịch vụ ăn uống', vat: 0.03, pit: 0.015 },
  'direct.production_transport_food_vat_exempt': { label: 'GTGT không chịu thuế – TNCN 1,5%', industry: 'production_transport_food', name: 'Dịch vụ ăn uống', vat: null, pit: 0.015 },
  'direct.goods': { label: 'GTGT 1% – TNCN 0,5%', industry: 'goods', name: 'Phân phối, cung cấp hàng hoá', vat: 0.01, pit: 0.005 },
  'deduction.vat_8': { label: 'GTGT 8%', industry: null, name: null, vat: 0.08, pit: null },
  'deduction.vat_10': { label: 'GTGT 10%', industry: null, name: null, vat: 0.1, pit: null },
}
const optionRow = (key: string, method: 'direct' | 'deduction') => ({
  tax_category_id: null,
  option: key,
  method,
  label: OPTIONS[key].label,
  industry: OPTIONS[key].industry,
  industry_name: OPTIONS[key].name,
  vat_rate: OPTIONS[key].vat === null ? null : String(OPTIONS[key].vat),
  pit_rate: OPTIONS[key].pit === null || method === 'deduction' ? null : String(OPTIONS[key].pit),
  vat_exempt: OPTIONS[key].vat === null,
})
const directKeys = ['direct.production_transport_food', 'direct.production_transport_food_vat_exempt', 'direct.goods']
const deductionKeys = ['deduction.vat_8', 'deduction.vat_10']
const GROUPS = [
  { code: 'group_1', name: 'Doanh thu đến 1 tỷ đồng', revenue_from: '0', revenue_to: '1000000000', methods: ['direct'], pit_methods: ['revenue'], pit_income_rate: null },
  { code: 'group_2', name: 'Doanh thu trên 1 tỷ đến 3 tỷ đồng', revenue_from: '1000000000', revenue_to: '3000000000', methods: ['direct'], pit_methods: ['revenue', 'income'], pit_income_rate: '0.15' },
  { code: 'group_3', name: 'Doanh thu trên 3 tỷ đến 50 tỷ đồng', revenue_from: '3000000000', revenue_to: '50000000000', methods: ['direct', 'deduction'], pit_methods: ['income'], pit_income_rate: '0.17' },
  { code: 'group_4', name: 'Doanh thu trên 50 tỷ đồng', revenue_from: '50000000000', revenue_to: null, methods: ['deduction', 'direct'], pit_methods: ['income'], pit_income_rate: '0.2' },
]

type Regime = {
  enabled: boolean
  method: 'direct' | 'deduction'
  revenue_group: string
  pit_method: string
  prices_include_tax: boolean
  apply_reduction: boolean
  threshold_warning: boolean
  item_option: string
  service_fee_option: string
  shipping_option: string
}

function world(over: Partial<Regime> = {}, year: Record<string, unknown> = {}) {
  return {
    regime: {
      enabled: true,
      method: 'direct',
      revenue_group: 'group_1',
      pit_method: 'revenue',
      prices_include_tax: true,
      apply_reduction: false,
      threshold_warning: true,
      item_option: 'direct.production_transport_food',
      service_fee_option: 'direct.production_transport_food',
      shipping_option: 'direct.production_transport_food',
      ...over,
    } as Regime,
    savedAt: '2026-11-10T03:00:00Z',
    year: {
      year: 2026,
      revenue: '250000000',
      threshold: '1000000000',
      ratio: '0.25',
      warning: null,
      crossed_on: null,
      crossed_period: null,
      einvoice_deadline: null,
      tax_due: false,
      vat_amount: '7500000',
      pit_amount: '0',
      payable_amount: '0',
      ...year,
    } as Record<string, unknown>,
    missing: ['signer_name', 'head_office_location'],
    writes: [] as Record<string, unknown>[],
    previews: [] as Record<string, unknown>[],
    refuse: null as null | { status: number; body: unknown },
  }
}
type World = ReturnType<typeof world>

const ref = (key: string) => ({ tax_category_id: `tc_${key}`, option: key })
function regimeRow(state: World) {
  const r = state.regime
  const group = GROUPS.find((item) => item.code === r.revenue_group)
  return {
    id: 'postaxregime_1',
    enabled: r.enabled,
    method: r.method,
    revenue_group: r.revenue_group,
    pit_method: r.pit_method,
    pit_income_rate: r.pit_method === 'income' ? group?.pit_income_rate : null,
    prices_include_tax: r.prices_include_tax,
    apply_reduction: r.apply_reduction,
    threshold_warning: r.threshold_warning,
    default_item: ref(r.item_option),
    default_service_fee: ref(r.service_fee_option),
    default_shipping: ref(r.shipping_option),
    changed_by_id: 'staff_admin',
    changed_by_name: 'Quản trị Hiền',
    created_at: state.savedAt,
  }
}
function regimeState(state: World) {
  return {
    regime: regimeRow(state),
    options: [],
    available_options: {
      direct: directKeys.map((key) => optionRow(key, 'direct')),
      deduction: deductionKeys.map((key) => optionRow(key, 'deduction')),
    },
    suggested_defaults: {
      direct: { item: directKeys[0], service_fee: directKeys[0], shipping: directKeys[0] },
      deduction: { item: 'deduction.vat_8', service_fee: 'deduction.vat_8', shipping: 'deduction.vat_8' },
    },
    revenue_groups: GROUPS,
    product_count: 12,
    product_counts: [],
    open_orders: 3,
    revenue_year: state.year,
    readiness: { filled: 7, total: 9, missing: state.missing },
    history: [regimeRow(state)],
  }
}

const money = (value: number) => `${value}.0`
function previewOf(draft: Regime, year: Record<string, unknown>) {
  const lines = [
    { kind: 'item', key: draft.item_option, amount: 100000 },
    { kind: 'shipping', key: draft.shipping_option, amount: 20000 },
  ].map(({ kind, key, amount }) => {
    const option = OPTIONS[key]
    const base = { kind, option: key, label: option.label, amount: money(amount) }
    if (!draft.enabled || option.vat === null && draft.method === 'deduction')
      return { ...base, customer_amount: money(amount), vat_rate: null, vat_amount: null, pit_rate: null, pit_amount: null, printed: false }
    if (draft.method === 'direct')
      return {
        ...base,
        customer_amount: money(amount),
        vat_rate: option.vat === null ? null : String(option.vat),
        vat_amount: money(Math.round(amount * (option.vat ?? 0))),
        pit_rate: String(option.pit),
        pit_amount: draft.pit_method === 'income' ? money(0) : money(Math.round(amount * (option.pit ?? 0))),
        printed: false,
      }
    const rate = option.vat ?? 0
    const tax = draft.prices_include_tax ? Math.round((amount / (1 + rate)) * rate) : Math.round(amount * rate)
    return {
      ...base,
      customer_amount: money(draft.prices_include_tax ? amount : amount + tax),
      vat_rate: String(rate),
      vat_amount: money(tax),
      pit_rate: null,
      pit_amount: null,
      printed: true,
    }
  })
  const sum = (field: 'customer_amount' | 'vat_amount' | 'pit_amount') =>
    money(lines.reduce((total, line) => total + Number((line as Record<string, string | null>)[field] ?? 0), 0))
  return {
    enabled: draft.enabled,
    method: draft.method,
    prices_include_tax: draft.prices_include_tax,
    lines,
    customer_total: sum('customer_amount'),
    vat_total: sum('vat_amount'),
    pit_total: sum('pit_amount'),
    revenue_year: { ...year, threshold: '1000000000' },
  }
}

async function install(page: Page, state: World, access = { read: true, write: true }) {
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v3/admin', '')
    const ok = (data: unknown) => route.fulfill({ json: { data, meta: { page: 1, limit: 25, count: 1, pages: 1 } } })
    if (path === '/pos/context') {
      const context = posContext(url, { capabilities: [], admin: true })
      return route.fulfill({ json: { ...context, administration: access } })
    }
    if (path === '/pos/tax_regime/preview') {
      const body = request.postDataJSON() as Regime
      state.previews.push(body)
      return ok(previewOf(body, state.year))
    }
    if (path === '/pos/tax_regime') {
      if (request.method() === 'PUT') {
        const { apply_to_all_products: _all, ...body } = request.postDataJSON() as Regime & { apply_to_all_products: boolean }
        state.writes.push(request.postDataJSON() as Record<string, unknown>)
        if (state.refuse) return route.fulfill({ status: state.refuse.status, json: state.refuse.body })
        state.regime = body
        state.savedAt = '2026-11-18T05:00:00Z'
      }
      return ok(regimeState(state))
    }
    return ok([])
  })
  await installDashboardShell(page, { authenticated: true, ...access })
}

const save = (page: Page) => page.getByRole('button', { name: 'Lưu thay đổi', exact: true })
async function choose(page: Page, label: string, option: string | RegExp) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByRole('option', { name: option }).click()
}
const preview = (page: Page) => page.getByTestId('tax-preview')

test('shows the fields of each revenue group for the direct method', async ({ page }) => {
  const state = world()
  await install(page, state)
  await page.goto('/store_1/settings/tax')
  const sidebar = page.locator('[data-sidebar="sidebar"]').first()
  const taxInfo = sidebar.getByRole('link', { name: 'Thông tin kê khai thuế', exact: true })
  const tax = sidebar.getByRole('link', { name: 'Cấu hình thuế', exact: true })
  await expect(tax).toHaveAttribute('href', '/store_1/settings/tax')
  expect((await taxInfo.boundingBox())!.y).toBeLessThan((await tax.boundingBox())!.y)

  // Group 1: no income tax choice, no rate; deduction cannot be picked.
  await expect(page.getByLabel('Mục thuế mặc định cho hàng')).toContainText('GTGT 3% – TNCN 1,5%')
  await expect(page.getByText('Dịch vụ ăn uống', { exact: true }).first()).toBeVisible()
  await expect(page.getByLabel('Mục thuế cho phí phục vụ và phụ thu')).toBeVisible()
  await expect(page.getByLabel('Mục thuế cho phí vận chuyển')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Cảnh báo khi doanh thu chạm ngưỡng' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Áp dụng giảm thuế theo nghị quyết' })).not.toBeChecked()
  await expect(page.getByLabel('Cách tính thuế thu nhập cá nhân')).toHaveCount(0)
  await expect(page.getByTestId('tax-pit-income-rate')).toHaveCount(0)
  await expect(page.getByRole('radio', { name: /Khấu trừ/ })).toBeDisabled()
  await expect(page.getByTestId('tax-revenue-status')).toHaveText('Chưa phải nộp')
  await expect(page.getByTestId('tax-revenue-year')).toContainText('Doanh thu năm nay 250.000.000 ₫ / ngưỡng 1.000.000.000 ₫')

  // Group 2: income tax on revenue or on income; income shows the fixed 15%.
  await choose(page, 'Nhóm doanh thu của cửa hàng', /Nhóm 2/)
  await expect(page.getByLabel('Cách tính thuế thu nhập cá nhân')).toContainText('Theo doanh thu')
  await expect(page.getByTestId('tax-pit-income-rate')).toHaveCount(0)
  await choose(page, 'Cách tính thuế thu nhập cá nhân', 'Theo thu nhập')
  await expect(page.getByTestId('tax-pit-income-rate')).toHaveText('Thuế suất thu nhập cá nhân 15%')
  await expect(page.getByRole('radio', { name: /Khấu trừ/ })).toBeDisabled()

  // Groups 3 and 4: fixed rates, both methods open.
  await choose(page, 'Nhóm doanh thu của cửa hàng', /Nhóm 3/)
  await expect(page.getByLabel('Cách tính thuế thu nhập cá nhân')).toHaveCount(0)
  await expect(page.getByTestId('tax-pit-income-rate')).toHaveText('Thuế suất thu nhập cá nhân 17%')
  await expect(page.getByRole('radio', { name: /Khấu trừ/ })).toBeEnabled()
  await choose(page, 'Nhóm doanh thu của cửa hàng', /Nhóm 4/)
  await expect(page.getByTestId('tax-pit-income-rate')).toHaveText('Thuế suất thu nhập cá nhân 20%')
  await expect(page.getByRole('radio', { name: /Khấu trừ/ })).toBeEnabled()
})

test('saves group 2 with income tax on income without asking for a confirmation', async ({ page }) => {
  const state = world()
  await install(page, state)
  await page.goto('/store_1/settings/tax')
  await expect(save(page)).toBeDisabled()
  await choose(page, 'Nhóm doanh thu của cửa hàng', /Nhóm 2/)
  await choose(page, 'Cách tính thuế thu nhập cá nhân', 'Theo thu nhập')
  await save(page).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu cấu hình thuế' })).toBeVisible()
  expect(state.writes).toEqual([
    {
      enabled: true,
      method: 'direct',
      revenue_group: 'group_2',
      pit_method: 'income',
      item_option: 'direct.production_transport_food',
      service_fee_option: 'direct.production_transport_food',
      shipping_option: 'direct.production_transport_food',
      prices_include_tax: true,
      apply_reduction: false,
      threshold_warning: true,
      apply_to_all_products: false,
    },
  ])
  await expect(page.getByLabel('Nhóm doanh thu của cửa hàng')).toContainText('Nhóm 2')
  await expect(page.getByTestId('tax-applied-since')).toContainText('18/11/26')
  await expect(save(page)).toBeDisabled()
})

test('the preview follows the draft and shows what the server answered', async ({ page }) => {
  const state = world()
  await install(page, state)
  await page.goto('/store_1/settings/tax')
  // Direct: the customer pays the listed prices; tax owed is shown apart.
  await expect(page.getByTestId('tax-preview-customer-total')).toHaveText('120.000 ₫')
  await expect(preview(page)).not.toContainText('GTGT 3% – TNCN 1,5% (Món mẫu)')
  await expect(preview(page)).toContainText('Thuế phải nộp nếu năm vượt 1.000.000.000 ₫')
  await expect(page.getByTestId('tax-preview-owed-vat-item')).toHaveText('3.000 ₫')
  await expect(page.getByTestId('tax-preview-owed-pit-item')).toHaveText('1.500 ₫')
  await expect(page.getByTestId('tax-preview-owed-vat-total')).toHaveText('3.600 ₫')
  await expect(page.getByTestId('tax-preview-owed-pit-total')).toHaveText('1.800 ₫')

  await choose(page, 'Mục thuế mặc định cho hàng', 'GTGT 1% – TNCN 0,5%')
  await expect(page.getByTestId('tax-preview-owed-vat-item')).toHaveText('1.000 ₫')
  await expect(page.getByTestId('tax-preview-owed-pit-item')).toHaveText('500 ₫')
  expect(state.previews.at(-1)).toMatchObject({ item_option: 'direct.goods', method: 'direct' })

  await choose(page, 'Mục thuế cho phí vận chuyển', 'GTGT không chịu thuế – TNCN 1,5%')
  await expect(page.getByTestId('tax-preview-owed-vat-shipping')).toHaveText('0 ₫')
  await expect(page.getByTestId('tax-preview-customer-total')).toHaveText('120.000 ₫')
})

test('switching to deduction asks first, counting products and open orders', async ({ page }) => {
  const state = world({ revenue_group: 'group_3', pit_method: 'income' })
  await install(page, state)
  await page.goto('/store_1/settings/tax')
  await page.locator('label').filter({ hasText: 'Khấu trừ' }).click()
  await expect(page.getByLabel('Thuế GTGT mặc định')).toContainText('GTGT 8%')
  // Deduction: the price and the VAT line as printed.
  await expect(page.getByTestId('tax-preview-customer-total')).toHaveText('120.000 ₫')
  await expect(page.getByTestId('tax-preview-vat-item')).toHaveText('7.407 ₫')
  await expect(page.getByTestId('tax-preview-vat-shipping')).toHaveText('1.481 ₫')
  await expect(preview(page)).not.toContainText('Thuế phải nộp nếu năm vượt')

  await save(page).click()
  const dialog = page.getByRole('dialog', { name: 'Đổi phương pháp tính thuế?' })
  await expect(dialog.getByTestId('tax-confirm-products')).toHaveText('12 sản phẩm sẽ được gán lại mục thuế mặc định mới.')
  await expect(dialog.getByTestId('tax-confirm-orders')).toHaveText('Hiện có 3 đơn đang mở.')
  await expect(dialog.getByRole('checkbox', { name: 'Áp dụng cho tất cả sản phẩm' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click()
  expect(state.writes).toHaveLength(0)

  await save(page).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu cấu hình thuế' })).toBeVisible()
  expect(state.writes).toHaveLength(1)
  expect(state.writes[0]).toMatchObject({
    method: 'deduction',
    revenue_group: 'group_3',
    item_option: 'deduction.vat_8',
    prices_include_tax: true,
    apply_to_all_products: false,
  })
})

test('warns when prices stop including VAT and previews the higher total', async ({ page }) => {
  const state = world({
    method: 'deduction',
    revenue_group: 'group_3',
    pit_method: 'income',
    item_option: 'deduction.vat_10',
    service_fee_option: 'deduction.vat_10',
    shipping_option: 'deduction.vat_10',
  })
  await install(page, state)
  await page.goto('/store_1/settings/tax')
  await expect(page.getByTestId('tax-price-warning')).toHaveCount(0)
  await choose(page, 'Giá sản phẩm', 'Chưa gồm GTGT')
  await expect(page.getByTestId('tax-price-warning')).toContainText('số tiền khách trả sẽ tăng')
  await expect(page.getByTestId('tax-preview-customer-total')).toHaveText('132.000 ₫')
  // Only the saved method is unchanged, so no confirmation is needed.
  await save(page).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu cấu hình thuế' })).toBeVisible()
  expect(state.writes[0]).toMatchObject({ prices_include_tax: false, apply_to_all_products: false })
})

test('changing a default offers to apply it to all products', async ({ page }) => {
  const state = world()
  await install(page, state)
  await page.goto('/store_1/settings/tax')
  await choose(page, 'Mục thuế mặc định cho hàng', 'GTGT 1% – TNCN 0,5%')
  await save(page).click()
  const dialog = page.getByRole('dialog', { name: 'Đổi mục thuế mặc định?' })
  const all = dialog.getByRole('checkbox', { name: 'Áp dụng cho tất cả sản phẩm' })
  await expect(all).not.toBeChecked()
  await all.check()
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu cấu hình thuế' })).toBeVisible()
  expect(state.writes[0]).toMatchObject({ item_option: 'direct.goods', apply_to_all_products: true })

  // Declined the checkbox the products on the old default are the only ones moved.
  await choose(page, 'Mục thuế mặc định cho hàng', 'GTGT 3% – TNCN 1,5%')
  await save(page).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(page.getByTestId('tax-applied-since')).toBeVisible()
  await expect.poll(() => state.writes.length).toBe(2)
  expect(state.writes[1]).toMatchObject({ item_option: 'direct.production_transport_food', apply_to_all_products: false })
})

test('turning tax off hides the settings and saves the store as untaxed', async ({ page }) => {
  const state = world()
  await install(page, state)
  await page.goto('/store_1/settings/tax')
  await page.getByRole('switch', { name: 'Thiết lập thuế', exact: true }).click()
  await expect(page.getByLabel('Nhóm doanh thu của cửa hàng')).toHaveCount(0)
  await expect(page.getByLabel('Mục thuế mặc định cho hàng')).toHaveCount(0)
  await expect(page.getByRole('radiogroup')).toHaveCount(0)
  await expect(preview(page)).toContainText('Không tính thuế.')
  await expect(page.getByTestId('tax-preview-customer-total')).toHaveText('120.000 ₫')
  await save(page).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu cấu hình thuế' })).toBeVisible()
  expect(state.writes[0]).toMatchObject({ enabled: false, apply_to_all_products: false })
  await page.getByRole('switch', { name: 'Thiết lập thuế', exact: true }).click()
  await expect(page.getByLabel('Mục thuế mặc định cho hàng')).toBeVisible()
})

test('shows the crossed threshold, the missing declaration fields and the history', async ({ page }) => {
  const state = world(
    {},
    {
      revenue: '1250000000',
      ratio: '1.25',
      warning: 'crossed',
      crossed_on: '2026-07-15',
      crossed_period: '2026-Q3',
      einvoice_deadline: '2026-10-30',
      tax_due: true,
      vat_amount: '37500000',
      pit_amount: '3750000',
      payable_amount: '41250000',
    },
  )
  await install(page, state)
  await page.goto('/store_1/settings/tax')
  await expect(page.getByTestId('tax-revenue-status')).toContainText('Đã vượt ngưỡng ngày 15/07/2026')
  await expect(page.getByTestId('tax-revenue-year')).toContainText('Thuế ước tính phải nộp của năm: 41.250.000 ₫')
  await expect(page.getByTestId('tax-revenue-year')).toContainText('Đăng ký hoá đơn điện tử trước ngày 30/10/2026')
  await expect(page.getByTestId('tax-config-missing')).toHaveText('Còn thiếu: người ký tờ khai, mã địa điểm của trụ sở chính')
  await expect(page.getByRole('link', { name: 'Mở thông tin kê khai thuế' })).toHaveAttribute('href', '/store_1/settings/tax-info')
  await expect(page.getByTestId('tax-applied-since')).toContainText('10/11/26')
  const usage = page.getByRole('region', { name: 'Cấu hình này dùng ở đâu' })
  await expect(usage.getByText('Sắp có')).toHaveCount(2)
  await page.getByRole('button', { name: 'Lịch sử thay đổi', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Lịch sử thay đổi' })).toContainText('Quản trị Hiền')
})

test('field errors from the server land on the field', async ({ page }) => {
  const state = world()
  await install(page, state)
  await page.goto('/store_1/settings/tax')
  await choose(page, 'Mục thuế mặc định cho hàng', 'GTGT 1% – TNCN 0,5%')
  state.refuse = {
    status: 422,
    body: { error: { code: 'validation_error', message: 'Item option is not included in the list', details: { item_option: ['is not included in the list'] } } },
  }
  await save(page).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(page.getByText('is not included in the list', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click()
  await expect(page.getByLabel('Mục thuế mặc định cho hàng')).toContainText('GTGT 3% – TNCN 1,5%')
  await expect(save(page)).toBeDisabled()
})

test('a store reader cannot open the page', async ({ page }) => {
  const state = world()
  await install(page, state, { read: true, write: false })
  await page.goto('/store_1/settings/tax')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(save(page)).toHaveCount(0)
})
