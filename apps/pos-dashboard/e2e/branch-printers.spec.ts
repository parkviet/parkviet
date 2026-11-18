import { expect, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';

// The branch printer catalogue against a mocked Admin API. Presentation
// fixtures only, not grants of real API privileges.
type Row = Record<string, unknown> & { id: string; name: string };

async function install(page: Page, capabilities: string[] = [], admin = true) {
  const branch = { id: 'branch_main', name: 'Quán Hiền', code: 'main', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'stock_main', receiving_stock_location_id: null, receiving_note: null, business_day_cutoff: '04:00', profile_key: 'khac', sales_settings: {} as Record<string, unknown> };
  const state = {
    printers: [] as Row[],
    writes: [] as { method: string; path: string; body: Record<string, unknown>; key: string | undefined }[],
    salesWrites: [] as Record<string, unknown>[],
    templates: [
      { id: 'postpl_sale_default', document_type: 'sale', name: 'Mẫu K80 chuẩn', paper: '80mm', status: 'active', is_default: true, current_version: 1, version: 1, config: {}, updated_by: null, created_at: '2026-11-18T00:00:00Z', updated_at: '2026-11-18T00:00:00Z' },
      { id: 'postpl_sale_k58', document_type: 'sale', name: 'Mẫu K58 gọn', paper: '58mm', status: 'active', is_default: false, current_version: 1, version: 1, config: {}, updated_by: null, created_at: '2026-11-18T00:00:00Z', updated_at: '2026-11-18T00:00:00Z' },
    ],
    chosenTemplates: {} as Record<string, string | null>,
    testAnswer: { print_job: { id: 'posprintjob_1', kind: 'test' }, document: null } as unknown,
  };
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v3/admin', ''); const method = request.method();
    const body = (method === 'GET' || method === 'DELETE' ? {} : request.postDataJSON() ?? {}) as Record<string, unknown>;
    const selected = url.searchParams.get('branch_id');
    if (path === '/pos/context') return route.fulfill({ json: { staff: { id: 'staff_admin', full_name: 'Quản trị' }, store: { id: 'store_1', name: 'Quán Hiền', currency: 'VND' }, administration: { read: admin, write: admin }, capabilities: selected === 'branch_main' ? capabilities : [], branches: [branch], registers: [{ id: 'reg_1', branch_id: 'branch_main', name: 'Quầy 1', code: 'q1', status: 'active' }], modules: {}, selection: { branch_id: selected, register_id: null }, onboarding: { required: false, can_setup: admin } } });
    if (path === '/pos/branches') return route.fulfill({ json: { data: [branch], meta: { next: null } } });
    if (path === '/pos/branches/branch_main/sales_settings' && method === 'PUT') {
      state.salesWrites.push(body);
      branch.sales_settings = { ...branch.sales_settings, ...body };
      return route.fulfill({ json: { data: branch.sales_settings } });
    }
    if (path === '/pos/printers/stations') return route.fulfill({ json: { data: [{ id: 'posdevice_1', name: 'Trạm bếp' }] } });
    if (path.startsWith('/pos/printers') && method !== 'GET') state.writes.push({ method, path, body, key: request.headers()['idempotency-key'] });
    if (path === '/pos/printers' && method === 'GET') return route.fulfill({ json: { data: state.printers } });
    if (path === '/pos/printers' && method === 'POST') {
      const row = { id: `posprinter_${state.printers.length + 1}`, branch_id: 'branch_main', status: 'active', ...body } as Row;
      state.printers.push(row); return route.fulfill({ status: 201, json: { data: row } });
    }
    if (path.endsWith('/test')) return route.fulfill({ status: 201, json: { data: state.testAnswer } });
    const printer = state.printers.find((row) => path === `/pos/printers/${row.id}`);
    if (printer && method === 'PATCH') { Object.assign(printer, body); return route.fulfill({ json: { data: printer } }); }
    if (printer && method === 'DELETE') return route.fulfill({ status: 409, json: { error: { code: 'conflict', message: 'x', details: { reason: 'printer_in_use' } } } });
    if (path === '/pos/receipt_templates') return route.fulfill({ json: { data: state.templates } });
    if (path === '/pos/branches/branch_main/receipt_templates') {
      if (method === 'PUT') {
        const changes = (body.templates ?? {}) as Record<string, string | null>;
        for (const [docType, id] of Object.entries(changes)) state.chosenTemplates[docType] = id;
      }
      const list = ['sale', 'prebill'].map((docType) => {
        const chosen = state.templates.find((tpl) => tpl.id === state.chosenTemplates[docType]) ?? null;
        const def = state.templates.find((tpl) => tpl.document_type === docType && tpl.is_default) ?? null;
        return { document_type: docType, receipt_template: chosen, effective_template: chosen ?? def, uses_store_default: !chosen };
      });
      return route.fulfill({ json: { data: { branch_id: 'branch_main', templates: list } } });
    }
    return route.fulfill({ json: { data: [], meta: { page: 1, pages: 1, count: 0, next: null } } });
  });
  await installDashboardShell(page, { authenticated: true, read: admin, write: admin });
  return state;
}

const row = (name: string) => ({ id: 'posprinter_9', branch_id: 'branch_main', name, connection: 'sunmi_builtin', address: null, bluetooth_id: null, paper: '58mm', command_language: 'escpos', roles: ['receipt'], print_station_device_id: 'posdevice_1', register_id: null, status: 'active', settings: {} });
const pick = async (page: Page, label: string, option: string) => { await page.getByRole('combobox', { name: label }).click(); await page.getByRole('option', { name: option, exact: true }).click(); };

