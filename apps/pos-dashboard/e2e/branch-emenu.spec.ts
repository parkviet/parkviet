import { expect, type Page, test } from '@playwright/test'
import { installDashboardShell } from './support/dashboard'

test('Giao diện: live color preview, cancel/save, and inline branch logo upload', async ({
  page,
}) => {
  const writes: WriteCall[] = []
  await install(page, writes)
  await page.goto('/store_1/branches/branch_main/emenu?branch=branch_main')
  await expect(page.getByRole('tab', { name: 'e-Menu' })).toHaveAttribute('aria-selected', 'true')
  const preview = page.getByTestId('emenu-preview-order')
  await expect(preview).toBeVisible()

  const look = page.getByRole('region', { name: 'Giao diện' })
  await look.getByRole('button', { name: '#1d4ed8' }).nth(2).click()
  await expect(preview).toHaveCSS('background-color', 'rgb(29, 78, 216)')

  // Discard restores the loaded button color
  await look.getByRole('button', { name: 'Hủy bỏ' }).click()
  await expect(preview).toHaveCSS('background-color', 'rgb(11, 110, 79)')

  // Pick again and save
  await look.getByRole('button', { name: '#1d4ed8' }).nth(2).click()
  await look.getByRole('button', { name: 'Lưu thiết lập' }).click()
  await expect
    .poll(() => writes.some((write) => write.body?.button_color === '#1d4ed8'))
    .toBe(true)

  // Inline branch logo upload (PNG <= 2MB)
  await look.locator('input[type="file"]').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
  })
  await expect
    .poll(() => writes.some((write) => write.path === '/pos/branches/branch_main/info/logo'))
    .toBe(true)
})

