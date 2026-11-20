import { expect, type Page, test } from '@playwright/test';

// A guest's phone at a table, against a mocked guest API: the sticker's code
// is exchanged for a session and leaves the address, a dish is picked with
// its options, the order waits for staff and then shows as sent to the
// kitchen, and staff are called. Presentation fixtures only.

const CODE = 'Zk3_9qLmT0aBcDeFgHiJkA';
const TOKEN = 'guest-session-token-0123456789';

type Api = {
  status: 'open' | 'table_closed';
  paused: boolean;
  menuOverride?: Record<string, unknown>;
  orders: Record<string, unknown>[];
  requests: Record<string, unknown>[];
  paid: string;
  due: string;
  retryAfterSeconds: number;
  pauseOnSubmit: boolean;
  billQr: Record<string, unknown> | null;
  canceledIds: string[];
  submitted: { body: Record<string, unknown>; key: string | null }[];
  authorizations: (string | null)[];
};

const session = (api: Api) => ({
  id: 'posguest_1',
  status: api.status,
  expires_at: '2026-11-12T16:00:00Z',
  table: { name: 'Bàn 4', kind: 'table' },
  branch: { name: 'Quận 1', store_name: 'Quán Trà' },
  currency: 'VND',
  approval: 'staff_approval',
  timed: false,
  paused: api.paused,
});

const menu = {
  currency: 'VND',
  etag: 'e1',
  categories: [
    { id: 'cat_tea', name: 'Trà', position: 1, color: '#0b6e4f' },
    { id: 'cat_cake', name: 'Bánh', position: 2, color: '#c2410c' },
  ],
  items: [
    {
      id: 'prod_tea',
      name: 'Trà đào',
      kind: 'single',
      category_ids: ['cat_tea'],
      position: 1,
      image_url: null,
      sold_out: false,
      modifier_group_ids: ['grp_sugar', 'grp_top'],
      components: [],
      variants: [
        { id: 'v_tea_m', name: 'M', price: '30000.0', price_label: null },
        { id: 'v_tea_l', name: 'L', price: '35000.0', price_label: null },
      ],
    },
    {
      id: 'prod_flan',
      name: 'Bánh flan',
      kind: 'single',
      category_ids: ['cat_cake'],
      position: 2,
      image_url: null,
      sold_out: true,
      modifier_group_ids: [],
      components: [],
      variants: [{ id: 'v_flan', name: null, price: '15000.0', price_label: null }],
    },
  ],
  modifier_groups: [
    {
      id: 'grp_sugar',
      name: 'Đường',
      min_select: 1,
      max_select: 1,
      allow_quantity: false,
      required: true,
      options: [
        { id: 'opt_full', name: '100%', price_delta: '0.0', default_selected: false },
        { id: 'opt_half', name: '50%', price_delta: '0.0', default_selected: false },
      ],
    },
    {
      id: 'grp_top',
      name: 'Topping',
      min_select: 0,
      max_select: 2,
      allow_quantity: false,
      required: false,
      options: [
        { id: 'opt_pearl', name: 'Trân châu', price_delta: '5000.0', default_selected: false },
      ],
    },
  ],
};