test('adds a LAN printer with only the fields its connection uses', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/branches/branch_main/printing');
  await expect(page.getByText('Chi nhánh chưa có máy in.')).toBeVisible();
  await page.getByRole('button', { name: 'Thêm máy in' }).click();
  await page.getByLabel('Tên máy in').fill('Epson quầy');
  await pick(page, 'Kết nối', 'Epson ePOS (mạng LAN)');
  await page.getByLabel('Địa chỉ').fill('192.168.1.20:8008');
  await page.getByRole('form', { name: 'Thông tin máy in' }).getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByTestId('printer-row')).toContainText('Epson quầy');
  const write = state.writes.at(-1);
  expect(write?.body).toMatchObject({ branch_id: 'branch_main', connection: 'epson_epos', address: '192.168.1.20:8008', print_station_device_id: null, bluetooth_id: null });
  expect(write?.key).toBeTruthy();
});

test('a station printer picks its print station', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/branches/branch_main/printing');
  await page.getByRole('button', { name: 'Thêm máy in' }).click();
  await page.getByLabel('Tên máy in').fill('Sunmi');
  await pick(page, 'Kết nối', 'Máy Sunmi tích hợp');
  await pick(page, 'Trạm in', 'Trạm bếp');
  await page.getByRole('form', { name: 'Thông tin máy in' }).getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByTestId('printer-row')).toContainText('Sunmi');
  expect(state.writes.at(-1)?.body).toMatchObject({ connection: 'sunmi_builtin', print_station_device_id: 'posdevice_1', address: null });
});

test('a test print on a station says it was queued', async ({ page }) => {
  const state = await install(page); state.printers.push(row('Trạm'));
  await page.goto('/store_1/branches/branch_main/printing');
  await page.getByRole('button', { name: 'In thử' }).click();
  await expect(page.getByText('Đã gửi trang in thử tới hàng đợi của Trạm.')).toBeVisible();
});

test('a printer with jobs explains why it cannot be deleted', async ({ page }) => {
  const state = await install(page); state.printers.push(row('Trạm'));
  await page.goto('/store_1/branches/branch_main/printing');
  await page.getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByText('Máy in đã có lệnh in nên không xóa được. Hãy ngừng dùng máy.')).toBeVisible();
});

test('a printer manager without store administration reaches the printers and not the templates', async ({ page }) => {
  const state = await install(page, ['pos.printer.manage'], false); state.printers.push(row('Trạm'));
  await page.goto('/store_1/branches/branch_main/printing?branch=branch_main');
  await expect(page.getByTestId('printer-row')).toContainText('Trạm');
  await expect(page.getByRole('button', { name: 'In thử' })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Tự động in' }).getByRole('switch', { name: 'Tự động in hoá đơn khi thanh toán' })).toBeDisabled();
  const saleFn = page.locator('[data-function="sale"]');
  await expect(saleFn.getByRole('button', { name: 'Chọn máy in' })).toBeEnabled();
  await expect(saleFn.getByRole('button', { name: 'Chọn mẫu' })).toHaveCount(0);
});

test('shows three printing sections with navigation and saves an automatic print switch', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/branches/branch_main/printing');
  await expect(page.getByRole('region', { name: 'Tự động in' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Máy in' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Chức năng in' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Mục cài đặt in' });
  if ((page.viewportSize()?.width ?? 1280) >= 1024) {
    await expect(nav.getByRole('link')).toHaveText(['Tự động in', 'Máy in', 'Chức năng in']);
  } else {
    await expect(nav).toBeHidden();
  }
  await page.getByRole('switch', { name: 'Tự động in hoá đơn khi thanh toán' }).click();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect.poll(() => state.salesWrites.at(-1)?.auto_print_receipt).toBe(true);
});

test('print functions warn on missing printer, assign printers by role, pick a template, and preview it', async ({ page }) => {
  const state = await install(page);
  state.printers.push({ ...row('Máy quầy 1'), roles: [] });
  await page.goto('/store_1/branches/branch_main/printing');

  const saleFn = page.locator('[data-function="sale"]');
  await expect(saleFn.getByTestId('print-function-warning')).toContainText('chưa có máy in hoạt động');

  // Assign printer to the receipt role from the function row
  await saleFn.getByRole('button', { name: 'Chọn máy in' }).click();
  const printerDialog = page.getByRole('dialog');
  await printerDialog.getByRole('checkbox', { name: 'Máy quầy 1' }).check();
  await expect(printerDialog.getByTestId('printer-role-diff')).toContainText('Máy “Máy quầy 1” sẽ in thêm Biên lai.');
  await printerDialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(saleFn.getByTestId('print-function-warning')).toHaveCount(0);
  await expect(saleFn).toContainText('Máy quầy 1');
  expect(state.writes.at(-1)?.body).toEqual({ roles: ['receipt'] });

  // Pick branch template for sales receipt
  await saleFn.getByRole('button', { name: 'Chọn mẫu' }).click();
  const templateDialog = page.getByRole('dialog');
  await templateDialog.getByRole('combobox', { name: 'Phiếu bán hàng' }).click();
  await page.getByRole('option', { name: 'Mẫu K58 gọn', exact: true }).click();
  await templateDialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(saleFn).toContainText('Mẫu K58 gọn (58mm)');

  // Preview the active template
  await saleFn.getByRole('button', { name: 'Xem trước' }).click();
  const previewDialog = page.getByRole('dialog');
  await expect(previewDialog.getByTestId('print-function-preview-frame')).toBeVisible();
  await previewDialog.getByRole('button', { name: 'Đóng' }).click();
});