test('Thực đơn: import counter menu, non-counter dish badge, home sections, and ordered save', async ({
  page,
}) => {
  const writes: WriteCall[] = []
  await install(page, writes)
  await page.goto('/store_1/branches/branch_main/emenu?branch=branch_main')

  const phone = page.getByTestId('emenu-phone')
  await expect(phone.getByRole('heading', { name: 'Trà sữa', exact: true })).toBeVisible()
  await expect(phone.getByText('Trà sữa trân châu')).toBeVisible()
  await expect(phone.getByText('35.000 ₫').first()).toBeVisible()

  const menu = page.getByRole('region', { name: 'Thực đơn' })

  // Import from counter menu
  await menu.getByRole('button', { name: 'Lấy từ thực đơn quầy' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Lấy từ thực đơn quầy' }).click()
  await expect
    .poll(() => writes.some((write) => write.path === '/pos/emenu_menu/import'))
    .toBe(true)

  // Rename category and search a non-counter dish (shows "Không bán tại quầy" badge)
  await menu.getByRole('textbox', { name: 'Tên nhóm' }).fill('Đồ uống')
  await expect(phone.getByRole('heading', { name: 'Đồ uống' })).toBeVisible()
  await menu.getByRole('searchbox', { name: 'Tìm món để thêm' }).fill('bánh')
  const cakeOption = menu.getByRole('button', { name: /Bánh flan/ })
  await expect(cakeOption).toContainText('Không bán tại quầy')
  await cakeOption.click()
  await expect(phone.getByText('Bánh flan')).toBeVisible()

  // Enable Best sellers (manual) and pick the newly added dish
  await menu.getByRole('switch', { name: 'Món bán chạy' }).click()
  await menu.getByRole('button', { name: 'Sửa danh sách' }).click()
  await menu.getByRole('button', { name: 'Bánh flan', exact: true }).click()

  // Save Thực đơn -> PUT /pos/emenu_menu runs BEFORE PUT /pos/emenu_settings
  await menu.getByRole('button', { name: 'Lưu thiết lập' }).click()
  await expect
    .poll(() =>
      writes
        .filter((w) => w.path === '/pos/emenu_menu' || w.path === '/pos/emenu_settings')
        .map((w) => w.path),
    )
    .toEqual(['/pos/emenu_menu', '/pos/emenu_settings'])
  expect(writes.find((w) => w.path === '/pos/emenu_settings')?.body).toMatchObject({
    best_sellers_enabled: true,
    best_seller_item_ids: ['prod_cake'],
  })
})

test('Tem QR: SectionNav switches preview to sticker, shows area–table label, saves and prints', async ({
  page,
}) => {
  const writes: WriteCall[] = []
  await page.addInitScript(() => {
    ;(window as unknown as { printed: number }).printed = 0
    window.print = () => {
      ;(window as unknown as { printed: number }).printed += 1
    }
  })
  await install(page, writes)
  await page.goto('/store_1/branches/branch_main/emenu?branch=branch_main')

  // Clicking Tem QR in SectionNav switches preview to Sticker tab automatically
  const sectionNav = page.getByRole('navigation', { name: 'e-Menu' })
  await sectionNav.getByRole('link', { name: 'Tem QR' }).click()
  const preview = page.getByTestId('emenu-sticker')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Tầng 1 – Bàn 1')

  // Clicking Giao diện in SectionNav switches preview back to Phone tab
  await sectionNav.getByRole('link', { name: 'Giao diện' }).click()
  await expect(page.getByTestId('emenu-phone')).toBeVisible()

  // Editing StickerCard focuses back to sticker preview and saves settings
  const sticker = page.getByRole('region', { name: 'Tem QR' })
  await sticker.getByRole('switch', { name: 'In Wi-Fi' }).click()
  await sticker.getByLabel('Tên Wi-Fi').fill('QuanTra')
  await sticker.getByLabel('Mật khẩu Wi-Fi').fill('12345678')
  await expect(preview).toContainText('Wi-Fi: QuanTra')
  await expect(preview).toContainText('Mật khẩu: 12345678')
  await expect(preview).toContainText('Quán Trà')
  await sticker.getByLabel('Khổ tem', { exact: true }).click()
  await page.getByRole('option', { name: 'Tùy chỉnh', exact: true }).click()
  await sticker.getByRole('spinbutton', { name: 'Chiều rộng (mm)' }).fill('58')
  await expect(page.getByText('Khổ 58 mm, đúng tỉ lệ. Mã QR là mẫu.')).toBeVisible()
  await sticker.getByRole('button', { name: 'Lưu thiết lập' }).click()
  await expect
    .poll(() => writes.find((write) => write.path === '/pos/emenu_settings')?.body)
    .toMatchObject({ sticker_wifi_name: 'QuanTra', sticker_size: 'custom', sticker_custom_mm: 58 })

  // Print stickers on paper with area–table labels
  const paper = page.getByRole('region', { name: 'In tem ra giấy' })
  await paper.getByRole('checkbox', { name: 'Tất cả bàn (2)' }).check()
  await paper.getByRole('button', { name: 'In tem 2 bàn' }).click()
  await page.getByRole('button', { name: 'Tạo mã mới và in' }).click()
  const sheet = page.getByTestId('emenu-print-sheet')
  await expect(sheet).toContainText('Tầng 1 – Bàn 1')
  await expect(sheet).toContainText('Tầng 1 – Bàn 2')
  await expect(sheet.locator('svg')).toHaveCount(2)
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed))
    .toBe(1)
  expect(
    writes
      .filter((write) => write.path === '/pos/table_codes')
      .map((write) => write.body?.resource_id),
  ).toEqual(['resource_1', 'resource_2'])
  await paper.getByRole('button', { name: 'In lại 2 tem vừa tạo' }).click()
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed))
    .toBe(2)
})

