import { expect, type Page, test } from '@playwright/test'
import { installDashboardShell } from './support/dashboard'
import { posContext } from './support/pos-context'

async function installMocks(page: Page) {
  const taxpayer = {
    store_name: 'Cà phê ParkViet',
    tax_code: '0109876543',
    legacy_tax_code: null,
    declaration_period: 'quarter',
    tax_authority_code: '10101',
    industry_code: 'I56302',
    signer_name: 'Nguyễn Văn Chủ',
    preparer_name: 'Trần Thị Kế Toán',
    storekeeper_name: 'Lê Thủ Kho',
    cashier_name: 'Phạm Thủ Quỹ',
    readiness: { filled: 8, total: 9, missing: ['head_office_location'] },
    regime: {
      enabled: true,
      method: 'direct',
      revenue_group: 'group_2',
      pit_method: 'revenue',
      pit_income_rate: '0.15',
    },
  }

  const declarations: Record<string, unknown>[] = []

  await installDashboardShell(page, { authenticated: true, read: true, write: true })

  await page.route('**/api/v3/admin/pos/context*', (route) =>
    route.fulfill({
      json: posContext(new URL(route.request().url()), {
        admin: true,
        capabilities: ['pos.topology.manage'],
      }),
    }),
  )

  await page.route('**/api/v3/admin/pos/accounting_books', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        books: [
          { code: 's1a', number: 'S1a-HKD', group: 'revenue' },
          { code: 's2a', number: 'S2a-HKD', group: 'revenue' },
          { code: 's2b', number: 'S2b-HKD', group: 'revenue' },
          { code: 's2c', number: 'S2c-HKD', group: 'revenue_expense' },
          { code: 's2d', number: 'S2d-HKD', group: 'inventory' },
          { code: 's2e', number: 'S2e-HKD', group: 'cash' },
        ],
        taxpayer,
        currency: 'VND',
      }),
    }),
  )

  await page.route('**/api/v3/admin/pos/accounting_books/s2c*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        book: { code: 's2c', number: 'S2c-HKD', group: 'revenue_expense' },
        from_date: '2026-10-01',
        to_date: '2026-12-31',
        currency: 'VND',
        options: { revenue_source: 'all_orders' },
        taxpayer,
        summary: {
          total_revenue: '50000000',
          order_revenue: '50000000',
          other_sales_revenue: '0',
          total_deductible_expense: '20000000',
          total_excluded_expense: '2500000',
          net_income: '30000000',
          pit_income_rate: '0.15',
          pit_payable: '4500000',
        },
        expense_sections: [
          { key: 'a', amount: '12000000', count: 3, items: [] },
          { key: 'b', amount: '5000000', count: 1, items: [] },
          { key: 'c', amount: '0', count: 0, items: [] },
          { key: 'd', amount: '3000000', count: 2, items: [] },
          { key: 'dd', amount: '0', count: 0, items: [] },
          { key: 'e', amount: '0', count: 0, items: [] },
        ],
        revenue_rows: [{ stt: 1, order_id: 'ord_1', document_number: 'R1001', document_date: '2026-11-10', description: 'Bán hàng', rate_key: 'direct.fnb', revenue: '50000000', vat_amount: '1500000', pit_amount: '750000', has_einvoice: true }],
      }),
    }),
  )

  await page.route('**/api/v3/admin/pos/tax_declarations*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'GET') {
      const group = url.searchParams.get('group')
      const filtered = declarations.filter((d) => {
        if (group === 'cnkd') return d.declaration_type === '01_cnkd'
        if (group === 'vat') return d.declaration_type === '01_gtgt' || d.declaration_type === '04_gtgt'
        if (group === 'pit') return d.declaration_type === '05_kk_tncn'
        return true
      })
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ declarations: filtered, taxpayer, currency: 'VND' }),
      })
    }
    if (req.method() === 'POST' && !url.pathname.endsWith('/recalculate')) {
      const body = req.postDataJSON() as Record<string, unknown>
      const created = {
        id: `postaxdecl_${declarations.length + 1}`,
        code: `TK-CNKD-${body.period_year}Q${body.period_number}`,
        declaration_type: body.declaration_type,
        period_type: body.period_type,
        period_year: body.period_year,
        period_number: body.period_number,
        period_label: `Quý ${body.period_number}/${body.period_year}`,
        from_date: '2026-10-01',
        to_date: '2026-12-31',
        status: 'draft',
        options: body.options ?? {},
        summary: {
          revenue_total: '50000000',
          vat_total: '1500000',
          pit_total: '750000',
          total_tax_due: '2250000',
          order_count: 12,
          by_rate: [
            { rate_key: 'direct.fnb', order_count: 12, revenue: '50000000', vat_amount: '1500000', pit_amount: '750000' },
          ],
        },
        taxpayer_snapshot: taxpayer,
        note: body.note ?? null,
        submitted_at: null,
        accepted_at: null,
        created_by_name: 'Admin',
        updated_by_name: 'Admin',
        created_at: '2026-11-25T08:00:00Z',
        updated_at: '2026-11-25T08:00:00Z',
      }
      declarations.unshift(created)
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ declaration: created }),
      })
    }
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>
      const id = url.pathname.split('/').pop()
      const found = declarations.find((d) => d.id === id)
      if (found && body.status) found.status = body.status
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ declaration: found }),
      })
    }
    return route.fulfill({ status: 204 })
  })
}

