import { expect, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';
import { posContext } from './support/pos-context';

// Presentation fixtures only: the real API checks the catalog codes, the
// single head office and the topology permissions.
const catalog = {
  tax_authorities: {
    basis: 'Tổ chức lại cơ quan thuế từ 01/07/2025.', updated_on: '2026-11-18', verified: false,
    items: [{ code: '01', name: 'Thuế thành phố Hà Nội' }, { code: '79', name: 'Thuế thành phố Hồ Chí Minh' }],
  },
  industries: {
    basis: 'VSIC 2018.', updated_on: '2026-11-18', verified: false,
    items: [
      { code: '5610', group: 'fnb', name: 'Nhà hàng và các dịch vụ ăn uống phục vụ lưu động' },
      { code: '9329', group: 'entertainment', name: 'Hoạt động vui chơi giải trí khác (karaoke, bida, trò chơi)' },
    ],
  },
};
function world() {
  return {
    profile: {
      id: null as string | null, store_info_saved: true, name: 'Quán Hiền', tax_code: '0312345678', province_code: null as string | null,
      ward_code: null as string | null, province_name: null as string | null, ward_name: null as string | null, street: null as string | null,
      description: null as string | null, store_code: null, legacy_tax_code: null, declaration_period: null as string | null,
      tax_authority_code: null as string | null, business_area_m2: null as string | null, industry_code: null as string | null,
      signer_name: null as string | null, preparer_name: null, storekeeper_name: null, cashier_name: null,
      locations: [
        { branch_id: 'branch_main', name: 'Chi nhánh chính', code: 'main', status: 'active', address: '1 Lê Lợi, Bến Thành, Hồ Chí Minh, Việt Nam', tax_location_code: null as string | null, tax_head_office: true },
        { branch_id: 'branch_two', name: 'Chi nhánh Quận 3', code: 'q3', status: 'active', address: null, tax_location_code: null as string | null, tax_head_office: false },
      ],
      readiness: { filled: 2, total: 9, missing: ['business_address', 'declaration_period', 'tax_authority_code', 'industry_code', 'business_area_m2', 'signer_name', 'head_office_location'] },
      updated_at: null,
    },
    writes: [] as Record<string, unknown>[],
    refuse: null as null | { status: number; body: unknown },
  };
}
async function install(page: Page, state: ReturnType<typeof world>, access = { read: true, write: true }) {
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v3/admin', '');
    const ok = (data: unknown) => route.fulfill({ json: { data } });
    if (path === '/pos/context') {
      const context = posContext(url, { capabilities: [], admin: true });
      return route.fulfill({ json: { ...context, administration: access } });
    }
    if (path === '/pos/tax_catalog') return ok(catalog);
    if (path === '/pos/admin_units')
      return ok(url.searchParams.get('province')
        ? { province: '79', wards: [{ code: '26734', name: 'Bến Thành', kind: 'xa_phuong' }] }
        : { provinces: [{ code: '79', name: 'Hồ Chí Minh', kind: 'tinh' }] });
    if (path === '/pos/tax_profile') {
      if (request.method() === 'PATCH') {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.writes.push(body);
        if (state.refuse) return route.fulfill({ status: state.refuse.status, json: state.refuse.body });
        const { locations, ...fields } = body as { locations: { branch_id: string; tax_location_code: string | null; tax_head_office: boolean }[] };
        Object.assign(state.profile, fields, { id: 'postaxprofile_1', province_name: 'Hồ Chí Minh', ward_name: 'Bến Thành' });
        for (const row of locations) Object.assign(state.profile.locations.find((item) => item.branch_id === row.branch_id)!, row);
        state.profile.readiness = { filled: 9, total: 9, missing: [] };
      }
      return ok(state.profile);
    }
    return ok([]);
  });
  await installDashboardShell(page, { authenticated: true, ...access });
}
async function pick(page: Page, label: string, search: string, option: RegExp) {
  await page.getByLabel(label, { exact: true }).click();
  // Closed pickers keep their search box mounted; type into the open one.
  await page.locator('[data-slot="combobox-search"][aria-expanded="true"]').fill(search);
  await page.getByRole('option', { name: option }).click();
}

