import { expect, type Page, type Route, test } from '@playwright/test';
import { teaMenu } from './support/menu-api';
import { addLine, addSheet, FULL_CASHIER, installRetailApi, login, newWorld } from './support/retail-api';

// Guests' orders from the table QR in the counter's tray: a badge counts what
// waits, staff accept one order and reject another with a reason, and close a
// call for staff. Prepaid VietQR orders stay out while `awaiting_payment`, show
// the "Đã thanh toán" badge once auto-accepted, and record their payment on the
// table's ticket. Presentation fixtures only: no real account privileges.

const MODULES = { 'fnb.menu': true, 'fnb.kitchen': true, 'fnb.qr_order': true };

type Guests = {
  orders: Record<string, unknown>[];
  requests: Record<string, unknown>[];
  calls: { action: string; body: Record<string, unknown> }[];
};

function guestOrder(
  id: string,
  table: string,
  name: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    branch_id: 'br_1',
    workspace_id: `ws_${id}`,
    resource_id: `res_${id}`,
    table_name: table,
    area_id: 'area_1',
    status: 'pending',
    automatic: false,
    prepaid: false,
    pay_method: null,
    items: [
      {
        variant_id: 'v_tea',
        name,
        size: null,
        quantity: 2,
        unit_price: '25000.0',
        amount: '50000.0',
        note: 'ít đá',
        modifiers: [{ option_id: 'opt_1', name: 'Trân châu', quantity: 1 }],
      },
    ],
    quoted_total: '50000.0',
    currency: 'VND',
    item_count: 2,
    reject_reason: null,
    decided_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

async function installGuestApi(page: Page, guests: Guests) {
  await page.route('**/api/v3/admin/pos/guest_**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/api\/v3\/admin/, '');
    const page1 = (rows: unknown[]) => ({
      data: rows,
      meta: { page: 1, pages: 1, count: rows.length },
    });
    if (path === '/pos/guest_orders') {
      const status = url.searchParams.get('status') ?? 'pending';
      const rows = guests.orders.filter((row) =>
        status === 'accepted' ? row.status === 'accepted' : row.status !== 'accepted',
      );
      return route.fulfill({ json: page1(rows) });
    }
    if (path === '/pos/guest_requests') return route.fulfill({ json: page1(guests.requests) });
    const order = /^\/pos\/guest_orders\/([^/]+)\/(accept|reject)$/.exec(path);
    if (order) {
      guests.calls.push({
        action: order[2],
        body: request.postDataJSON() as Record<string, unknown>,
      });
      guests.orders = guests.orders.filter((row) => row.id !== order[1]);
      return route.fulfill({
        json: { data: { id: order[1], status: order[2] === 'accept' ? 'accepted' : 'rejected' } },
      });
    }
    const done = /^\/pos\/guest_requests\/([^/]+)\/done$/.exec(path);
    if (done) {
      guests.calls.push({ action: 'done', body: request.postDataJSON() as Record<string, unknown> });
      guests.requests = [];
      return route.fulfill({ json: { data: { id: done[1], status: 'done' } } });
    }
    return route.fallback();
  });
}

test('accepts and rejects guest QR orders and closes a call for staff', async ({ page }) => {
  const world = newWorld({
    modules: MODULES,
    menu: teaMenu(),
    capabilities: [...FULL_CASHIER, 'pos.table.serve', 'pos.guest_order.decide'],
  });
  const guests: Guests = {
    orders: [
      guestOrder('posguestorder_1', 'Bàn 4', 'Trà đào', {
        workspace_id: null,
        pay_method: 'counter',
      }),
      guestOrder('posguestorder_2', 'Bàn 7', 'Bánh flan'),
    ],
    requests: [
      {
        id: 'posguestreq_1',
        branch_id: 'br_1',
        resource_id: 'res_9',
        table_name: 'Bàn 9',
        area_id: 'area_1',
        workspace_id: 'ws_9',
        kind: 'call_staff',
        status: 'open',
        handled_by_name: null,
        handled_at: null,
        created_at: new Date().toISOString(),
      },
    ],
    calls: [],
  };
  await installRetailApi(page, world);
  await installGuestApi(page, guests);
  await login(page);

  await expect(page.getByTestId('guest-tray-badge')).toContainText('3 đang chờ');
  await page.getByTestId('guest-tray-toggle').click();

  const first = page.getByTestId('guest-order-posguestorder_1');
  await expect(first).toContainText('Bàn 4');
  await expect(first).toContainText('Thanh toán tại quầy');
  await expect(first).toContainText('2 × Trà đào · Trân châu · ít đá');
  await page.getByTestId('guest-accept-posguestorder_1').click();
  await expect(first).toHaveCount(0);

  await page.getByTestId('guest-reject-posguestorder_2').click();
  const form = page.getByTestId('guest-reject-form');
  await expect(form.getByTestId('guest-reject-confirm')).toBeDisabled();
  await form.getByRole('button', { name: 'Món đã hết' }).click();
  await form.getByTestId('guest-reject-confirm').click();
  await expect(form).toHaveCount(0);
  await expect(page.getByTestId('guest-order-posguestorder_2')).toHaveCount(0);

  const call = page.getByTestId('guest-request-posguestreq_1');
  await expect(call).toContainText('Bàn 9 · Gọi phục vụ');
  await call.getByRole('button', { name: 'Đã xử lý' }).click();
  await expect(page.getByText('Không có đơn hay yêu cầu nào từ khách đang chờ.')).toBeVisible();

  expect(guests.calls.map((row) => row.action)).toEqual(['accept', 'reject', 'done']);
  expect(guests.calls[1].body).toMatchObject({ reason: 'Món đã hết' });
  for (const row of guests.calls) expect(row.body.idempotency_key).toEqual(expect.any(String));
});