test('Accounting & Tax sidebar, TT152 books (S2c-HKD), and 01/CNKD declaration workflow', async ({ page }) => {
  await installMocks(page)
  await page.goto('/store_1/accounting/books')

  // Verify sidebar exposes all 4 Accounting & Tax submenus directly
  const sidebar = page.locator('[data-sidebar="sidebar"]')
  await expect(sidebar.getByRole('link', { name: 'Sổ kế toán TT152', exact: true })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Tờ khai thuế 01/CNKD', exact: true })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Tờ khai thuế GTGT', exact: true })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Tờ khai 05/KK-TNCN', exact: true })).toBeVisible()

  // Overview shows all 6 TT152 books and tax profile readiness notice
  await expect(page.getByText('Sổ kế toán TT152/2025/TT-BTC')).toBeVisible()
  await expect(page.getByText('8/9 trường bắt buộc')).toBeVisible()
  await expect(page.getByText('Sổ S1a-HKD')).toBeVisible()
  await expect(page.getByText('Sổ S2c-HKD')).toBeVisible()
  await expect(page.getByText('Sổ S2e-HKD')).toBeVisible()

  // Open S2c-HKD detail book
  await page.goto('/store_1/accounting/books/s2c')
  await expect(page.getByText('Doanh thu bán hàng hóa, dịch vụ')).toBeVisible()
  await expect(page.getByText('Chi phí nguyên liệu, vật liệu, hàng hóa')).toBeVisible()
  await expect(page.getByText('Trần Thị Kế Toán')).toBeVisible()
  await expect(page.getByText('Nguyễn Văn Chủ')).toBeVisible()

  // Navigate to 01/CNKD declarations and create + submit a declaration
  await sidebar.getByRole('link', { name: 'Tờ khai thuế 01/CNKD', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tờ khai thuế 01/CNKD' })).toBeVisible()

  await page.getByRole('button', { name: 'Tạo tờ khai' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Lập tờ khai thuế theo kỳ')).toBeVisible()
  await dialog.getByRole('button', { name: 'Tạo tờ khai' }).click()

  // Detail modal opens with computed breakdown and status actions
  await expect(page.getByRole('dialog').getByText('direct.fnb')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Đánh dấu đã gửi CQT' }).click()
  await expect(page.getByRole('dialog').getByText('Đã gửi CQT')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).click()

  await expect(page.getByRole('cell', { name: /TK-CNKD-/ })).toBeVisible()
})
