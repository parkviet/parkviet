import { expect, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';
import { pageMeta, posContext } from './support/pos-context';

type Funds = Record<string, unknown> & { id: string; kind: 'cash' | 'bank_manual'; status: string; available: string };
const funds = (id: string, overrides: Partial<Funds> = {}): Funds => ({
  id, workspace_id: 'ws_1', branch_id: 'branch_main', shift_id: 'shift_1', tender_attempt_id: null, kind: 'bank_manual',
  status: 'received', handed_amount: '200000.0', applied_amount: '200000.0', change_amount: '0.0', received_net: '200000.0',
  currency: 'VND', reference: `REF-${id}`, custody: 'drawer', allocated: '200000.0', payout_reserved: '0.0', paid_out: '0.0',
  available: '0.0', received_at: '2026-11-10T02:00:00Z', ...overrides,
});
const seed = () => [
  funds('posfunds_1'),
  funds('posfunds_2', { status: 'attention', available: '50000.0', allocated: '150000.0' }),
  funds('posfunds_3', { kind: 'cash', available: '0.0' }),
];

async function install(page: Page, capabilities: string[]) {
  const rows = seed();
  const payouts: Record<string, unknown>[] = [
    { id: 'payout_1', received_funds_id: 'posfunds_2', branch_id: 'branch_main', status: 'reserved', amount: '50000.0', currency: 'VND', beneficiary_name: 'Chị Hoa', beneficiary_reference: null, reason: 'Chuyển dư', confirmed_at: null, resolved_at: null },
  ];
  const state = { lists: [] as Record<string, string>[], writes: [] as { path: string; body: Record<string, unknown>; key: string | null }[] };
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v3/admin', '');
    if (path === '/pos/context') return route.fulfill({ json: posContext(url, { capabilities }) });
    if (path === '/pos/received_funds') {
      state.lists.push(Object.fromEntries(url.searchParams.entries()));
      return route.fulfill({ json: { data: rows, meta: pageMeta(rows.length, 1, Number(url.searchParams.get('limit') || 25)) } });
    }
    const detail = /^\/pos\/received_funds\/([^/]+)$/.exec(path);
    if (detail) {
      const row = rows.find((item) => item.id === detail[1]);
      if (!row) return route.fulfill({ status: 404, json: { error: { code: 'record_not_found', message: 'Not found' } } });
      return route.fulfill({ json: { data: { ...row, payouts: row.id === 'posfunds_2' ? payouts : [], allocations: [{ id: 'alloc_1', order_id: 'P00009', workspace_id: 'ws_1', status: 'active', amount: row.allocated, currency: 'VND' }] } } });
    }
    const confirm = /^\/pos\/received_funds\/([^/]+)\/payouts\/([^/]+)\/confirm$/.exec(path);
    if (confirm) {
      state.writes.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'] ?? null });
      payouts[0] = { ...payouts[0], status: 'confirmed' };
      return route.fulfill({ json: { data: payouts[0] } });
    }
    if (path === '/pos/fund_accounts' && request.method() === 'GET') {
      return route.fulfill({
        json: {
          data: [
            { id: 'posfundacc_1', branch_id: 'branch_main', name: 'Tiền mặt', kind: 'cash', bank_name: null, account_number: null, currency: 'VND', opening_balance: '1000000.0', inflow: '500000.0', outflow: '120000.0', current_balance: '1380000.0', status: 'active', is_default: true, updated_at: null },
            { id: 'posfundacc_2', branch_id: 'branch_main', name: 'VIB **96', kind: 'bank', bank_name: 'VIB', account_number: '0389450596', currency: 'VND', opening_balance: '500000.0', inflow: '0.0', outflow: '0.0', current_balance: '500000.0', status: 'active', is_default: false, updated_at: null },
          ],
          meta: { count: 2, total_balance: '1880000.0', currency: 'VND' },
        },
      });
    }
    if (path === '/pos/fund_vouchers' && request.method() === 'GET') {
      return route.fulfill({
        json: {
          data: [
            { id: 'posvouch_1', code: 'PC00001', kind: 'expense', status: 'completed', branch_id: 'branch_main', fund_account_id: 'posfundacc_1', fund_account_name: 'Tiền mặt', fund_account_kind: 'cash', target_fund_account_id: null, target_fund_account_name: null, amount: '120000.0', currency: 'VND', category_code: 'electricity', category_label: null, tax_deductible: false, counterparty_name: 'EVN', customer_id: null, reference: null, note: 'Tiền điện', occurred_at: '2026-11-10T02:00:00Z', actor_name: 'admin@example.com', voided_at: null, void_reason: null, created_at: '2026-11-10T02:00:00Z' },
          ],
          meta: { ...pageMeta(1, 1, 25), summary: { total_income: '500000.0', total_expense: '120000.0', net_change: '380000.0', count: 1 } },
        },
      });
    }
    if (path === '/pos/fund_vouchers/quick_qr' && request.method() === 'POST') {
      return route.fulfill({
        json: { data: { available: false, reason: 'vietqr_not_configured' } },
      });
    }
    if (path.startsWith('/pos/')) return route.fulfill({ json: { data: [], meta: pageMeta(0) } });
    return route.fallback();
  });
  await installDashboardShell(page, { authenticated: true, read: false, write: false });
  return state;
}
const MENU = /^(Open actions|Mở menu thao tác)$/;