test('hides awaiting_payment orders, badges auto-accepted prepaid orders, and shows VietQR payments on the table ticket', async ({
  page,
}) => {
  const world = newWorld({
    modules: { ...MODULES, resources: true, 'fnb.tables': true },
    profile: { key: 'nha_hang', version: 1, display: { surface: 'menu_grid' } },
    menu: teaMenu(),
    capabilities: [...FULL_CASHIER, 'pos.table.serve', 'pos.guest_order.decide'],
    vietqr: true,
  });

  // Table 4 has 70 000 from a prepaid guest VietQR order + 30 000 ordered unpaid (total 100 000).
  const partial = addSheet(world, 'ws_t4', {
    table: { id: 'posres_4', name: 'Bàn 4', label: null, guests: 2 },
  });
  addLine(world, partial, 'v_peach', 2);
  addLine(world, partial, 'v_flan', 2);
  partial.allocated = 70000;

  // Table 5 paid its entire 30 000 order via guest VietQR.
  const full = addSheet(world, 'ws_t5', {
    table: { id: 'posres_5', name: 'Bàn 5', label: null, guests: 2 },
  });
  addLine(world, full, 'v_flan', 2);
  full.allocated = 30000;

  const nowIso = new Date().toISOString();
  const guests: Guests = {
    orders: [
      guestOrder('posguestorder_wait', 'Bàn 6', 'Trà sữa', {
        workspace_id: null,
        status: 'awaiting_payment',
        prepaid: false,
        pay_method: 'vietqr',
      }),
      guestOrder('posguestorder_paid', 'Bàn 4', 'Trà đào', {
        workspace_id: 'ws_t4',
        status: 'accepted',
        automatic: true,
        prepaid: true,
        pay_method: 'vietqr',
        quoted_total: '70000.0',
        decided_at: nowIso,
        created_at: nowIso,
      }),
    ],
    requests: [],
    calls: [],
  };

  await installRetailApi(page, world);
  await page.route('**/api/v3/admin/pos/resource_board**', (route) =>
    route.fulfill({
      json: {
        data: {
          branch_id: 'br_1',
          server_now: new Date().toISOString(),
          areas: [],
          resources: [
            {
              id: 'posres_4',
              name: 'Bàn 4',
              state: 'occupied',
              guest_count: 2,
              seated_minutes: 5,
              subtotal: '100000.0',
              currency: 'VND',
              orders: [{ id: 'ws_t4', total: '100000.0', guest_count: 2 }],
            },
            {
              id: 'posres_5',
              name: 'Bàn 5',
              state: 'occupied',
              guest_count: 2,
              seated_minutes: 3,
              subtotal: '30000.0',
              currency: 'VND',
              orders: [{ id: 'ws_t5', total: '30000.0', guest_count: 2 }],
            },
          ],
        },
      },
    }),
  );
  await installGuestApi(page, guests);
  await login(page);

  // `awaiting_payment` is excluded from the waiting badge; the prepaid order shows its notice badge.
  await expect(page.getByTestId('guest-tray-badge')).toHaveCount(0);
  await expect(page.getByTestId('guest-tray-prepaid-badge')).toContainText('1 đã thanh toán');
  await page.getByTestId('guest-tray-toggle').click();

  await expect(page.getByTestId('guest-order-posguestorder_wait')).toHaveCount(0);
  const section = page.getByTestId('guest-prepaid-section');
  await expect(section).toContainText('Đơn đã thanh toán (vào bếp)');
  const paidRow = page.getByTestId('guest-order-posguestorder_paid');
  await expect(paidRow).toContainText('Bàn 4');
  await expect(page.getByTestId('guest-prepaid-badge-posguestorder_paid')).toHaveText(
    'Đã thanh toán',
  );
  await page.getByTestId('guest-dismiss-posguestorder_paid').click();
  await expect(paidRow).toHaveCount(0);
  await expect(page.getByText('Không có đơn hay yêu cầu nào từ khách đang chờ.')).toBeVisible();

  // Opening Table 4 shows the guest's 70 000 payment and 30 000 remaining on the ticket.
  await page.locator('.board-tile', { hasText: 'Bàn 4' }).click();
  const ticket = page.getByRole('complementary', { name: 'Phiếu bàn' });
  await expect(ticket.locator('.ticket-summary')).toContainText('Đã trả: 70.000 ₫');
  const payButton = ticket.locator('.ticket-pay');
  await expect(payButton).toContainText('Thanh toán · còn lại');
  // What is left shows in large type above the button.
  await expect(ticket.locator('.ticket-totals-due')).toContainText('30.000 ₫');

  // Opening Table 5 shows the full 30 000 paid and "Đã thanh toán đủ".
  await ticket.getByRole('button', { name: 'Về bảng bàn' }).click();
  await page.locator('.board-tile', { hasText: 'Bàn 5' }).click();
  await expect(ticket.locator('.ticket-summary')).toContainText('Đã trả: 30.000 ₫');
  await expect(ticket.locator('.ticket-pay')).toContainText('Đã thanh toán đủ');
});