async function install(page: Page, api: Api) {
  await page.route('**/api/v3/pos_guest/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^.*\/api\/v3\/pos_guest/, '');
    const method = request.method();
    if (!(path === '/session' && method === 'POST'))
      api.authorizations.push(request.headers().authorization ?? null);
    if (path === '/session' && method === 'POST') {
      const body = request.postDataJSON() as { table_code?: string };
      if (body.table_code !== CODE)
        return route.fulfill({
          status: 404,
          json: { error: { code: 'table_code_invalid', message: 'x' } },
        });
      return route.fulfill({ status: 201, json: { data: { ...session(api), token: TOKEN } } });
    }
    if (request.headers().authorization !== `Guest ${TOKEN}`)
      return route.fulfill({
        status: 401,
        json: { error: { code: 'session_invalid', message: 'x' } },
      });
    if (path === '/session') return route.fulfill({ json: { data: session(api) } });
    if (path === '/menu') {
      if (api.paused)
        return route.fulfill({
          status: 409,
          json: { error: { code: 'emenu_paused', message: 'Ordering is paused.' } },
        });
      return route.fulfill({ json: { data: { ...menu, ...api.menuOverride } } });
    }
    if (path === '/order') {
      const hasAccepted = api.orders.some((order) => order.status === 'accepted');
      return route.fulfill({
        json: {
          data: {
            lines: hasAccepted
              ? [
                  {
                    name: 'Trà đào',
                    size: 'L',
                    quantity: '2.0',
                    options: ['50%', 'Trân châu'],
                    amount: '80000.0',
                    kitchen: 'sent',
                  },
                ]
              : [],
            subtotal: hasAccepted ? '80000.0' : null,
            paid: api.paid,
            due: api.due,
            has_timed: false,
            orders: api.orders,
            requests: api.requests,
          },
        },
      });
    }
    const cancelMatch = path.match(/^\/guest_orders\/([^/]+)\/cancel$/);
    if (cancelMatch && method === 'POST') {
      const orderId = cancelMatch[1];
      api.canceledIds.push(orderId);
      let updated: Record<string, unknown> | null = null;
      api.orders = api.orders.map((row) => {
        if (row.id !== orderId) return row;
        updated = { ...row, status: 'canceled', payment: null };
        return updated;
      });
      if (!updated)
        return route.fulfill({
          status: 404,
          json: { error: { code: 'not_found', message: 'x' } },
        });
      return route.fulfill({ json: { data: updated } });
    }
    if (path === '/guest_orders' && method === 'POST') {
      if (api.paused || api.pauseOnSubmit) {
        api.paused = true;
        return route.fulfill({
          status: 409,
          json: { error: { code: 'emenu_paused', message: 'Ordering is paused.' } },
        });
      }
      if (api.retryAfterSeconds > 0) {
        const seconds = api.retryAfterSeconds;
        api.retryAfterSeconds = 0;
        return route.fulfill({
          status: 429,
          json: {
            error: {
              code: 'order_too_soon',
              message: 'Too soon',
              details: { retry_after_seconds: seconds },
            },
          },
        });
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      api.submitted.push({ body, key: request.headers()['idempotency-key'] ?? null });
      const nextIndex = api.orders.length + 1;
      const isVietqrPrepay = body.payment === 'vietqr';
      const order: Record<string, unknown> = {
        id: `posguestorder_${nextIndex}`,
        status: isVietqrPrepay ? 'awaiting_payment' : 'pending',
        reject_reason: null,
        items: [
          {
            name: 'Trà đào',
            size: 'L',
            quantity: 2,
            amount: '80000.0',
            options: ['50%', 'Trân châu'],
          },
        ],
        quoted_total: '80000.0',
        currency: 'VND',
        created_at: '2026-11-12T12:00:00Z',
        payment: isVietqrPrepay
          ? {
              method: 'vietqr',
              expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
              qr: {
                payload: `00020101021238570010A000000727012700069704360110012345678953037045405800005802VN62100806PVGO${nextIndex}6304ABCD`,
                amount: '80000.0',
                currency: 'VND',
                transfer_content: `PV GO${nextIndex}`,
                bank_name: 'Vietcombank',
                account_number: '0123456789',
                account_name: 'QUAN TRA',
              },
            }
          : null,
      };
      api.orders = [...api.orders, order];
      return route.fulfill({ status: 201, json: { data: order } });
    }
    if (path === '/bill_payment' && method === 'POST') {
      if (api.paused)
        return route.fulfill({
          status: 409,
          json: { error: { code: 'emenu_paused', message: 'Ordering is paused.' } },
        });
      if (!api.billQr)
        return route.fulfill({
          status: 409,
          json: { error: { code: 'nothing_to_pay', message: 'Nothing to pay.' } },
        });
      return route.fulfill({ json: { data: api.billQr } });
    }
    if (path === '/requests') {
      const body = request.postDataJSON() as { kind: string };
      const row = {
        id: 'posguestreq_1',
        kind: body.kind,
        status: 'open',
        created_at: '2026-11-12T12:01:00Z',
      };
      api.requests = [row];
      return route.fulfill({ status: 201, json: { data: row } });
    }
    return route.fulfill({ status: 404, json: { error: { code: 'not_found', message: 'x' } } });
  });
}

