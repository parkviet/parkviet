import { expect, type Locator, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';
import { pageMeta, posContext } from './support/pos-context';

function days(from: string, to: string) {
  const list: string[] = [];
  for (const day = new Date(`${from}T00:00:00Z`); day <= new Date(`${to}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1))
    list.push(day.toISOString().slice(0, 10));
  return list;
}
const totals = (orders: number, sales: number, returns: number) => ({
  orders, sales_total: `${sales}.0`, returns: returns > 0 ? 1 : 0, returns_total: `${returns}.0`,
  net_sales: `${sales - returns}.0`, offline_orders: 1, offline_total: '50000.0', customers: orders - 1,
});
const day = (date: string, index: number) => ({
  date, orders: 2 + index, customers: 1 + index, sales_total: `${(2 + index) * 100000}.0`, returns_total: '0.0',
  net_sales: `${(2 + index) * 100000}.0`,
});

// The branch overview over the asked days, the previous period when compared.
function overview(params: Record<string, string>) {
  const current = days(params.from, params.to);
  const compare = params.compare === '1';
  const previousTo = new Date(`${params.from}T00:00:00Z`);
  previousTo.setUTCDate(previousTo.getUTCDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - (current.length - 1));
  const previous = days(previousFrom.toISOString().slice(0, 10), previousTo.toISOString().slice(0, 10));
  return {
    branch_id: params.branch_id, timezone: 'Asia/Ho_Chi_Minh', scope: 'branch', from: params.from, to: params.to,
    previous_from: compare ? previous[0] : null, previous_to: compare ? previous.at(-1) : null,
    totals: totals(12, 1500000, 100000), previous_totals: compare ? totals(10, 1000000, 200000) : null,
    by_day: current.map(day), previous_by_day: compare ? previous.map((date) => day(date, 0)) : null,
    by_hour: [{ hour: 9, orders: 5, sales_total: '600000.0' }, { hour: 12, orders: 7, sales_total: '900000.0' }],
    by_source: [
      { order_source: 'counter', orders: 10, sales_total: '1200000.0', owed: '0.0' },
      { order_source: 'zalo', orders: 2, sales_total: '300000.0', owed: '0.0' },
    ],
    top_items: {
      by_quantity: [
        { variant_id: 'variant_1', name: 'Cà phê sữa đá', sku: 'CF01', base_unit: 'item', quantity: 30, revenue: '900000.0' },
        { variant_id: 'variant_2', name: 'Trà đào', sku: 'TD01', base_unit: 'item', quantity: 12, revenue: '480000.0' },
      ],
      by_revenue: [
        { variant_id: 'variant_1', name: 'Cà phê sữa đá', sku: 'CF01', base_unit: 'item', quantity: 30, revenue: '900000.0' },
      ],
    },
    status_counts: { all: 12, debt: 2, returned: 1, refund_pending: 0 },
    stock_alerts: { out_of_stock: 1, low_stock: 3, expiring_soon: 0, near_expiry_days: 30 },
  };
}

type Layout = Record<string, unknown>[];

async function install(
  page: Page,
  capabilities: string[],
  features: Record<string, boolean> = { delivery: true },
  // The reader's layout on the server; null follows the default.
  server: { layout: Layout | null } = { layout: null },
) {
  const requests: { method: string; path: string; params: Record<string, string>; body?: unknown }[] = [];
  await page.route('**/api/v3/admin/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v3/admin', '');
    const params = Object.fromEntries(url.searchParams.entries());
    const method = route.request().method();
    if (path.startsWith('/pos/')) requests.push({ method, path, params, body: route.request().postDataJSON() ?? undefined });
    if (path === '/pos/context') return route.fulfill({ json: posContext(url, { capabilities, features }) });
    if (path === '/pos/dashboard_layout') {
      if (method === 'PUT') server.layout = (route.request().postDataJSON() as { layout: Layout }).layout;
      if (method === 'DELETE') {
        server.layout = null;
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({
        json: { data: server.layout && { layout: server.layout, version: 1, updated_at: '2026-11-16T03:00:00.000Z' } },
      });
    }
    if (path === '/pos/received_funds')
      return route.fulfill({ json: { data: [
        { id: 'funds_1', status: 'attention', available: '0.0' },
        { id: 'funds_2', status: 'allocated', available: '50000.0' },
        { id: 'funds_3', status: 'allocated', available: '0.0' },
      ], meta: pageMeta(3, 1, 100) } });
    if (path === '/pos/credit_requests')
      return route.fulfill({ json: { data: [{ id: 'cr_1', status: 'pending' }, { id: 'cr_2', status: 'approved' }], meta: pageMeta(2, 1, 100) } });
    if (path === '/pos/cash_movement_requests')
      return route.fulfill({ json: { data: [{ id: 'cm_1', requester_id: 'staff_admin' }, { id: 'cm_2', requester_id: 'staff_lan' }, { id: 'cm_3', requester_id: 'staff_minh' }], meta: pageMeta(3, 1, 100) } });
    if (path === '/pos/shift_closures/open')
      return route.fulfill({ json: { data: [{ id: 'shift_1' }, { id: 'shift_2' }], meta: { count: 2 } } });
    if (path === '/pos/deliveries') return route.fulfill({ json: { data: [], meta: pageMeta(4, 1, 1) } });
    if (path === '/pos/orders') return route.fulfill({ json: { data: [], meta: pageMeta(1, 1, 1) } });
    if (path === '/pos/overview') return route.fulfill({ json: { data: overview(params) } });
    if (path.startsWith('/pos/')) return route.fulfill({ json: { data: [], meta: pageMeta(0) } });
    return route.fallback();
  });
  await installDashboardShell(page, { authenticated: true, read: false, write: false });
  return requests;
}
const card = (page: Page, name: string) => page.getByRole('list', { name: 'Tổng quan' }).getByLabel(name, { exact: true });

test('a branch manager sees every attention item with its count and links', async ({ page }, testInfo) => {
  const requests = await install(page, ['pos.payment.resolve', 'pos.approval.grant', 'pos.credit.manage', 'pos.topology.recover', 'pos.shift.open']);
  await page.goto('/store_1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tổng quan');
  await expect(card(page, 'Khoản thu cần chú ý').getByTestId('attention-count')).toHaveText('2');
  await expect(card(page, 'Duyệt ghi nợ').getByTestId('attention-count')).toHaveText('1');
  await expect(card(page, 'Thu/chi két chờ xác nhận').getByTestId('attention-count')).toHaveText('2');
  await expect(card(page, 'Ca đang mở').getByTestId('attention-count')).toHaveText('2');
  await expect(card(page, 'Đơn chờ giao').getByTestId('attention-count')).toHaveText('4');
  await expect(card(page, 'Hoàn tiền chưa xong').getByTestId('attention-count')).toHaveText('1');
  await expect(card(page, 'Khoản thu cần chú ý').getByRole('link', { name: 'Xem' })).toHaveAttribute('href', '/store_1/funds/attention');
  await expect(card(page, 'Thu/chi két chờ xác nhận').getByRole('link', { name: 'Xem' })).toHaveAttribute('href', '/store_1/shifts');
  await expect(card(page, 'Ca đang mở').getByRole('link', { name: 'Xem' })).toHaveAttribute('href', '/store_1/shifts');
  expect(requests.find((r) => r.path === '/pos/cash_movement_requests')?.params).toMatchObject({ branch_id: 'branch_main', status: 'requested' });
  expect(requests.find((r) => r.path === '/pos/deliveries')?.params).toMatchObject({ branch_id: 'branch_main', status: 'pending' });
  expect(requests.find((r) => r.path === '/pos/orders')?.params).toMatchObject({ status: 'refund_pending' });
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (testInfo.project.name === 'desktop') {
    const sidebar = page.locator('[data-sidebar="sidebar"]').first();
    const counter = sidebar.getByRole('link', { name: 'POS' });
    const home = sidebar.getByRole('link', { name: 'Tổng quan', exact: true });
    await expect(counter).toBeVisible();
    await expect(counter).toHaveAttribute('href', 'http://localhost:5175/?store=store_1&branch=branch_main');
    await expect(counter).toHaveAttribute('target', '_blank');
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute('href', '/store_1');
    expect((await counter.boundingBox())!.y).toBeLessThan((await home.boundingBox())!.y);
    await expect(sidebar.getByRole('link', { name: 'Bán hàng' })).toHaveAttribute('href', '/store_1/orders');
    await expect(sidebar.getByRole('link', { name: 'Tiền', exact: true })).toHaveAttribute('href', '/store_1/funds');
    await expect(sidebar.getByRole('link', { name: 'Thiết lập' })).toHaveAttribute('href', '/store_1/devices');
  }
  await card(page, 'Đơn chờ giao').getByRole('link', { name: 'Xem' }).click();
  await expect(page).toHaveURL(/\/store_1\/deliveries/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Đơn cần giao');
});

test('items follow the reader capabilities at the branch', async ({ page }) => {
  const requests = await install(page, ['pos.report.read']);
  await page.goto('/store_1');
  const list = page.getByRole('list', { name: 'Tổng quan' });
  await expect(card(page, 'Hoàn tiền chưa xong').getByTestId('attention-count')).toHaveText('1');
  // Report readers also see the sales headline figures, the trend and the best sellers.
  await expect(list.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) })).toHaveCount(7);
  await card(page, 'Hoàn tiền chưa xong').getByRole('link', { name: 'Xem' }).click();
  await expect(page).toHaveURL(/\/store_1\/orders\?status=refund_pending/);
  expect(requests.some((r) => ['/pos/received_funds', '/pos/credit_requests', '/pos/cash_movement_requests', '/pos/shift_closures/open', '/pos/deliveries'].includes(r.path))).toBe(false);
});

test('a store user without branch membership has nothing to handle', async ({ page }) => {
  await install(page, []);
  await page.goto('/store_1');
  await expect(page.getByText('Bạn không có việc nào cần xử lý ở chi nhánh này.')).toBeVisible();
});

test('sales widgets read one overview of the chosen period and open its reports', async ({ page }, testInfo) => {
  const requests = await install(page, ['pos.report.read']);
  await page.goto('/store_1?from=2026-11-10&to=2026-11-16');
  const sales = card(page, 'Tổng tiền đơn hàng');
  await expect(sales.getByTestId('kpi-value')).toHaveText('1.500.000 ₫');
  await expect(sales.getByText('+50%')).toBeVisible();
  // Fewer returns than before is good news.
  await expect(card(page, 'Trả hàng').getByText('-50%')).toHaveClass(/text-success/);
  await expect(card(page, 'Top 5 sản phẩm').getByText('Cà phê sữa đá')).toBeVisible();
  const asked = requests.filter((r) => r.path === '/pos/overview');
  expect(asked.length).toBeGreaterThan(0);
  expect(new Set(asked.map((r) => JSON.stringify(r.params))).size).toBe(1);
  expect(asked[0].params).toMatchObject({ branch_id: 'branch_main', from: '2026-11-10', to: '2026-11-16', compare: '1' });
  await expect(card(page, 'Trả hàng').getByRole('link', { name: 'Xem chi tiết Trả hàng' })).toHaveAttribute(
    'href',
    /\/store_1\/reports\?.*section=returns/,
  );
  await page.screenshot({ path: testInfo.outputPath('home-sales.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole('switch').click();
  await expect(page).toHaveURL(/compare=false/);
  await expect(sales.getByText('+50%')).toHaveCount(0);
  expect(requests.at(-1)?.params).toMatchObject({ compare: '0' });

  // On the default layout a tab choice lasts for the visit and is not saved.
  const byRevenue = card(page, 'Top 5 sản phẩm').getByRole('button', { name: 'Doanh thu' });
  await byRevenue.click();
  await expect(byRevenue).toHaveAttribute('aria-pressed', 'true');
  expect(requests.some((r) => r.path === '/pos/dashboard_layout' && r.method !== 'GET')).toBe(false);
  await expect(card(page, 'Tỷ lệ đơn theo trạng thái')).toHaveCount(0);

  await card(page, 'Tổng đơn hàng').getByRole('link', { name: 'Xem chi tiết Tổng đơn hàng' }).click();
  await expect(page).toHaveURL(/\/store_1\/reports\?.*from=2026-11-10.*to=2026-11-16/);
});

test('a hidden widget stays hidden after confirming and reloading', async ({ page }) => {
  const server: { layout: Layout | null } = { layout: null };
  const requests = await install(page, ['pos.report.read'], { delivery: true }, server);
  await page.goto('/store_1?from=2026-11-10&to=2026-11-16');
  await expect(card(page, 'Tổng đơn hàng').getByTestId('kpi-value')).toHaveText('12');
  await page.getByRole('button', { name: 'Tùy chỉnh' }).click();
  await page.getByRole('button', { name: 'Ẩn Tổng đơn hàng' }).click();
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tùy chỉnh' })).toBeVisible();
  const put = requests.find((r) => r.path === '/pos/dashboard_layout' && r.method === 'PUT');
  const saved = (put?.body as { layout: Layout }).layout;
  expect(saved.map((item) => item.widget)).not.toContain('kpi-orders');
  expect(saved.every((item) => Object.keys(item).every((key) => ['id', 'widget', 'x', 'y', 'w', 'h', 'options'].includes(key)))).toBe(true);

  await page.reload();
  await expect(card(page, 'Tổng tiền đơn hàng').getByTestId('kpi-value')).toHaveText('1.500.000 ₫');
  await expect(card(page, 'Tổng đơn hàng')).toHaveCount(0);

  // With a stored layout a tab choice is saved with it.
  await card(page, 'Top 5 sản phẩm').getByRole('button', { name: 'Doanh thu' }).click();
  await expect.poll(() => (server.layout ?? []).find((item) => item.widget === 'top-items')?.options).toEqual({ by: 'revenue' });

  // Back to the default: confirming it forgets the stored layout.
  await page.getByRole('button', { name: 'Tùy chỉnh' }).click();
  await page.getByRole('button', { name: 'Thiết lập lại' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Thiết lập lại', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect.poll(() => requests.some((r) => r.path === '/pos/dashboard_layout' && r.method === 'DELETE')).toBe(true);
  expect(server.layout).toBeNull();
  await expect(card(page, 'Tổng đơn hàng').getByTestId('kpi-value')).toHaveText('12');
});

test('a layout kept on this device moves to the server once', async ({ page }) => {
  const server: { layout: Layout | null } = { layout: null };
  await install(page, ['pos.report.read'], { delivery: true }, server);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(
      'parkviet-pos-dashboard-home-layout:store_1',
      JSON.stringify([{ id: 'attention-refunds', widget: 'attention-refunds', x: 0, y: 0, w: 4, h: 3 }]),
    );
  });
  await page.goto('/store_1');
  await expect(card(page, 'Hoàn tiền chưa xong').getByTestId('attention-count')).toHaveText('1');
  await expect(card(page, 'Tổng tiền đơn hàng')).toHaveCount(0);
  await expect.poll(() => server.layout?.map((item) => item.widget)).toEqual(['attention-refunds']);
  expect(await page.evaluate(() => localStorage.getItem('parkviet-pos-dashboard-home-layout:store_1'))).toBeNull();
});

test('a day of the trend opens from the keyboard and a status opens the orders of the period', async ({ page }) => {
  const requests = await install(page, ['pos.report.read'], { delivery: true }, {
    layout: [
      { id: 'sales-trend', widget: 'sales-trend', x: 0, y: 0, w: 8, h: 7 },
      { id: 'order-status', widget: 'order-status', x: 8, y: 0, w: 4, h: 5 },
    ],
  });
  await page.goto('/store_1?from=2026-11-10&to=2026-11-16');
  const trend = card(page, 'Xu hướng bán hàng');
  await expect(trend.getByText('1.500.000 ₫')).toBeVisible();
  await expect(trend.getByText('7 ngày liền trước (03/11/2026 – 09/11/2026)', { exact: true })).toBeVisible();
  await trend.locator('.recharts-surface').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/store_1\/reports\?from=2026-11-1\d&to=2026-11-1\d/);
  const url = new URL(page.url());
  expect(url.searchParams.get('from')).toBe(url.searchParams.get('to'));

  await page.goBack();
  await card(page, 'Tỷ lệ đơn theo trạng thái').getByRole('link', { name: /Còn nợ/ }).click();
  await expect(page).toHaveURL(/\/store_1\/orders\?.*status=debt/);
  await expect.poll(() => requests.find((r) => r.path === '/pos/orders' && r.params.status === 'debt')?.params).toMatchObject({
    from: '2026-11-10',
    to: '2026-11-16',
  });
});

const savedLayouts = (requests: Awaited<ReturnType<typeof install>>) =>
  requests
    .filter((r) => r.path === '/pos/dashboard_layout' && r.method === 'PUT')
    .map((r) => (r.body as { layout: Layout }).layout);
const box = (layout: Layout | undefined, widget: string) => {
  const item = layout?.find((entry) => entry.widget === widget);
  return item && { x: item.x, y: item.y, w: item.w, h: item.h };
};
// The grid cell of a widget being edited, found by its hide button.
const cell = (page: Page, name: string) =>
  page.getByRole('listitem').filter({ has: page.getByRole('button', { name: `Ẩn ${name}`, exact: true }) });

// Drags with the mouse in small steps, as a hand would, so the grid follows.
async function drag(page: Page, handle: Locator, dx: number, dy: number) {
  const rect = (await handle.boundingBox())!;
  const from = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 5 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 5 });
  await page.mouse.up();
}

test('a widget moves by its grip and resizes from its corner, and the confirmed layout is saved', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'a phone stacks the widgets in one column');
  const requests = await install(page, ['pos.report.read'], { delivery: true }, {
    layout: [
      { id: 'kpi-orders', widget: 'kpi-orders', x: 0, y: 0, w: 3, h: 2 },
      { id: 'kpi-sales-total', widget: 'kpi-sales-total', x: 3, y: 0, w: 3, h: 2 },
    ],
  });
  await page.goto('/store_1?from=2026-11-10&to=2026-11-16');
  await expect(card(page, 'Tổng đơn hàng').getByTestId('kpi-value')).toHaveText('12');
  // Reading, the widgets have neither grips nor corners.
  await expect(page.getByTitle(/^Kéo để di chuyển/)).toHaveCount(0);
  await expect(page.getByTestId('widget-resize-handle')).toHaveCount(0);

  await page.getByRole('button', { name: 'Tùy chỉnh' }).click();
  await expect(page.getByRole('note')).toContainText('kéo góc dưới bên phải');
  const width = (await page.getByRole('list', { name: 'Tổng quan' }).boundingBox())!.width;
  // One grid column with its gap, one grid row with its gap.
  const column = (width - 8 * 11) / 12 + 8;
  const row = 64 + 8;

  await drag(page, page.getByTitle('Kéo để di chuyển Tổng đơn hàng'), 8 * column, 0);
  await drag(page, cell(page, 'Tổng tiền đơn hàng').getByTestId('widget-resize-handle'), column, row);
  expect(savedLayouts(requests)).toHaveLength(0);
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tùy chỉnh' })).toBeVisible();

  const [saved] = savedLayouts(requests);
  expect(box(saved, 'kpi-orders')).toEqual({ x: 8, y: 0, w: 3, h: 2 });
  expect(box(saved, 'kpi-sales-total')).toEqual({ x: 3, y: 0, w: 4, h: 3 });
});

test('a widget dragged onto its neighbour takes that spot and pushes the neighbour down', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'a phone stacks the widgets in one column');
  const requests = await install(page, ['pos.report.read'], { delivery: true }, {
    layout: [
      { id: 'kpi-orders', widget: 'kpi-orders', x: 0, y: 0, w: 4, h: 2 },
      { id: 'kpi-sales-total', widget: 'kpi-sales-total', x: 4, y: 0, w: 4, h: 2 },
      { id: 'kpi-net-sales', widget: 'kpi-net-sales', x: 8, y: 0, w: 4, h: 2 },
    ],
  });
  await page.goto('/store_1?from=2026-11-10&to=2026-11-16');
  await expect(card(page, 'Tổng đơn hàng').getByTestId('kpi-value')).toHaveText('12');
  await page.getByRole('button', { name: 'Tùy chỉnh' }).click();
  const width = (await page.getByRole('list', { name: 'Tổng quan' }).boundingBox())!.width;
  const column = (width - 8 * 11) / 12 + 8;

  // The row is full, so every step of the drag lands on the other widget.
  await drag(page, page.getByTitle('Kéo để di chuyển Tổng đơn hàng'), 4 * column, 0);
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tùy chỉnh' })).toBeVisible();

  const [saved] = savedLayouts(requests);
  expect(box(saved, 'kpi-orders')).toEqual({ x: 4, y: 0, w: 4, h: 2 });
  expect(box(saved, 'kpi-sales-total')).toEqual({ x: 4, y: 2, w: 4, h: 2 });
  expect(box(saved, 'kpi-net-sales')).toEqual({ x: 8, y: 0, w: 4, h: 2 });
});

test('cancelling drops the draft and nothing is saved', async ({ page }) => {
  const requests = await install(page, ['pos.report.read']);
  await page.goto('/store_1?from=2026-11-10&to=2026-11-16');
  await expect(card(page, 'Tổng đơn hàng').getByTestId('kpi-value')).toHaveText('12');
  await page.getByRole('button', { name: 'Tùy chỉnh' }).click();
  await page.getByRole('button', { name: 'Ẩn Tổng đơn hàng' }).click();
  await expect(card(page, 'Tổng đơn hàng')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tùy chỉnh' })).toBeVisible();
  await expect(card(page, 'Tổng đơn hàng').getByTestId('kpi-value')).toHaveText('12');
  expect(requests.some((r) => r.path === '/pos/dashboard_layout' && r.method !== 'GET')).toBe(false);
});

test('a widget added from the sheet takes the first free spot once confirmed', async ({ page }) => {
  const requests = await install(page, ['pos.report.read'], { delivery: true }, {
    layout: [{ id: 'kpi-orders', widget: 'kpi-orders', x: 0, y: 0, w: 3, h: 2 }],
  });
  await page.goto('/store_1?from=2026-11-10&to=2026-11-16');
  await expect(card(page, 'Tổng đơn hàng').getByTestId('kpi-value')).toHaveText('12');
  await page.getByRole('button', { name: 'Thêm tiện ích' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('button', { name: 'Thêm Doanh thu theo giờ' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Thêm Tổng đơn hàng' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Thêm Doanh thu theo giờ' }).click();
  await expect(sheet).toHaveCount(0);
  // Adding opens the editor so the widget can be moved before confirming.
  await expect(page.getByRole('button', { name: 'Xác nhận', exact: true })).toBeVisible();
  expect(savedLayouts(requests)).toHaveLength(0);
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tùy chỉnh' })).toBeVisible();
  await expect(card(page, 'Doanh thu theo giờ')).toBeVisible();
  const [saved] = savedLayouts(requests);
  expect(box(saved, 'kpi-orders')).toEqual({ x: 0, y: 0, w: 3, h: 2 });
  expect(box(saved, 'sales-by-hour')).toEqual({ x: 3, y: 0, w: 6, h: 5 });
});

test('a figure and an order source open the sales report of the same days', async ({ page }) => {
  await install(page, ['pos.report.read'], { delivery: true }, {
    layout: [
      { id: 'kpi-sales-total', widget: 'kpi-sales-total', x: 0, y: 0, w: 3, h: 2 },
      { id: 'sales-by-source', widget: 'sales-by-source', x: 3, y: 0, w: 6, h: 5 },
    ],
  });
  await page.goto('/store_1?from=2026-11-10&to=2026-11-16');
  const search = () => Object.fromEntries(new URL(page.url()).searchParams.entries());

  const figure = card(page, 'Tổng tiền đơn hàng').getByRole('link', { name: 'Xem chi tiết Tổng tiền đơn hàng' });
  await expect(figure).toHaveAttribute('href', '/store_1/reports?from=2026-11-10&to=2026-11-16');
  await figure.click();
  await expect(page).toHaveURL(/\/store_1\/reports\?/);
  expect(search()).toMatchObject({ from: '2026-11-10', to: '2026-11-16' });
  expect(search()).not.toHaveProperty('section');

  await page.goBack();
  const zalo = card(page, 'Doanh thu theo nguồn đơn').getByRole('link', { name: /Zalo/ });
  await expect(zalo).toHaveAttribute('href', '/store_1/reports?from=2026-11-10&to=2026-11-16&orderSource=zalo');
  await zalo.click();
  await expect(page).toHaveURL(/\/store_1\/reports\?.*orderSource=zalo/);
  expect(search()).toMatchObject({ from: '2026-11-10', to: '2026-11-16', orderSource: 'zalo' });
});

test('on a phone the widgets stack without grips, and hiding and adding still work', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'the stacked column is a phone layout');
  const requests = await install(page, ['pos.report.read']);
  await page.goto('/store_1?from=2026-11-10&to=2026-11-16');
  await expect(card(page, 'Tổng đơn hàng').getByTestId('kpi-value')).toHaveText('12');
  await page.getByRole('button', { name: 'Tùy chỉnh' }).click();
  await expect(page.getByRole('note')).toContainText('Bấm dấu trừ để ẩn tiện ích');
  await expect(page.getByTitle(/^Kéo để di chuyển/)).toHaveCount(0);
  await expect(page.getByTestId('widget-resize-handle')).toHaveCount(0);

  await page.getByRole('button', { name: 'Ẩn Tổng đơn hàng' }).click();
  await page.getByRole('button', { name: 'Thêm tiện ích' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Thêm Doanh thu theo giờ' }).click();
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tùy chỉnh' })).toBeVisible();
  await expect(card(page, 'Tổng đơn hàng')).toHaveCount(0);
  await expect(card(page, 'Doanh thu theo giờ')).toBeVisible();
  const [saved] = savedLayouts(requests);
  expect(saved.map((item) => item.widget)).not.toContain('kpi-orders');
  expect(saved.map((item) => item.widget)).toContain('sales-by-hour');
});
