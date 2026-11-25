import { expect, type Page, test } from '@playwright/test'
import { installDashboardShell } from './support/dashboard'
import { posContext } from './support/pos-context'

async function installReportAnalyticsMocks(page: Page) {
  await page.route('**/api/v3/admin/pos/reports/overview*', (route) =>
    route.fulfill({
      json: {
        data: {
          period: { from: '2026-11-19', to: '2026-11-25', prev_from: '2026-11-12', prev_to: '2026-11-18' },
          currency: 'VND',
          kpis: {
            gross_sales: { value: '12500000.0', previous: '10000000.0', change_pct: 25.0 },
            net_sales: { value: '12000000.0', previous: '9500000.0', change_pct: 26.3 },
            avg_order_value: { value: '250000.0', previous: '200000.0', change_pct: 25.0 },
            customers_count: { value: 42, previous: 35, change_pct: 20.0 },
            orders_count: { value: 50, previous: 40, change_pct: 25.0 },
            gross_profit: { value: '4800000.0', previous: '3800000.0', change_pct: 26.3 },
            cost_of_goods: '7200000.0',
            returns_total: '500000.0',
            discount_total: '300000.0',
            tax_total: '0.0',
            item_total: '12800000.0',
          },
          trend: [
            { date: '2026-11-24', orders: 20, customers: 18, sales_total: '5000000.0', returns_total: '0.0', net_sales: '5000000.0' },
            { date: '2026-11-25', orders: 30, customers: 24, sales_total: '7500000.0', returns_total: '500000.0', net_sales: '7000000.0' },
          ],
          by_source: [
            { order_source: 'counter', orders: 40, sales_total: '10000000.0', owed: '0.0' },
            { order_source: 'delivery', orders: 10, sales_total: '2500000.0', owed: '0.0' },
          ],
          top_products: {
            by_quantity: [{ variant_id: 'var_1', name: 'Cà phê sữa đá', sku: 'CF-01', base_unit: 'ly', quantity: 120, revenue: '3600000.0' }],
            by_revenue: [{ variant_id: 'var_1', name: 'Cà phê sữa đá', sku: 'CF-01', base_unit: 'ly', quantity: 120, revenue: '3600000.0' }],
          },
          top_customers: [{ name: 'Nguyễn Văn A', phone: '0901234567', orders: 8, revenue: '2100000.0' }],
          top_staff: [{ name: 'Thu ngân 1', orders: 50, revenue: '12500000.0' }],
        },
      },
    }),
  )

  await page.route('**/api/v3/admin/pos/reports/profit*', (route) =>
    route.fulfill({
      json: {
        data: {
          period: { from: '2026-11-19', to: '2026-11-25', prev_from: '2026-11-12', prev_to: '2026-11-18' },
          currency: 'VND',
          pnl: {
            item_total: '12800000.0',
            discount_total: '300000.0',
            returns_total: '500000.0',
            tax_total: '0.0',
            gross_sales: '12500000.0',
            net_sales: '12000000.0',
            other_income: '500000.0',
            total_revenue: '12500000.0',
            cogs: '7200000.0',
            other_expense: '1200000.0',
            total_expense: '8400000.0',
            gross_profit: '4800000.0',
            gross_margin_rate: 40.0,
            other_profit: '-700000.0',
            net_profit: '4100000.0',
            net_profit_change_pct: 15.0,
          },
          trend: [{ date: '2026-11-25', net_sales: '12000000.0', cogs: '7200000.0', gross_profit: '4800000.0' }],
          group_by: 'day',
          breakdown: [
            { label: '2026-11-25', count: 30, gross_sales: '7500000.0', net_sales: '7000000.0', cogs: '4200000.0', gross_profit: '2800000.0', margin_rate: 40.0 },
          ],
        },
      },
    }),
  )

  await page.route('**/api/v3/admin/pos/reports/inventory_summary*', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            variant_id: 'var_1',
            sku: 'CF-01',
            name: 'Cà phê hạt Arabica',
            options_text: null,
            base_unit: 'kg',
            item_kind: 'product',
            status: 'active',
            opening_qty: 10,
            opening_value: '2000000.0',
            inflow_qty: 20,
            inflow_value: '4000000.0',
            outflow_qty: 5,
            outflow_value: '1000000.0',
            closing_qty: 25,
            closing_value: '5000000.0',
          },
        ],
        meta: {
          period: { from: '2026-11-01', to: '2026-11-25' },
          currency: 'VND',
          total: 1,
          totals: {
            opening_qty: 10,
            opening_value: '2000000.0',
            inflow_qty: 20,
            inflow_value: '4000000.0',
            outflow_qty: 5,
            outflow_value: '1000000.0',
            closing_qty: 25,
            closing_value: '5000000.0',
          },
        },
      },
    }),
  )

  await page.route('**/api/v3/admin/pos/reports/inventory?*', (route) =>
    route.fulfill({
      json: {
        data: {
          period: { from: '2026-11-01', to: '2026-11-25', prev_from: '2026-10-07', prev_to: '2026-10-31' },
          currency: 'VND',
          stock: {
            total_value: '5000000.0',
            total_quantity: 25,
            active_products: 12,
            inactive_products: 1,
            low_stock_count: 2,
            out_of_stock_count: 1,
          },
          flow: {
            import_value: { value: '4000000.0', previous: '3000000.0', change_pct: 33.3 },
            import_count: 4,
            export_value: { value: '1000000.0', previous: '800000.0', change_pct: 25.0 },
            export_count: 2,
          },
          top_products: [{ variant_id: 'var_1', sku: 'CF-01', name: 'Cà phê hạt Arabica', quantity: 25, unit_cost: '200000.0', stock_value: '5000000.0' }],
          top_categories: [{ name: 'Đồ uống', quantity: 25, stock_value: '5000000.0' }],
          trend: [{ date: '2026-11-25', import_value: '4000000.0', export_value: '1000000.0' }],
        },
      },
    }),
  )

  await page.route('**/api/v3/admin/pos/reports/transaction*', (route) =>
    route.fulfill({
      json: {
        data: {
          period: { from: '2026-11-19', to: '2026-11-25', prev_from: '2026-11-12', prev_to: '2026-11-18' },
          currency: 'VND',
          summary: {
            total_income: { value: '5000000.0', previous: '4000000.0', change_pct: 25.0 },
            total_expense: { value: '1200000.0', previous: '1000000.0', change_pct: 20.0 },
            net_diff: { value: '3800000.0', previous: '3000000.0', change_pct: 26.7 },
            avg_income_per_day: '714286.0',
            avg_expense_per_day: '171429.0',
          },
          trend: [{ date: '2026-11-25', income: '5000000.0', expense: '1200000.0', net: '3800000.0' }],
          income_by_category: [{ category_code: 'sales_other', amount: '5000000.0', count: 3 }],
          expense_by_category: [{ category_code: 'electricity', amount: '1200000.0', count: 1 }],
          by_account: [
            { id: 'posfundacc_1', name: 'Tiền mặt', kind: 'cash', bank_name: null, account_number: null, period_income: '5000000.0', period_expense: '1200000.0', current_balance: '8800000.0' },
          ],
        },
      },
    }),
  )

  await page.route('**/api/v3/admin/pos/exports*', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 'posexp_1',
            report_type: 'sales',
            status: 'ready',
            row_count: 50,
            filters: { from: '2026-11-19', to: '2026-11-25' },
            expires_at: '2026-12-01T00:00:00Z',
          },
        ],
      },
    }),
  )
}

