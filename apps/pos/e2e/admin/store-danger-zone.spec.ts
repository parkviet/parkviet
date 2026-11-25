import { expect, test } from '@playwright/test'
import { installDashboardShell } from './support/dashboard'
import { posContext } from './support/pos-context'

test('Store Info Danger Zone supports per-branch reset, branch deletion, and store deletion', async ({
  page,
}) => {
  const captured: { reset?: Record<string, unknown>; deleteBranch?: Record<string, unknown>; deleteStore?: Record<string, unknown> } = {}

  await installDashboardShell(page, { authenticated: true, read: true, write: true })

  await page.route('**/api/v3/admin/pos/context*', (route) =>
    route.fulfill({
      json: posContext(new URL(route.request().url()), {
        admin: true,
        capabilities: ['pos.topology.manage'],
      }),
    }),
  )

  await page.route('**/api/v3/admin/pos/business_profiles*', (route) =>
    route.fulfill({
      json: {
        data: {
          profiles: [{ key: 'fnb_cafe', status: 'available' }],
        },
      },
    }),
  )

  await page.route('**/api/v3/admin/pos/store_info', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          data: {
            id: 'posinfo_1',
            name: 'ParkViet Demo',
            phone: '0901234567',
            admin_email: 'admin@parkviet.vn',
            contact_email: 'hello@parkviet.vn',
            tax_code: '0109876543',
            representative_id_number: '001090012345',
            representative_id_set: true,
            opening_time: '07:00',
            closing_time: '22:00',
            business_day_cutoff: '04:00',
            province_code: null,
            ward_code: null,
            province_name: null,
            ward_name: null,
            street: '123 Lê Lợi',
            description: 'Demo store',
            logo_url: null,
            profile_key: 'fnb_cafe',
            profile_keys: ['fnb_cafe'],
            interests: [],
            filled: 9,
            filled_total: 11,
            open_shifts: 0,
            fallback: {
              name: 'ParkViet Demo',
              phone: '0901234567',
              contact_email: 'hello@parkviet.vn',
              address: '123 Lê Lợi',
              logo_url: null,
            },
          },
        },
      })
    }
    return route.continue()
  })

  await page.route('**/api/v3/admin/pos/branches*', (route) =>
    route.fulfill({
      json: {
        data: [
          { id: 'posbranch_q1', name: 'Chi nhánh Quận 1', code: 'q1', status: 'active', is_default: true },
          { id: 'posbranch_q3', name: 'Chi nhánh Quận 3', code: 'q3', status: 'active', is_default: false },
        ],
      },
    }),
  )

  await page.route('**/api/v3/admin/pos/store_info/reset_data', async (route) => {
    captured.reset = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      json: {
        data: {
          scope: captured.reset.scope,
          branch_id: captured.reset.branch_id ?? null,
          branch_name: captured.reset.branch_id === 'posbranch_q1' ? 'Chi nhánh Quận 1' : null,
          deleted_counts: { transactions: 12, catalog: 4, total: 16 },
          preserved_staff: true,
        },
      },
    })
  })

  await page.route('**/api/v3/admin/pos/store_info/delete_branch', async (route) => {
    captured.deleteBranch = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      json: {
        data: {
          deleted_branch_id: captured.deleteBranch.branch_id,
          deleted_branch_name: 'Chi nhánh Quận 3',
          remaining_branches_count: 1,
        },
      },
    })
  })

  await page.route('**/api/v3/admin/pos/store_info/delete_store', async (route) => {
    captured.deleteStore = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      json: {
        data: {
          deleted_store_id: 'store_demo',
          deleted_store_name: 'ParkViet Demo',
          next_store_id: 'store_backup',
        },
      },
    })
  })

  await page.goto('/store_demo/settings/store-info')

  const dangerZone = page.getByTestId('store-danger-zone')
  await expect(dangerZone).toBeVisible()

  // 1. Wipe single branch data
  await page.getByTestId('danger-zone-reset-btn').click()
  await page.getByTestId('reset-scope-branch').click()
  await page.locator('#danger-reset-branch').selectOption('posbranch_q1')
  const submitReset = page.getByTestId('danger-reset-submit')
  await expect(submitReset).toBeDisabled()
  await page.locator('#danger-reset-confirm').fill('Chi nhánh Quận 1')
  await expect(submitReset).toBeEnabled()
  await submitReset.click()

  await expect.poll(() => captured.reset).toMatchObject({
    scope: 'branch',
    branch_id: 'posbranch_q1',
    wipe_transactions: true,
    wipe_catalog: false,
    confirmation: 'Chi nhánh Quận 1',
  })

  // 2. Delete single branch
  await page.getByTestId('danger-zone-delete-branch-btn').click()
  await page.locator('#danger-delete-branch').selectOption('posbranch_q3')
  const submitDeleteBranch = page.getByTestId('danger-delete-branch-submit')
  await expect(submitDeleteBranch).toBeDisabled()
  await page.locator('#danger-delete-branch-confirm').fill('Chi nhánh Quận 3')
  await expect(submitDeleteBranch).toBeEnabled()
  await submitDeleteBranch.click()

  await expect.poll(() => captured.deleteBranch).toMatchObject({
    branch_id: 'posbranch_q3',
    confirmation: 'Chi nhánh Quận 3',
  })

  // 3. Delete store
  await page.getByTestId('danger-zone-delete-store-btn').click()
  const submitDeleteStore = page.getByTestId('danger-delete-store-submit')
  await expect(submitDeleteStore).toBeDisabled()
  await page.locator('#danger-delete-store-confirm').fill('ParkViet Demo')
  await expect(submitDeleteStore).toBeEnabled()
  await submitDeleteStore.click()

  await expect.poll(() => captured.deleteStore).toMatchObject({
    confirmation: 'ParkViet Demo',
  })
})