test('Bổ sung: paused preview hides menu, and direct_to_kitchen saves limits via table_settings', async ({
  page,
}) => {
  const writes: WriteCall[] = []
  await install(page, writes)
  await page.goto('/store_1/branches/branch_main/emenu?branch=branch_main')

  const phone = page.getByTestId('emenu-phone')
  const extra = page.getByRole('region', { name: 'Bổ sung' })

  // Toggling paused shows the paused screen and hides the interactive menu
  await extra.getByRole('switch', { name: 'Tạm dừng nhận đơn' }).click()
  await expect(phone.getByText('Quán đang tạm ngưng nhận đơn.')).toBeVisible()
  await expect(page.getByTestId('emenu-preview-order')).toHaveCount(0)

  // Switch qr_order_mode to direct_to_kitchen -> requires auto limit & max items
  await extra.getByLabel('Đơn khách gọi').click()
  await page.getByRole('option', { name: 'Gửi thẳng vào bếp trong hạn mức' }).click()
  const saveButton = extra.getByRole('button', { name: 'Lưu thiết lập' })
  await expect(saveButton).toBeDisabled()

  await extra.getByLabel('Hạn mức tiền mỗi đơn (đ)').fill('500.000')
  await extra.getByLabel('Số món tối đa mỗi đơn').fill('12')
  await expect(saveButton).toBeEnabled()
  await saveButton.click()

  await expect
    .poll(() => writes.find((write) => write.path === '/pos/emenu_settings')?.body)
    .toMatchObject({ paused: true })
  await expect
    .poll(() => writes.find((write) => write.path === '/pos/table_settings')?.body)
    .toEqual({
      branch_id: 'branch_main',
      qr_order_mode: 'direct_to_kitchen',
      qr_order_auto_limit: '500000',
      qr_order_auto_max_items: 12,
    })
})

type WriteCall = { path: string; method: string; body: Record<string, unknown> | null }

// A prepared product's operating data, keyed by product id.
function dish(productId: string, name: string, price: string) {
  return {
    product_id: productId,
    name,
    product_kind: 'prepared',
    kind: 'single',
    kitchen_category: null,
    cup_label: false,
    show_components_on_kds: true,
    qr_orderable: true,
    drink_credit: null,
    drink_credit_categories: [],
    tax_category_id: null,
    modifier_group_ids: [],
    components: [],
    variants: [{ id: `variant_${productId}`, name, sku: null, price }],
  }
}