const newApi = (status: Api['status'] = 'open'): Api => ({
  status,
  paused: false,
  orders: [],
  requests: [],
  paid: '0.0',
  due: '0.0',
  retryAfterSeconds: 0,
  pauseOnSubmit: false,
  billQr: null,
  canceledIds: [],
  submitted: [],
  authorizations: [],
});

test('orders a dish with options, waits for staff, then sees it sent to the kitchen', async ({
  page,
}) => {
  const api = newApi();
  await install(page, api);
  await page.goto(`/table/t/${CODE}`);

  await expect(page.getByRole('heading', { name: 'Bàn 4 · Quận 1' })).toBeVisible();
  // The code leaves the address once exchanged.
  await expect(page).toHaveURL(/\/table\/$/);
  await expect(page.getByTestId('menu-item-prod_flan')).toBeDisabled();
  await expect(page.getByTestId('menu-item-prod_flan')).toContainText('Hết món');

  await page.getByTestId('menu-item-prod_tea').click();
  await page.getByRole('radio', { name: /^L / }).check();
  // Sugar is required: nothing can be added until it is chosen.
  await expect(page.getByTestId('add-to-cart')).toBeDisabled();
  await page.getByLabel('50%').check();
  await page.getByLabel('Trân châu').check();
  await page.getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.getByLabel('Ghi chú cho bếp').fill('ít đá');
  await expect(page.getByTestId('add-to-cart')).toContainText('80.000');
  await page.getByTestId('add-to-cart').click();

  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId('tab-cart')).toContainText('(2)');
  await expect(page.getByTestId('cart-line')).toContainText('Trà đào');
  await expect(page.getByTestId('cart-total')).toContainText('80.000');
  await page.getByTestId('send-order').click();

  const order = page.getByTestId('order-posguestorder_1');
  await expect(order).toContainText('Đang chờ xác nhận');
  expect(api.submitted).toHaveLength(1);
  expect(api.submitted[0].key).toEqual(expect.any(String));
  expect(api.submitted[0].body).toEqual({
    items: [
      {
        variant_id: 'v_tea_l',
        quantity: 2,
        modifiers: [
          { option_id: 'opt_half', quantity: 1 },
          { option_id: 'opt_pearl', quantity: 1 },
        ],
        note: 'ít đá',
      },
    ],
  });

  // Staff accept: the next poll shows it in the kitchen and on the table.
  api.orders = [{ ...api.orders[0], status: 'accepted' }];
  await expect(order).toContainText('Đã gửi bếp', { timeout: 8_000 });
  await expect(page.getByTestId('table-lines')).toContainText('2 × Trà đào (L)');

  await page.getByTestId('call-staff').click();
  await expect(page.getByText('Đã gọi phục vụ, nhân viên sẽ đến ngay.')).toBeVisible();
  await expect(page.getByTestId('call-staff')).toBeDisabled();

  // Every call carried the session token in the header, never in the URL.
  expect(api.authorizations.every((value) => value === `Guest ${TOKEN}`)).toBe(true);
  expect(page.url()).not.toContain(TOKEN);
});