test('a resolver reads the ledger, filters what needs attention and confirms a payout', async ({ page }, testInfo) => {
  const state = await install(page, ['pos.payment.resolve', 'pos.payment.collect']);
  await page.goto('/store_1/funds');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sổ tiền đã nhận / nghĩa vụ');
  const table = page.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(4);
  expect(state.lists.at(-1)).toMatchObject({ branch_id: 'branch_main', page: '1', limit: '25' });
  await expect(table.getByRole('row').filter({ hasText: 'REF-posfunds_2' })).toContainText('Cần kiểm tra');
  await page.screenshot({ path: testInfo.outputPath('funds.png'), fullPage: true });

  await page.getByRole('tab', { name: 'Cần chú ý' }).click();
  await expect(page).toHaveURL(/\/store_1\/funds\/attention/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Khoản thu cần chú ý');
  await expect(table.getByRole('row')).toHaveCount(2);
  expect(state.lists.at(-1)).toMatchObject({ limit: '100' });

  await table.getByRole('row').filter({ hasText: 'REF-posfunds_2' }).getByRole('button', { name: MENU }).click();
  await page.getByRole('menuitem', { name: 'Chi tiết khoản tiền' }).click();
  await expect(page).toHaveURL(/fundsId=posfunds_2/);
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('P00009');
  await expect(sheet).toContainText('Chị Hoa');
  await sheet.getByRole('button', { name: MENU }).click();
  await page.getByRole('menuitem', { name: 'Xác nhận đã hoàn' }).click();
  await sheet.getByLabel('Mã giao dịch hoàn tiền').fill('FT-778');
  await sheet.getByRole('button', { name: 'Xác nhận đã hoàn' }).click();
  await expect(sheet.getByRole('status').filter({ hasText: 'Đã xác nhận khoản hoàn.' })).toBeVisible();
  const write = state.writes.at(-1);
  expect(write?.path).toBe('/pos/received_funds/posfunds_2/payouts/payout_1/confirm');
  expect(write?.body).toMatchObject({ evidence_kind: 'bank_manual', reference: 'FT-778' });
  expect(typeof write?.body.idempotency_key).toBe('string');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a collector reads the ledger without the attention view or payout actions', async ({ page }) => {
  await install(page, ['pos.payment.collect']);
  await page.goto('/store_1/funds?fundsId=posfunds_1');
  await expect(page.getByRole('tab', { name: 'Cần chú ý' })).toHaveCount(0);
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('REF-posfunds_1');
  await expect(sheet.getByRole('button', { name: 'Giữ tiền để hoàn' })).toHaveCount(0);
  await page.goto('/store_1/funds/attention');
  await expect(page.getByRole('alert')).toContainText('Không có quyền truy cập');
});

test('a resolver navigates Thu chi, Quỹ tiền, and Thu tiền nhanh tabs', async ({ page }) => {
  await install(page, ['pos.payment.resolve', 'pos.payment.collect']);
  await page.goto('/store_1/funds/vouchers');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sổ thu chi');
  await expect(page.getByText('PC00001')).toBeVisible();
  await expect(page.getByText('Không tính thuế')).toBeVisible();

  await page.getByRole('tab', { name: 'Quỹ tiền' }).click();
  await expect(page).toHaveURL(/\/store_1\/funds\/accounts/);
  await expect(page.getByText('VIB **96')).toBeVisible();

  await page.getByRole('tab', { name: 'Thu tiền nhanh' }).click();
  await expect(page).toHaveURL(/\/store_1\/funds\/quick-collect/);
  await page.getByRole('button', { name: 'Tạo mã VietQR' }).click();
  await expect(page.getByRole('status')).toContainText('Chi nhánh chưa bật VietQR');
});
