import { expect, type Page, test } from '@playwright/test'
import { installDashboardShell } from './support/dashboard'
import { posContext } from './support/pos-context'

async function installStockAndPartnerMocks(page: Page) {
  const suppliers = [
    {
      id: 'possupp_1',
      code: 'NCC00001',
      name: 'Công ty Cà Phê Đà Lạt',
      phone: '0901234567',
      email: null,
      address: 'Đà Lạt',
      partner_group_id: null,
      partner_group_name: null,
      tax_code: '0101234567',
      invoice_company: null,
      invoice_address: null,
      bank_name: null,
      bank_account: null,
      tags: ['Ưu tiên'],
      status: 'active',
      opening_payable: '500000.0',
      also_customer: false,
      note: null,
      import_count: 1,
      imported_total: '1200000.0',
      paid_total: '500000.0',
      payable_balance: '1200000.0',
      created_at: '2026-11-20T08:00:00Z',
    },
  ]

  const customers = [
    {
      id: 'poscustomer_1',
      code: 'KH00001',
      name: 'Nguyễn Văn A',
      phone: '0987654321',
      email: null,
      address: 'Hà Nội',
      partner_group_id: null,
      partner_group_name: null,
      tags: ['VIP'],
      status: 'active',
      tax_code: null,
      invoice_company: null,
      invoice_address: null,
      gender: null,
      birthday: null,
      also_supplier: false,
      note: null,
      receivable_balance: '300000.0',
      created_at: '2026-11-20T08:00:00Z',
    },
  ]

  const docs = [
    {
      id: 'posstdoc_1',
      code: 'PN00001',
      kind: 'import',
      status: 'completed',
      branch_id: 'branch_main',
      supplier_id: 'possupp_1',
      supplier_name: 'Công ty Cà Phê Đà Lạt',
      customer_id: null,
      counterparty_name: 'Công ty Cà Phê Đà Lạt',
      invoice_type: 'vat_invoice',
      invoice_number: '000123',
      export_reason: null,
      occurred_at: '2026-11-24T09:00:00Z',
      subtotal: '1200000.0',
      discount_amount: '0.0',
      extra_cost: '0.0',
      tax_rate: '0.0',
      tax_amount: '0.0',
      total_amount: '1200000.0',
      paid_amount: '500000.0',
      payment_status: 'partial',
      note: null,
      actor_name: 'admin@example.com',
      completed_at: '2026-11-24T09:05:00Z',
      canceled_at: null,
      cancel_reason: null,
      items_count: 1,
      total_quantity: 10,
      variance_quantity: null,
      created_at: '2026-11-24T09:00:00Z',
      lines: [
        {
          id: 'posstline_1',
          variant_id: 'var_1',
          sku: 'CF-ARA',
          name: 'Cà phê Arabica',
          options_text: null,
          base_unit: 'kg',
          item_kind: 'product',
          quantity: 10,
          system_quantity: null,
          actual_quantity: null,
          unit_cost: '120000.0',
          line_total: '1200000.0',
          note: null,
        },
      ],
    },
  ]

  await page.route('**/api/v3/admin/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace('/api/v3/admin', '')
    if (path === '/pos/context') {
      return route.fulfill({
        json: posContext(url, {
          capabilities: ['pos.inventory.manage', 'pos.inventory.trace', 'pos.report.read'],
        }),
      })
    }
    if (path === '/pos/stock/overview') {
      return route.fulfill({
        json: {
          data: [
            {
              variant_id: 'var_1',
              product_id: 'prod_1',
              sku: 'CF-ARA',
              name: 'Cà phê Arabica',
              options_text: null,
              item_kind: 'product',
              base_unit: 'kg',
              track_inventory: true,
              cost_price: '120000.0',
              on_hand: 15,
              stock_value: '1800000.0',
              min_quantity: 5,
              stock_status: 'in_stock',
            },
          ],
          meta: {
            summary: {
              total_items: 1,
              total_quantity: 15,
              total_value: '1800000.0',
              tracked_count: 1,
              untracked_count: 0,
              low_count: 0,
              out_of_stock_count: 0,
            },
            total: 1,
          },
        },
      })
    }
    if (path === '/pos/stock/ledger') {
      return route.fulfill({
        json: {
          data: [
            {
              id: '1',
              occurred_at: '2026-11-24T09:05:00Z',
              variant_id: 'var_1',
              sku: 'CF-ARA',
              name: 'Cà phê Arabica',
              item_kind: 'product',
              base_unit: 'kg',
              movement_kind: 'pos_import',
              quantity: 10,
              unit_cost: '120000.0',
              value: '1200000.0',
              reference_code: 'PN00001',
              reason: 'PN00001',
            },
          ],
          meta: {
            summary: {
              opening_qty: 5,
              inflow_qty: 10,
              outflow_qty: 0,
              closing_qty: 15,
              opening_value: '600000.0',
              inflow_value: '1200000.0',
              outflow_value: '0.0',
              closing_value: '1800000.0',
            },
            total: 1,
          },
        },
      })
    }
    if (path === '/pos/stock/documents') {
      const kind = url.searchParams.get('kind')
      const filtered = docs.filter((d) => !kind || d.kind === kind)
      return route.fulfill({
        json: { data: filtered, meta: { total: filtered.length, total_amount: '1200000.0' } },
      })
    }
    if (path === '/pos/partner_groups') {
      return route.fulfill({ json: { data: [] } })
    }
    if (path === '/pos/suppliers') {
      return route.fulfill({
        json: {
          data: suppliers,
          meta: {
            summary: {
              total_suppliers: suppliers.length,
              total_imports: 1,
              total_imported_value: '1200000.0',
              total_payable: '1200000.0',
            },
            total: suppliers.length,
          },
        },
      })
    }
    if (path === '/pos/partner_customers') {
      return route.fulfill({
        json: {
          data: customers,
          meta: {
            summary: {
              total_customers: customers.length,
              active_count: 1,
              total_receivable: '300000.0',
              debtors_count: 1,
            },
            total: customers.length,
          },
        },
      })
    }
    return route.fallback()
  })
  await installDashboardShell(page, {
    authenticated: true,
    read: true,
    write: true,
  })
}