test('shows a rejection with its reason', async ({ page }) => {
  const api = newApi();
  api.orders = [
    {
      id: 'posguestorder_9',
      status: 'rejected',
      reject_reason: 'Món đã hết',
      items: [{ name: 'Bánh flan', size: null, quantity: 1, amount: '15000.0', options: [] }],
      quoted_total: '15000.0',
      currency: 'VND',
      created_at: '2026-11-12T12:00:00Z',
    },
  ];
  await install(page, api);
  await page.goto(`/table/t/${CODE}`);
  await page.getByTestId('tab-table').click();
  await expect(page.getByTestId('order-posguestorder_9')).toContainText('Bị từ chối: Món đã hết');
});

test('reads the menu only at a closed table and orders once staff open it', async ({ page }) => {
  const api = newApi('table_closed');
  await install(page, api);
  await page.goto(`/table/t/${CODE}`);

  await expect(page.getByTestId('table-closed')).toContainText('Bàn chưa mở');
  await page.getByTestId('menu-item-prod_tea').click();
  await page.getByLabel('100%').check();
  await page.getByTestId('add-to-cart').click();
  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId('send-order')).toBeDisabled();
  await page.getByTestId('tab-table').click();
  await expect(page.getByTestId('request-bill')).toHaveCount(0);
  await expect(page.getByTestId('call-staff')).toBeEnabled();

  api.status = 'open';
  await page.getByRole('button', { name: 'Bàn đã mở? Thử lại' }).click();
  await expect(page.getByTestId('table-closed')).toHaveCount(0);
  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId('send-order')).toBeEnabled();
});

test('refuses a code that no longer works and asks for a scan without one', async ({ page }) => {
  const api = newApi();
  await install(page, api);
  await page.goto('/table/t/AAAAAAAAAAAAAAAAAAAAAA');
  await expect(page.getByTestId('phase')).toHaveText(
    'Mã QR này không còn dùng được. Nhờ nhân viên giúp nhé.',
  );

  await page.goto('/table/');
  await expect(page.getByTestId('phase')).toHaveText(
    'Hãy quét mã QR dán trên bàn để xem thực đơn và gọi món.',
  );
});