test('shows report submenus in sidebar and renders all 6 new report analytics screens', async ({ page }) => {
  await installDashboardShell(page, { authenticated: true, read: true, write: true })
  await page.route('**/api/v3/admin/pos/context*', (route) =>
    route.fulfill({
      json: posContext(new URL(route.request().url()), {
        admin: true,
        capabilities: [
          'pos.order.sell',
          'pos.report.read',
          'pos.report.export',
          'pos.inventory.manage',
          'pos.topology.manage',
        ],
      }),
    }),
  )
  await installReportAnalyticsMocks(page)

  // 1. Overview & sidebar submenus
  await page.goto('/store_1/reports/overview')
  await expect(page.getByRole('heading', { name: 'Tổng quan báo cáo' })).toBeVisible()
  await expect(page.getByText('Cà phê sữa đá').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Báo cáo lợi nhuận' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Báo cáo doanh thu', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Báo cáo kho hàng' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tổng hợp tồn kho' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Báo cáo thu chi' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lịch sử xuất báo cáo' })).toBeVisible()

  // 2. Profit
  await page.goto('/store_1/reports/profit')
  await expect(page.getByRole('heading', { name: 'Báo cáo lợi nhuận' })).toBeVisible()
  await expect(page.getByText('Chi tiết lợi nhuận (Báo cáo lãi lỗ)')).toBeVisible()

  // 3. Inventory
  await page.goto('/store_1/reports/inventory')
  await expect(page.getByRole('heading', { name: 'Báo cáo kho hàng' })).toBeVisible()
  await expect(page.getByText('Cà phê hạt Arabica').first()).toBeVisible()

  // 4. Inventory Summary (XNT)
  await page.goto('/store_1/reports/inventory-summary')
  await expect(page.getByRole('heading', { name: 'Tổng hợp tồn kho' })).toBeVisible()
  await expect(page.getByText('Số dư đầu kỳ')).toBeVisible()
  await expect(page.getByText('Cà phê hạt Arabica').first()).toBeVisible()

  // 5. Transaction
  await page.goto('/store_1/reports/transaction')
  await expect(page.getByRole('heading', { name: 'Báo cáo thu chi' })).toBeVisible()
  await expect(page.getByText('Danh sách nguồn tiền (Quỹ tiền)')).toBeVisible()
  await expect(page.getByText('Tiền mặt').first()).toBeVisible()

  // 6. Export History
  await page.goto('/store_1/reports/history')
  await expect(page.getByRole('heading', { name: 'Lịch sử xuất báo cáo' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Doanh số' })).toBeVisible()
})