async function install(page: Page, writes: WriteCall[]) {
  const branch = {
    id: 'branch_main',
    name: 'Quán Trà',
    code: 'main',
    status: 'active',
    timezone: 'Asia/Ho_Chi_Minh',
    stock_location_id: 'stock_main',
    receiving_stock_location_id: null,
    receiving_note: null,
    business_day_cutoff: '04:00',
    profile_key: 'khac',
  }
  let storedSettings: Record<string, unknown> = { store_name: 'Quán Trà' }
  let storedMenu = [
    {
      id: 'posemenucat_1',
      name: 'Trà sữa',
      color: null as string | null,
      image_url: null as string | null,
      items: [{ id: 'posemenuitem_1', product_id: 'prod_tea', position: 0 }],
    },
  ]
  let storedTableSettings: Record<string, unknown> = {
    branch_id: 'branch_main',
    qr_order_mode: 'staff_approval',
    qr_order_auto_limit: null,
    qr_order_auto_max_items: 10,
  }

  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v3/admin', '')
    const method = request.method()
    const contentType = request.headers()['content-type'] ?? ''
    const isMultipart = contentType.includes('multipart/form-data')
    const body =
      method === 'GET' || isMultipart
        ? null
        : ((request.postDataJSON() as Record<string, unknown> | null) ?? null)
    if (method !== 'GET') writes.push({ path, method, body })

    if (path === '/pos/context') {
      return route.fulfill({
        json: {
          staff: { id: 'staff_admin', full_name: 'Quản trị' },
          store: { id: 'store_1', name: 'Quán Trà', currency: 'VND' },
          administration: { read: true, write: true },
          capabilities: [],
          branches: [branch],
          registers: [],
          modules: { 'fnb.qr_order': true },
          selection: { branch_id: url.searchParams.get('branch_id'), register_id: null },
          onboarding: { required: false, can_setup: true },
        },
      })
    }
    if (path === '/pos/branches')
      return route.fulfill({ json: { data: [branch], meta: { next: null } } })
    if (path === '/pos/branches/branch_main/info/logo' && method === 'POST') {
      storedSettings = { ...storedSettings, logo_url: 'https://example.test/logo.png' }
      return route.fulfill({
        json: { data: { overrides: {}, logo_url: 'https://example.test/logo.png' } },
      })
    }
    if (path === '/pos/branches/branch_main/info') {
      return route.fulfill({
        json: {
          data: {
            overrides: {},
            logo_url: (storedSettings.logo_url as string | undefined) ?? null,
          },
        },
      })
    }
    if (path === '/pos/emenu_settings') {
      if (method === 'PUT' && body) {
        const { branch_id: _b, ...rest } = body
        storedSettings = { ...storedSettings, ...rest }
      }
      return route.fulfill({ json: { data: storedSettings } })
    }
    if (path === '/pos/emenu_menu/import' && method === 'POST') {
      storedMenu = [
        {
          id: 'posemenucat_1',
          name: 'Trà sữa',
          color: '#0b6e4f',
          image_url: null,
          items: [{ id: 'posemenuitem_1', product_id: 'prod_tea', position: 0 }],
        },
      ]
      return route.fulfill({ json: { data: storedMenu } })
    }
    if (path === '/pos/emenu_menu') {
      if (method === 'PUT' && Array.isArray(body?.categories)) {
        storedMenu = (body.categories as Array<Record<string, unknown>>).map((cat, idx) => ({
          id: (cat.id as string | undefined) ?? `posemenucat_${idx + 1}`,
          name: String(cat.name ?? ''),
          color: (cat.color as string | null) ?? null,
          image_url: null,
          items: Array.isArray(cat.items)
            ? (cat.items as string[]).map((id, position) => ({
                id: `posemenuitem_${idx}_${position}`,
                product_id: id,
                position,
              }))
            : [],
        }))
      }
      return route.fulfill({ json: { data: storedMenu } })
    }
    if (path === '/pos/table_settings') {
      if (method === 'PUT' && body) {
        storedTableSettings = { ...storedTableSettings, ...body }
      }
      return route.fulfill({ json: { data: storedTableSettings } })
    }
    if (path === '/pos/areas') {
      return route.fulfill({
        json: {
          data: [
            {
              id: 'area_1',
              branch_id: 'branch_main',
              name: 'Tầng 1',
              floor_width: 24,
              floor_height: 16,
              position: 0,
              status: 'active',
            },
          ],
        },
      })
    }
    if (path === '/pos/table_codes' && method === 'GET') {
      const rows = [
        {
          resource_id: 'resource_1',
          name: 'Bàn 1',
          area_id: 'area_1',
          table_code: { rotated_at: '2026-11-01T00:00:00Z' },
        },
        { resource_id: 'resource_2', name: 'Bàn 2', area_id: 'area_1', table_code: null },
      ]
      return route.fulfill({ json: { data: rows } })
    }
    if (path === '/pos/table_codes') {
      const id = String(body?.resource_id)
      return route.fulfill({
        json: { data: {}, meta: { url: `https://example.test/table/?t=${id}` } },
      })
    }
    if (path === '/pos/menu') {
      return route.fulfill({
        json: {
          data: {
            categories: [{ id: 'ctg_tea', name: 'Trà sữa', position: 0, parent_id: null }],
            items: [
              {
                ...dish('prod_tea', 'Trà sữa trân châu', '35000.0'),
                category_ids: ['ctg_tea'],
                image_url: null,
                sold_out: false,
              },
              {
                ...dish('prod_coffee', 'Cà phê sữa', '29000.0'),
                category_ids: ['ctg_tea'],
                image_url: null,
                sold_out: false,
              },
            ],
          },
        },
      })
    }
    if (path === '/pos/products/settings') {
      const items = [
        dish('prod_tea', 'Trà sữa trân châu', '35000.0'),
        dish('prod_coffee', 'Cà phê sữa', '29000.0'),
        dish('prod_cake', 'Bánh flan', '25000.0'),
      ]
      return route.fulfill({ json: { data: items, meta: { tax_defaults: { food: null, alcohol: null } } } })
    }
    return route.fulfill({
      json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } },
    })
  })
  await installDashboardShell(page, { authenticated: true, read: true, write: true })
}
