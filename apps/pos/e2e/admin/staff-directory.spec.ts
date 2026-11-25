import { expect, type Page, test } from '@playwright/test'
import { installDashboardShell } from './support/dashboard'
import { posContext } from './support/pos-context'

async function installStaffMocks(page: Page) {
  const branches = [
    { id: 'branch_main', name: 'Chi nhánh Trung tâm', code: 'main', status: 'active' },
    { id: 'branch_2', name: 'Chi nhánh Quận 1', code: 'q1', status: 'active' },
  ]
  const roles = [
    {
      id: 'posrole_cashier',
      name: 'Thu ngân',
      capabilities: ['pos.shift.open', 'pos.payment.collect'],
      status: 'active',
      membership_count: 1,
    },
  ]
  const staff = [
    {
      id: 'admin_1',
      email: 'owner@parkviet.vn',
      first_name: 'Chủ',
      last_name: 'Quán',
      full_name: 'Chủ Quán',
      status: 'active',
      deactivated_at: null,
      last_active_at: null,
      created_at: '2026-11-01T08:00:00Z',
      memberships: [
        {
          id: 'posmembership_1',
          branch_id: 'branch_main',
          branch_name: 'Chi nhánh Trung tâm',
          staff_id: 'admin_1',
          capabilities: ['pos.shift.open', 'pos.payment.collect'],
          staff_role: { id: 'posrole_cashier', name: 'Thu ngân' },
          status: 'active',
          pin_set: false,
        },
      ],
    },
    {
      id: 'admin_2',
      email: 'nhanvien.moi@parkviet.vn',
      first_name: 'Nguyễn',
      last_name: 'An',
      full_name: 'Nguyễn An',
      status: 'active',
      deactivated_at: null,
      last_active_at: null,
      created_at: '2026-11-20T08:00:00Z',
      memberships: [],
    },
  ]

  await page.route('**/api/v3/admin/pos/branches*', (route) =>
    route.fulfill({ json: { data: branches, meta: { next: null } } }),
  )
  await page.route('**/api/v3/admin/pos/staff_roles*', (route) =>
    route.fulfill({ json: { data: roles, meta: { next: null } } }),
  )
  await page.route('**/api/v3/admin/pos/staff', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      const created = {
        id: 'admin_3',
        email: String(body.email),
        first_name: (body.first_name as string) || null,
        last_name: (body.last_name as string) || null,
        full_name: [body.first_name, body.last_name].filter(Boolean).join(' ') || null,
        status: 'active',
        deactivated_at: null,
        last_active_at: null,
        created_at: '2026-11-25T08:00:00Z',
        memberships: [],
      }
      staff.push(created)
      await route.fulfill({ status: 201, json: { data: created } })
      return
    }
    await route.continue()
  })
  await page.route('**/api/v3/admin/pos/staff?*', (route) => {
    const url = new URL(route.request().url())
    const branchId = url.searchParams.get('branch_id')
    const filtered =
      branchId === 'unassigned'
        ? staff.filter((s) => s.memberships.length === 0)
        : branchId
          ? staff.filter((s) => s.memberships.some((m) => m.branch_id === branchId))
          : staff
    return route.fulfill({
      json: {
        data: filtered,
        meta: {
          page: 1,
          limit: 50,
          count: filtered.length,
          pages: 1,
          next: null,
          summary: {
            total: staff.length,
            active: staff.filter((s) => s.status === 'active').length,
            disabled: staff.filter((s) => s.status === 'disabled').length,
            assigned: staff.filter((s) => s.memberships.length > 0).length,
            unassigned: staff.filter((s) => s.memberships.length === 0).length,
          },
        },
      },
    })
  })
  await page.route('**/api/v3/admin/pos/memberships', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      const target = staff.find((s) => s.id === body.staff_id)
      const branch = branches.find((b) => b.id === body.branch_id)
      const role = roles.find((r) => r.id === body.staff_role_id) ?? null
      const created = {
        id: `posmembership_${Date.now()}`,
        branch_id: String(body.branch_id),
        branch_name: branch?.name ?? '',
        staff_id: String(body.staff_id),
        capabilities: role ? role.capabilities : ['pos.shift.open'],
        staff_role: role ? { id: role.id, name: role.name } : null,
        status: 'active' as const,
        pin_set: false,
      }
      target?.memberships.push(created)
      await route.fulfill({ status: 201, json: { data: created } })
      return
    }
    await route.fulfill({ json: { data: [], meta: { next: null } } })
  })
}

test('shows Staff menu in sidebar, creates unassigned staff, and assigns to a branch from outside Branches', async ({
  page,
}, testInfo) => {
  await installDashboardShell(page, { authenticated: true, read: true, write: true })
  await page.route('**/api/v3/admin/pos/context*', (route) =>
    route.fulfill({
      json: posContext(new URL(route.request().url()), {
        admin: true,
        capabilities: ['pos.topology.manage'],
      }),
    }),
  )
  await installStaffMocks(page)

  await page.goto('/store_1/employees')

  // Sidebar shows Staff group with both submenus
  await expect(page.getByRole('heading', { name: 'Danh sách nhân viên' })).toBeVisible()
  if (testInfo.project.name !== 'mobile') {
    await expect(page.getByRole('link', { name: 'Danh sách nhân viên', exact: true })).toBeVisible()
    await expect(page.locator('[data-sidebar="menu-sub-button"]', { hasText: 'Nhóm quyền' })).toBeVisible()
  }

  // Shows both assigned and unassigned staff
  await expect(page.getByText('Chủ Quán')).toBeVisible()
  await expect(page.getByText('Nguyễn An')).toBeVisible()

  // Create a new unassigned staff member
  await page.getByRole('button', { name: 'Thêm nhân viên' }).click()
  await page.getByLabel('Họ').fill('Trần')
  await page.getByLabel('Tên').fill('Bình')
  await page.getByLabel(/Email/).fill('tran.binh@parkviet.vn')
  await page.getByLabel(/Mật khẩu/).fill('secret123')
  await page.getByRole('button', { name: 'Lưu' }).click()

  await expect(page.getByText('Trần Bình')).toBeVisible()

  // Assign Nguyễn An to a branch directly from the Staff Directory screen
  const row = page.locator('tr', { hasText: 'Nguyễn An' })
  await row.getByRole('button', { name: 'Phân chi nhánh' }).click()
  await expect(page.getByRole('heading', { name: 'Phân bổ chi nhánh cho nhân viên' })).toBeVisible()
  // Live role permission preview is visible when Thu ngân role is selected
  await expect(page.getByText('Quyền được cấp theo nhóm "Thu ngân":')).toBeVisible()
  await page.getByRole('button', { name: 'Lưu' }).click()

  // Branch badge now appears inside the modal and on the table row
  await expect(page.getByText('Đã phân vào 1 chi nhánh')).toBeVisible()
  await page.getByRole('button', { name: 'Đóng' }).click()
  await expect(row.getByText('Chi nhánh Trung tâm · Thu ngân')).toBeVisible()
})