test('blocks menu viewing while paused, loads theme and menu when unpaused, and handles emenu_paused on submit', async ({
  page,
}) => {
  const api = newApi();
  api.paused = true;
  api.menuOverride = {
    theme: {
      brand_color: '#c2410c',
      text_color: '#111827',
      button_color: '#facc15',
      logo_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"/>',
      store_name: 'Trà Sữa Parkviet',
    },
    sections: {
      banner: [{ id: 'prm_1', name: 'Mua 2 tặng 1 khung giờ vàng' }],
      best_sellers: ['prod_tea'],
      new_items: [],
    },
  };
  await install(page, api);
  await page.goto(`/table/t/${CODE}`);

  await expect(page.getByTestId('paused')).toHaveText('Quán đang tạm dừng nhận đơn.');
  await expect(page.getByTestId('menu-item-prod_tea')).toHaveCount(0);
  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId('paused')).toBeVisible();
  await expect(page.getByTestId('send-order')).toHaveCount(0);

  // Staff resume ordering: next poll loads the menu, theme, logo, banners and rails.
  await page.getByTestId('tab-menu').click();
  api.paused = false;
  await expect(page.getByTestId('paused')).toHaveCount(0, { timeout: 8_000 });
  await expect(page.getByTestId('store-logo')).toBeVisible();
  await expect(page.getByTestId('store-name')).toHaveText('Trà Sữa Parkviet');
  await expect(page.getByTestId('banners')).toContainText('Mua 2 tặng 1 khung giờ vàng');
  await expect(page.getByTestId('best-sellers')).toContainText('Trà đào');
  await expect(page.getByRole('button', { name: 'Tất cả' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Staff pause right before guest submits: 409 emenu_paused switches back to paused screen.
  await page.getByTestId('menu-item-prod_tea').click();
  await page.getByLabel('100%').check();
  await page.getByTestId('add-to-cart').click();
  await page.getByTestId('tab-cart').click();
  api.pauseOnSubmit = true;
  await page.getByTestId('send-order').click();
  await expect(page.getByTestId('paused')).toHaveText('Quán đang tạm dừng nhận đơn.');
  await expect(page.getByTestId('send-order')).toHaveCount(0);
});

test('prepay VietQR shows QR and transfer details, cancels back to cart, and polls until paid', async ({
  page,
}) => {
  const api = newApi();
  api.menuOverride = {
    payment: {
      timing: 'pay_before',
      methods: ['vietqr', 'counter'],
      vietqr_available: true,
    },
  };
  await install(page, api);
  await page.goto(`/table/t/${CODE}`);

  await page.getByTestId('menu-item-prod_tea').click();
  await page.getByRole('radio', { name: /^L / }).check();
  await page.getByLabel('50%').check();
  await page.getByLabel('Trân châu').check();
  await page.getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.getByTestId('add-to-cart').click();

  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId('send-order')).toBeDisabled();
  await page.getByLabel('VietQR').check();
  await expect(page.getByTestId('send-order')).toBeEnabled();
  await page.getByTestId('send-order').click();

  // Order 1 is awaiting_payment with VietQR and cancel button.
  const firstQr = page.getByTestId('order-qr-posguestorder_1');
  await expect(firstQr).toBeVisible();
  await expect(firstQr.locator('svg.qr')).toBeVisible();
  await expect(firstQr).toContainText('80.000');
  await expect(firstQr).toContainText('PV GO1');
  await expect(firstQr).toContainText('Vietcombank · 0123456789 · QUAN TRA');

  // Canceling unpaid prepay calls POST /guest_orders/:id/cancel and restores items to cart.
  await page.getByTestId('cancel-order-posguestorder_1').click();
  expect(api.canceledIds).toEqual(['posguestorder_1']);
  await expect(page.getByTestId('order-posguestorder_1')).toContainText('Đã hủy');
  await expect(firstQr).toHaveCount(0);
  await expect(page.getByTestId('tab-cart')).toContainText('(2)');

  // Resubmit with VietQR -> bank transfer arrives -> order auto-accepts on poll.
  await page.getByTestId('tab-cart').click();
  await page.getByTestId('send-order').click();
  const secondQr = page.getByTestId('order-qr-posguestorder_2');
  await expect(secondQr).toContainText('PV GO2');

  api.orders = api.orders.map((row) =>
    row.id === 'posguestorder_2' ? { ...row, status: 'accepted' } : row,
  );
  await expect(page.getByTestId('order-posguestorder_2')).toContainText('Đã gửi bếp', {
    timeout: 8_000,
  });
  await expect(secondQr).toHaveCount(0);
  await expect(page.getByTestId('table-lines')).toContainText('2 × Trà đào (L)');
});

test('counts down order_too_soon on Send button and pays the open bill via VietQR', async ({
  page,
}) => {
  const api = newApi();
  api.retryAfterSeconds = 2;
  api.menuOverride = {
    payment: {
      timing: 'pay_after',
      methods: ['vietqr', 'counter'],
      vietqr_available: true,
    },
  };
  await install(page, api);
  await page.goto(`/table/t/${CODE}`);

  await page.getByTestId('menu-item-prod_tea').click();
  await page.getByRole('radio', { name: /^L / }).check();
  await page.getByLabel('50%').check();
  await page.getByLabel('Trân châu').check();
  await page.getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.getByTestId('add-to-cart').click();

  await page.getByTestId('tab-cart').click();
  await page.getByTestId('send-order').click();

  // 429 order_too_soon shows countdown on both banner and button, never uninterpolated {{seconds}}.
  await expect(page.getByTestId('order-wait')).toContainText(/Đợi \d+ giây/);
  await expect(page.locator('body')).not.toContainText('{{seconds}}');
  await expect(page.getByTestId('send-order')).toBeDisabled();
  await expect(page.getByTestId('send-order')).toHaveText(/Gửi đơn \(\d+s\)/);

  // Countdown finishes -> button re-enables and order goes through.
  await expect(page.getByTestId('send-order')).toBeEnabled({ timeout: 5_000 });
  await expect(page.getByTestId('send-order')).toHaveText('Gửi đơn');
  await page.getByTestId('send-order').click();

  // Staff accept and open bill owes 80.000 VND.
  api.orders = [{ ...api.orders[0], status: 'accepted' }];
  api.due = '80000.0';
  api.billQr = {
    payload:
      '00020101021238570010A000000727012700069704360110012345678953037045405800005802VN62100806PVBAN46304ABCD',
    amount: '80000.0',
    due: '80000.0',
    currency: 'VND',
    transfer_content: 'PV BAN4',
    bank_name: 'Vietcombank',
    account_number: '0123456789',
    account_name: 'QUAN TRA',
  };

  await expect(page.getByTestId('amount-due')).toContainText('80.000', { timeout: 8_000 });
  await page.getByTestId('pay-bill').click();
  await expect(page.getByTestId('pay-choices')).toBeVisible();
  await page.getByTestId('pay-vietqr').click();

  const billQr = page.getByTestId('bill-qr');
  await expect(billQr.locator('svg.qr')).toBeVisible();
  await expect(billQr).toContainText('80.000');
  await expect(billQr).toContainText('PV BAN4');
  await expect(billQr).toContainText('Vietcombank · 0123456789 · QUAN TRA');

  // Webhook settles the bill: next poll clears the QR and announces payment.
  api.due = '0.0';
  api.paid = '80000.0';
  await expect(billQr).toHaveCount(0, { timeout: 8_000 });
  await expect(page.getByTestId('amount-due')).toHaveCount(0);
  await expect(page.getByTestId('amount-paid')).toContainText('80.000');
  await expect(page.getByText('Đã thanh toán', { exact: true })).toBeVisible();
});

test('shows the counter menu by Spree category: a product in two categories under both, one without a category under All only', async ({
  page,
}) => {
  const api = newApi();
  const row = (id: string, name: string, categoryIds: string[], position: number) => ({
    id,
    name,
    kind: 'single',
    category_ids: categoryIds,
    position,
    image_url: null,
    sold_out: false,
    modifier_group_ids: [],
    components: [],
    variants: [{ id: `v_${id}`, name: null, price: '20000.0', price_label: null }],
  });
  api.menuOverride = {
    categories: [
      { id: 'ctg_tea', name: 'Trà', position: 0, color: null, image_url: null },
      { id: 'ctg_cake', name: 'Bánh', position: 1, color: null, image_url: null },
    ],
    items: [
      row('prod_peach', 'Trà đào', ['ctg_tea'], 0),
      row('prod_combo', 'Trà và bánh', ['ctg_tea', 'ctg_cake'], 1),
      row('prod_flan', 'Bánh flan', ['ctg_cake'], 2),
      row('prod_soda', 'Soda', [], 3),
    ],
  };
  await install(page, api);
  await page.goto(`/table/t/${CODE}`);

  const shown = page.getByTestId(/^menu-item-/);
  await expect(page.getByRole('button', { name: 'Tất cả' })).toHaveAttribute('aria-pressed', 'true');
  await expect(shown).toHaveCount(4);
  await page.getByRole('button', { name: 'Trà', exact: true }).click();
  await expect(shown).toHaveText([/Trà đào/, /Trà và bánh/]);
  await page.getByRole('button', { name: 'Bánh', exact: true }).click();
  await expect(shown).toHaveText([/Trà và bánh/, /Bánh flan/]);
  await page.getByRole('button', { name: 'Tất cả' }).click();
  await expect(page.getByTestId('menu-item-prod_soda')).toBeVisible();
});