test('shows Stock submenus in sidebar and renders Stock Overview, Ledger, Imports, and Opening pages', async ({
  page,
}) => {
  await installStockAndPartnerMocks(page)
  await page.goto('/store_1/stock/overview')

  await expect(page.getByRole('heading', { name: 'Tồn kho' })).toBeVisible()
  await expect(page.getByText('Cà phê Arabica')).toBeVisible()

  // Navigate to Sổ kho via sidebar
  await page.getByRole('link', { name: 'Sổ kho' }).click()
  await expect(page.getByRole('heading', { name: 'Sổ kho' })).toBeVisible()
  await expect(page.getByText('PN00001').first()).toBeVisible()

  // Navigate to Nhập hàng via sidebar
  await page.getByRole('link', { name: 'Nhập hàng' }).first().click()
  await expect(page.getByRole('heading', { name: 'Nhập hàng' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Công ty Cà Phê Đà Lạt' })).toBeVisible()

  // Navigate to Tồn kho đầu kỳ via sidebar
  await page.getByRole('link', { name: 'Tồn kho đầu kỳ' }).click()
  await expect(page.getByRole('heading', { name: 'Tồn kho đầu kỳ' })).toBeVisible()
})

test('renders Partners > Customers and Suppliers pages with KPIs and sidebar links', async ({
  page,
}) => {
  await installStockAndPartnerMocks(page)
  await page.goto('/store_1/partners/customers')

  await expect(page.getByRole('heading', { name: 'Khách hàng' })).toBeVisible()
  await expect(page.getByText('Nguyễn Văn A')).toBeVisible()

  await page.getByRole('link', { name: 'Nhà cung cấp' }).click()
  await expect(page.getByRole('heading', { name: 'Nhà cung cấp' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Công ty Cà Phê Đà Lạt' })).toBeVisible()
})