test('fills the declaration details, moves the head office and saves them in one request', async ({ page }) => {
  const state = world(); await install(page, state); await page.goto('/store_1/settings/tax-info');
  await expect(page.getByTestId('tax-info-readiness')).toHaveText('2/9 trường cần cho tờ khai');
  await expect(page.getByTestId('tax-info-missing')).toContainText('Còn thiếu: địa chỉ kinh doanh, kỳ kê khai');
  const sidebar = page.locator('[data-sidebar="sidebar"]').first();
  const storeInfo = sidebar.getByRole('link', { name: 'Thông tin cửa hàng', exact: true });
  const taxInfo = sidebar.getByRole('link', { name: 'Thông tin kê khai thuế', exact: true });
  await expect(taxInfo).toHaveAttribute('href', '/store_1/settings/tax-info');
  expect((await storeInfo.boundingBox())!.y).toBeLessThan((await taxInfo.boundingBox())!.y);

  await page.getByLabel('Mã số thuế / số định danh').fill('001234567890');
  await page.getByRole('button', { name: 'Chọn địa chỉ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Chọn địa chỉ' });
  await dialog.getByLabel('Tỉnh, thành phố').selectOption('79');
  await dialog.getByLabel('Phường, xã').selectOption('26734');
  await dialog.getByLabel('Số nhà, đường').fill('1 Lê Lợi');
  await dialog.getByRole('button', { name: 'Chọn địa chỉ', exact: true }).click();
  const taxpayer = page.getByRole('region', { name: 'Người nộp thuế' });
  await expect(taxpayer.getByText('1 Lê Lợi, Bến Thành, Hồ Chí Minh, Việt Nam', { exact: true })).toBeVisible();

  await page.getByLabel('Kỳ kê khai', { exact: true }).click();
  await page.getByRole('option', { name: 'Theo quý', exact: true }).click();
  await pick(page, 'Cơ quan thuế quản lý', 'ho chi minh', /Thuế thành phố Hồ Chí Minh/);
  await pick(page, 'Ngành nghề kinh doanh', 'karaoke', /karaoke, bida/);
  await page.getByLabel('Diện tích kinh doanh (m²)').fill('45.5');
  await page.getByLabel('Mã địa điểm của Chi nhánh Quận 3').fill('00002');
  await page.getByLabel('Chi nhánh Quận 3 là trụ sở chính').check();
  await expect(page.getByLabel('Chi nhánh chính là trụ sở chính')).not.toBeChecked();
  await page.getByLabel('Người ký tờ khai').fill('Nguyễn Thị Hiền');

  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu thông tin kê khai thuế' })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    name: 'Quán Hiền', tax_code: '001234567890', province_code: '79', ward_code: '26734', street: '1 Lê Lợi',
    declaration_period: 'quarter', tax_authority_code: '79', industry_code: '9329', business_area_m2: '45.5',
    signer_name: 'Nguyễn Thị Hiền', preparer_name: null,
    locations: [
      { branch_id: 'branch_main', tax_location_code: null, tax_head_office: false },
      { branch_id: 'branch_two', tax_location_code: '00002', tax_head_office: true },
    ],
  });
  await expect(page.getByTestId('tax-info-readiness')).toHaveText('9/9 trường cần cho tờ khai');
  await expect(page.getByTestId('tax-info-missing')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lưu thay đổi', exact: true })).toBeDisabled();
});

test('checks fields before sending, shows server field errors and undoes the draft', async ({ page }) => {
  const state = world(); await install(page, state); await page.goto('/store_1/settings/tax-info');
  const save = page.getByRole('button', { name: 'Lưu thay đổi', exact: true });
  const taxCode = page.getByLabel('Mã số thuế / số định danh');
  await taxCode.fill('12345');
  await save.click();
  await expect(page.getByText('Mã số thuế gồm 10 chữ số (hoặc 10 chữ số kèm -3 chữ số), hoặc 12 chữ số.')).toBeVisible();
  expect(state.writes).toHaveLength(0);

  await taxCode.fill('0312345678');
  await pick(page, 'Cơ quan thuế quản lý', 'ha noi', /Hà Nội/);
  state.refuse = { status: 422, body: { error: { code: 'validation_error', message: 'Tax authority code is not included in the list', details: { tax_authority_code: ['is not included in the list'] } } } };
  await save.click();
  await expect(page.getByText('is not included in the list', { exact: true })).toBeVisible();

  state.refuse = { status: 409, body: { error: { code: 'conflict', message: 'Save the store information first.', details: { reason: 'store_info_required' } } } };
  await save.click();
  await expect(page.getByText('Lưu Thông tin cửa hàng trước khi kê khai thuế.')).toBeVisible();

  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  await expect(taxCode).toHaveValue('0312345678');
  await expect(page.getByLabel('Cơ quan thuế quản lý', { exact: true })).toContainText('Chọn cơ quan thuế');
  await expect(save).toBeDisabled();
});

test('a store reader sees the details without editing them', async ({ page }) => {
  const state = world(); await install(page, state, { read: true, write: false }); await page.goto('/store_1/settings/tax-info');
  await expect(page.getByLabel('Mã số thuế / số định danh')).toBeDisabled();
  await expect(page.getByLabel('Mã địa điểm của Chi nhánh chính')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Lưu thay đổi', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Chọn địa chỉ', exact: true })).toHaveCount(0);
});
