import { expect, type Page, test } from '@playwright/test'
import { installDashboardShell } from './support/dashboard'
import { posContext } from './support/pos-context'

async function installMocks(page: Page) {
  const branches = [{ id: 'branch_main', name: 'Chi nhánh Trung tâm', code: 'main', status: 'active' }]
  const staff = [
    {
      id: 'admin_1',
      email: 'cashier@parkviet.vn',
      first_name: 'Nguyễn',
      last_name: 'An',
      full_name: 'Nguyễn An',
      status: 'active',
      deactivated_at: null,
      last_active_at: null,
      created_at: '2026-11-01T08:00:00Z',
      memberships: [{ branch_id: 'branch_main', staff_role: { id: 'role_1', name: 'Thu ngân' } }],
    },
  ]

  const payrolls: Record<string, unknown>[] = [
    {
      id: 'pospay_1',
      code: 'BL0001',
      name: 'Bảng lương tháng 11/2026',
      period_label: 'Tháng 11/2026',
      period_start: '2026-11-01',
      period_end: '2026-11-30',
      payroll_date: '2026-11-25',
      status: 'draft',
      note: null,
      branch_id: null,
      branch_name: null,
      line_count: 1,
      total_gross: '10000000.0',
      total_deductions: '1000000.0',
      total_net: '9000000.0',
      total_pit: '200000.0',
      total_bhxh: '800000.0',
      total_bhyt: '0.0',
      total_bhtn: '0.0',
      total_employer_cost: '0.0',
      finalized_at: null,
      created_at: '2026-11-25T08:00:00Z',
      updated_at: '2026-11-25T08:00:00Z',
      lines: [
        {
          id: 'pospayline_1',
          staff_id: 'admin_1',
          staff: { id: 'admin_1', email: 'cashier@parkviet.vn', full_name: 'Nguyễn An' },
          position: 0,
          piece_quantity: '0',
          piece_amount: '0',
          work_days: '26',
          time_amount: '10000000',
          paid_leave_days: '0',
          paid_leave_amount: '0',
          payroll_allowance: '0',
          other_allowance: '0',
          bonus: '0',
          gross_amount: '10000000',
          employee_bhxh: '800000',
          employee_bhyt: '0',
          employee_bhtn: '0',
          other_deduction: '0',
          pit_tax: '200000',
          total_deductions: '1000000',
          net_amount: '9000000',
          employer_bhxh: '0',
          employer_bhyt: '0',
          employer_bhtn: '0',
          note: '',
        },
      ],
    },
  ]

  await page.route('**/api/v3/admin/pos/branches*', (route) =>
    route.fulfill({ json: { data: branches, meta: { next: null } } }),
  )
  await page.route('**/api/v3/admin/pos/staff?*', (route) =>
    route.fulfill({
      json: {
        data: staff,
        meta: {
          page: 1,
          limit: 100,
          count: 1,
          pages: 1,
          next: null,
          summary: { total: 1, active: 1, disabled: 0, assigned: 1, unassigned: 0 },
        },
      },
    }),
  )
  await page.route('**/api/v3/admin/pos/staff_shifts*', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 'posshift_1',
            status: 'closed',
            business_date: '2026-11-25',
            opened_at: '2026-11-25T01:00:00Z',
            closed_at: '2026-11-25T05:30:00Z',
            duration_minutes: 270,
            currency: 'VND',
            opening_float: '500000.0',
            branch_id: 'branch_main',
            branch_name: 'Chi nhánh Trung tâm',
            register_id: 'reg_1',
            register_name: 'Quầy 1',
            staff_id: 'admin_1',
            staff_name: 'Nguyễn An',
            staff_email: 'cashier@parkviet.vn',
            expected_cash: '1500000.0',
            counted_cash: '1500000.0',
            variance: '0.0',
            inflow_total: '1000000.0',
            outflow_total: '0.0',
            reason: null,
            breakdown: {},
          },
        ],
        meta: {
          page: 1,
          limit: 100,
          count: 1,
          pages: 1,
          next: null,
          summary: { total: 1, open: 0, closed: 1 },
        },
      },
    }),
  )
  await page.route('**/api/v3/admin/pos/payrolls?*', (route) =>
    route.fulfill({
      json: {
        data: payrolls,
        meta: { page: 1, limit: 100, count: payrolls.length, pages: 1, next: null, next_code: 'BL0002' },
      },
    }),
  )
  await page.route('**/api/v3/admin/pos/payrolls/pospay_1', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { lines?: unknown[] }
      if (body.lines) payrolls[0].lines = body.lines
      await route.fulfill({ json: { data: payrolls[0] } })
      return
    }
    await route.fulfill({ json: { data: payrolls[0] } })
  })
  await page.route('**/api/v3/admin/pos/payrolls/pospay_1/finalize', async (route) => {
    payrolls[0].status = 'finalized'
    await route.fulfill({ json: { data: payrolls[0] } })
  })
}

test('renders Staff Shifts & Payroll submenus, cash calculator, and VN accounting payroll sheet', async ({
  page,
}) => {
  await installDashboardShell(page, { authenticated: true, read: true, write: true })
  await page.route('**/api/v3/admin/pos/context*', (route) =>
    route.fulfill({
      json: posContext(new URL(route.request().url()), {
        admin: true,
        capabilities: ['pos.topology.manage'],
      }),
    }),
  )
  await installMocks(page)

  // 1. Staff Shifts screen + all 4 Staff sidebar submenus
  await page.goto('/store_1/staff-shifts')
  await expect(page.getByRole('heading', { name: 'Quản lý ca' })).toBeVisible()
  await expect(page.locator('[data-sidebar="menu-sub-button"]', { hasText: 'Danh sách nhân viên' })).toBeVisible()
  await expect(page.locator('[data-sidebar="menu-sub-button"]', { hasText: 'Quản lý ca' })).toBeVisible()
  await expect(page.locator('[data-sidebar="menu-sub-button"]', { hasText: 'Bảng lương' })).toBeVisible()
  await expect(page.locator('[data-sidebar="menu-sub-button"]', { hasText: 'Nhóm quyền' })).toBeVisible()
  await expect(page.getByRole('cell', { name: /Nguyễn An/ })).toBeVisible()
  await expect(page.getByText('4g 30p')).toBeVisible()

  // Open Cash Calculator & verify Vietnamese words output
  await page.getByRole('button', { name: 'Công cụ tính tiền mặt' }).click()
  await page.getByPlaceholder('0').first().fill('2')
  await expect(page.getByText('Một triệu đồng')).toBeVisible()
  await page.getByRole('button', { name: 'Đóng' }).click()

  // 2. Payroll list screen
  await page.goto('/store_1/payroll')
  await expect(page.getByRole('heading', { name: 'Bảng lương' })).toBeVisible()
  await expect(page.getByText('BL0001')).toBeVisible()
  await expect(page.getByText('Bảng lương tháng 11/2026')).toBeVisible()

  // 3. Open Payroll detail spreadsheet & finalize
  await page.getByRole('link', { name: 'BL0001' }).click()
  await expect(page.getByRole('heading', { name: /BL0001 — Bảng lương tháng 11\/2026/ })).toBeVisible()
  await expect(page.getByText('Lương sản phẩm')).toBeVisible()
  await expect(page.getByText('Khấu trừ vào lương (NLĐ)')).toBeVisible()
  await expect(page.getByText('Nguyễn An')).toBeVisible()
  await page.getByRole('button', { name: 'Chốt bảng lương' }).click()
  await expect(page.getByText('Đã chốt')).toBeVisible()
})
