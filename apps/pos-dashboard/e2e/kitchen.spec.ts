import { expect, type Locator, type Page, test } from '@playwright/test';
import { installDashboardShell } from './support/dashboard';
import { pageMeta, staff } from './support/pos-context';

type Item = {
  id: string; sale_line_id: string | null; name: string; modifiers: []; components: []; note: string | null; quantity: string;
  status: 'new' | 'preparing' | 'ready' | 'served' | 'voided'; started_at: string | null; ready_at: string | null; served_at: string | null;
  voided_at: string | null; recalled_at: string | null; recall_count: number; prep_seconds: number | null; late: boolean;
  seat: number | null; course: number | null; priority: boolean; priority_at: string | null;
};
type Ticket = {
  id: string; workspace_id: string; branch_id: string; kitchen_station_id: string; station_name: string; station_kind: string; sequence: number;
  kind: 'fire'; service_mode: string; business_date: string; header: Record<string, string>; sent_at: string; done: boolean; done_at: string | null;
  priority: boolean; items: Item[];
};
type Request = { id: string; action: string; status: string; subject_label: string; reason: string; requester_name: string; decided_by_name: string | null };

const NOW = '2026-11-20T05:00:00Z';
const SENT = '2026-11-20T04:55:00Z';
const item = (id: string, name: string, status: Item['status'], extra: Partial<Item> = {}): Item => ({
  id, sale_line_id: `line_${id}`, name, modifiers: [], components: [], note: null, quantity: '1', status,
  started_at: status === 'preparing' || status === 'ready' ? SENT : null, ready_at: status === 'ready' ? SENT : null, served_at: null,
  voided_at: status === 'voided' ? SENT : null, recalled_at: null, recall_count: 0, prep_seconds: null, late: false, seat: null, course: null,
  priority: false, priority_at: null, ...extra,
});
const ticket = (id: string, branch: string, station: [string, string], header: Record<string, string>, items: Item[]): Ticket => ({
  id, workspace_id: `ws_${id}`, branch_id: branch, kitchen_station_id: station[0], station_name: station[1], station_kind: 'prep', sequence: 1,
  kind: 'fire', service_mode: 'dine_in', business_date: '2026-11-20', header, sent_at: SENT, done: false, done_at: null, priority: false, items,
});

const branches = [
  { id: 'branch_main', name: 'Chi nhánh chính', code: 'main', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'stock_main', receiving_stock_location_id: null, receiving_note: null },
  { id: 'branch_q3', name: 'Chi nhánh Quận 3', code: 'q3', status: 'active', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: 'stock_q3', receiving_stock_location_id: null, receiving_note: null, is_default: true },
];
const stations = [
  { id: 'st_hot', branch_id: 'branch_q3', name: 'Bếp nóng', kind: 'prep', printer_id: null, printer_name: null, kds_enabled: true, is_default: true, warn_after_minutes: 10, late_after_minutes: 20, position: 0, active: true, expo_station_id: null },
  { id: 'st_bar', branch_id: 'branch_q3', name: 'Bar', kind: 'bar', printer_id: null, printer_name: null, kds_enabled: true, is_default: false, warn_after_minutes: 10, late_after_minutes: 20, position: 1, active: true, expo_station_id: null },
];
const HOT: [string, string] = ['st_hot', 'Bếp nóng'];
const BAR: [string, string] = ['st_bar', 'Bar'];

const seedTickets = (): Ticket[] => [
  ticket('t1', 'branch_q3', HOT, { table: 'Bàn 5', order_number: 'P00001' }, [
    item('i1', 'Phở bò', 'new'), item('i2', 'Gỏi cuốn', 'preparing', { priority: true, priority_at: SENT }), item('i3', 'Bún chả', 'ready'),
  ]),
  ticket('t2', 'branch_q3', BAR, { table: 'Bàn 7', order_number: 'P00002' }, [item('i4', 'Cà phê sữa', 'new'), item('i5', 'Trà đào', 'voided')]),
  ticket('t3', 'branch_q3', HOT, { pickup_code: 'A12', order_number: 'P00003' }, [item('i6', 'Cơm tấm', 'new', { priority: true, priority_at: SENT })]),
  ticket('t9', 'branch_main', HOT, { table: 'Bàn 9', order_number: 'P00009' }, [item('i9', 'Bánh mì', 'new')]),
];
const seedRequests = (): Request[] => [
  { id: 'ar_1', action: 'kitchen.void_sent', status: 'pending', subject_label: 'Bàn 5', reason: 'khach_doi_y', requester_name: 'Lan', decided_by_name: null },
  { id: 'ar_2', action: 'kitchen.void_sent', status: 'pending', subject_label: 'Bàn 7', reason: 'khac', requester_name: 'Minh', decided_by_name: null },
  { id: 'ar_3', action: 'kitchen.void_sent', status: 'granted', subject_label: 'Bàn 2', reason: 'khac', requester_name: 'Lan', decided_by_name: 'Quản trị Hiền' },
  { id: 'ar_4', action: 'kitchen.void_sent', status: 'declined', subject_label: 'Bàn 3', reason: 'khac', requester_name: 'Lan', decided_by_name: 'Quản trị Hiền' },
  // Another kind of request: the screen must never ask for it.
  { id: 'ar_5', action: 'order.discount', status: 'pending', subject_label: 'Đơn P00007', reason: 'khac', requester_name: 'Lan', decided_by_name: null },
];

async function install(page: Page, options: { capabilities?: string[]; kitchenOffAt?: string[] } = {}) {
  const tickets = seedTickets();
  const requests = seedRequests();
  const state = {
    boards: [] as Record<string, string>[], writes: [] as { path: string; body: Record<string, unknown> }[],
    voidLists: [] as { action: string[]; status: string[]; branch: string | null }[],
  };
  await page.route('**/api/v3/admin/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v3/admin', '');
    if (path === '/pos/context') {
      const branchId = url.searchParams.get('branch_id') ?? 'branch_q3';
      return route.fulfill({ json: {
        sales_channel: { id: 'ch_pos', code: 'pos', name: 'POS', status: 'active' }, staff,
        store: { id: 'store_1', name: 'Siêu thị Hiền', currency: 'VND', timezone: 'Asia/Ho_Chi_Minh' },
        administration: { read: false, write: false }, capabilities: options.capabilities ?? ['pos.kitchen.operate'],
        features: null, modules: { 'fnb.kitchen': !(options.kitchenOffAt ?? []).includes(branchId) },
        branches, registers: [], shift: null, selection: { branch_id: branchId, register_id: null },
      } });
    }
    if (path === '/pos/kitchen/board') {
      const params = Object.fromEntries(url.searchParams.entries()); state.boards.push(params);
      const only = params.station_ids?.split(',');
      const open = tickets.filter((row) => row.branch_id === params.branch_id && (!only || only.includes(row.kitchen_station_id)));
      return route.fulfill({ json: { data: { branch_id: params.branch_id, stations, service_mode: null, server_now: NOW, open, done: [], all_day: [], expo: [] } } });
    }
    const modules = /^\/pos\/branches\/([^/]+)\/modules$/.exec(path);
    if (modules) return route.fulfill({ json: { data: { branch_id: modules[1], modules: { 'fnb.kitchen': true }, settings: [] } } });
    if (path === '/pos/kitchen_stations') return route.fulfill({ json: { data: stations.filter((row) => row.branch_id === url.searchParams.get('branch_id')) } });
    if (path === '/pos/cup_label_settings') return route.fulfill({ json: { data: { branch_id: url.searchParams.get('branch_id'), printer_id: null, size: '50x30', fields: ['call_number'], pickup_minutes: 10, auto_print: false, module_enabled: true, sizes: ['40x30', '50x30'], available_fields: ['call_number', 'note'] } } });
    if (path === '/pos/kitchen_settings') return route.fulfill({ json: { data: { branch_id: url.searchParams.get('branch_id'), kitchen_send_trigger: 'on_complete', module_enabled: true, void_reasons: [] } } });
    const command = /^\/pos\/kitchen\/(items|tickets)\/([^/]+)\/(start|ready|serve|recall|priority)$/.exec(path);
    if (command) {
      const body = request.postDataJSON() ?? {}; state.writes.push({ path, body });
      const [, kind, id, verb] = command;
      const owner = tickets.find((row) => (kind === 'tickets' ? row.id === id : row.items.some((entry) => entry.id === id)))!;
      const open = (entry: Item) => entry.status === 'new' || entry.status === 'preparing';
      if (kind === 'tickets') owner.items.filter(open).forEach((entry) => { entry.priority = body.priority; });
      else {
        const entry = owner.items.find((row) => row.id === id)!;
        if (verb === 'start') { entry.status = 'preparing'; entry.started_at = SENT; }
        if (verb === 'ready') { entry.status = 'ready'; entry.ready_at = SENT; }
        if (verb === 'serve') { entry.status = 'served'; entry.served_at = SENT; }
        if (verb === 'recall') Object.assign(entry, { status: 'new', started_at: null, ready_at: null, recall_count: entry.recall_count + 1, priority: true });
        if (verb === 'priority') entry.priority = body.priority;
      }
      return route.fulfill({ json: { data: owner } });
    }
    if (path === '/pos/approval_requests') {
      const action = url.searchParams.getAll('action[]'); const status = url.searchParams.getAll('status[]');
      state.voidLists.push({ action, status, branch: url.searchParams.get('branch_id') });
      const rows = requests.filter((row) => action.includes(row.action) && status.includes(row.status));
      return route.fulfill({ json: { data: rows, meta: pageMeta(rows.length, 1, 100) } });
    }
    const decision = /^\/pos\/approval_requests\/([^/]+)\/(grant|decline)$/.exec(path);
    if (decision) {
      state.writes.push({ path, body: request.postDataJSON() });
      const row = requests.find((entry) => entry.id === decision[1])!;
      row.status = decision[2] === 'grant' ? 'granted' : 'declined'; row.decided_by_name = 'Quản trị Hiền';
      return route.fulfill({ json: { data: row } });
    }
    if (path.startsWith('/pos/')) return route.fulfill({ json: { data: [], meta: pageMeta(0) } });
    return route.fallback();
  });
  await installDashboardShell(page, { authenticated: true, read: false, write: false });
  return state;
}

const COLUMNS = { waiting: 'Chờ chế biến', preparing: 'Đang chế biến', ready: 'Chờ mang ra' } as const;
// Narrow screens show one column at a time, picked from a tab strip.
async function column(page: Page, key: keyof typeof COLUMNS): Promise<Locator> {
  const tab = page.getByRole('tab', { name: new RegExp(`^${COLUMNS[key]} \\(`) });
  if (await tab.isVisible()) await tab.click();
  return page.getByRole('region', { name: new RegExp(`^${COLUMNS[key]}`) });
}
const cardTitles = (region: Locator) => region.getByRole('article').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
const sidebarLink = (page: Page) => page.locator('[data-sidebar="sidebar"]').first().getByRole('link', { name: 'Bếp', exact: true });

test('the board opens the branch named in the address, else the default branch, and the picker updates the address', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/kitchen?branch=branch_main');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bếp');
  await expect(page.getByRole('article', { name: 'Bàn 9' })).toBeVisible();
  expect(state.boards.at(-1)).toMatchObject({ branch_id: 'branch_main' });

  await page.goto('/store_1/kitchen');
  await expect(async () => expect(await cardTitles(await column(page, 'waiting'))).toContain('Bàn 5')).toPass();
  await expect(page.getByRole('article', { name: 'Bàn 9' })).toHaveCount(0);
  expect(state.boards.at(-1)).toMatchObject({ branch_id: 'branch_q3' });

  await page.getByLabel('Chi nhánh', { exact: true }).click();
  await page.getByRole('option', { name: 'Chi nhánh chính', exact: true }).click();
  await expect(page).toHaveURL(/branch=branch_main/);
  await expect(page.getByRole('article', { name: 'Bàn 9' })).toBeVisible();
  expect(state.boards.at(-1)).toMatchObject({ branch_id: 'branch_main' });
});

test('the three columns show each dish by stage and the buttons move it along', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/kitchen');
  await expect(await column(page, 'waiting')).toBeVisible();
  const waiting = await column(page, 'waiting');
  await expect(waiting.getByRole('article', { name: 'Bàn 5' })).toContainText('Phở bò');
  await expect(waiting.getByRole('article', { name: 'Bàn 5' })).not.toContainText('Gỏi cuốn');
  await expect(waiting.getByRole('article', { name: 'Bàn 7' })).toContainText('Cà phê sữa');
  await expect(waiting.getByRole('article', { name: 'A12' })).toContainText('Cơm tấm');
  await expect(waiting).not.toContainText('Trà đào');
  await expect(await column(page, 'preparing')).toContainText('Gỏi cuốn');
  await expect(await column(page, 'ready')).toContainText('Bún chả');

  const dish = (region: Locator, name: string) => region.getByRole('listitem').filter({ hasText: name });
  await dish(await column(page, 'waiting'), 'Phở bò').getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  expect(state.writes.at(-1)?.path).toBe('/pos/kitchen/items/i1/start');
  await expect(dish(await column(page, 'waiting'), 'Phở bò')).toHaveCount(0);
  await expect(dish(await column(page, 'preparing'), 'Phở bò')).toHaveCount(1);

  await dish(await column(page, 'preparing'), 'Phở bò').getByRole('button', { name: 'Xong', exact: true }).click();
  expect(state.writes.at(-1)?.path).toBe('/pos/kitchen/items/i1/ready');
  await expect(dish(await column(page, 'preparing'), 'Phở bò')).toHaveCount(0);
  await expect(dish(await column(page, 'ready'), 'Phở bò')).toHaveCount(1);

  await dish(await column(page, 'ready'), 'Phở bò').getByRole('button', { name: 'Đã mang ra', exact: true }).click();
  expect(state.writes.at(-1)?.path).toBe('/pos/kitchen/items/i1/serve');
  await expect(dish(await column(page, 'ready'), 'Phở bò')).toHaveCount(0);
  await expect(dish(await column(page, 'ready'), 'Bún chả')).toHaveCount(1);

  await dish(await column(page, 'ready'), 'Bún chả').getByRole('button', { name: 'Gọi lại', exact: true }).click();
  expect(state.writes.at(-1)?.path).toBe('/pos/kitchen/items/i3/recall');
  await expect(dish(await column(page, 'ready'), 'Bún chả')).toHaveCount(0);
  const again = dish(await column(page, 'waiting'), 'Bún chả');
  await expect(again).toContainText('Gọi lại lần 1');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the priority filter keeps only urgent dishes and the card stars set and clear urgency', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/kitchen');
  const waiting = await column(page, 'waiting');
  await expect(waiting.getByRole('article')).toHaveCount(3);
  // Urgent cards come first, the rest keep the board's order.
  expect(await cardTitles(waiting)).toEqual(['A12', 'Bàn 5', 'Bàn 7']);

  await page.getByRole('tab', { name: 'Ưu tiên (2)' }).click();
  await expect(page).toHaveURL(/priority=true/);
  await expect(async () => expect(await cardTitles(await column(page, 'waiting'))).toEqual(['A12'])).toPass();
  expect(state.boards.at(-1)).toMatchObject({ priority: '1' });
  await expect(await column(page, 'preparing')).toContainText('Gỏi cuốn');
  await expect(await column(page, 'ready')).not.toContainText('Bún chả');
  await page.getByRole('tab', { name: 'Tất cả món' }).click();
  await expect(page).not.toHaveURL(/priority=/);
  await expect(async () => expect(await cardTitles(await column(page, 'waiting'))).toHaveLength(3)).toPass();

  const seven = (await column(page, 'waiting')).getByRole('article', { name: 'Bàn 7' });
  await seven.getByRole('button', { name: 'Ưu tiên cả phiếu', exact: true }).click();
  expect(state.writes.at(-1)).toMatchObject({ path: '/pos/kitchen/tickets/t2/priority', body: { priority: true } });
  await expect(seven.getByRole('button', { name: 'Bỏ ưu tiên cả phiếu', exact: true })).toBeVisible();
  await expect(seven).toContainText('Ưu tiên');
  await expect(page.getByRole('tab', { name: 'Ưu tiên (3)' })).toBeVisible();
  expect(await cardTitles(await column(page, 'waiting'))).toEqual(['Bàn 7', 'A12', 'Bàn 5']);

  await seven.getByRole('button', { name: 'Bỏ ưu tiên cả phiếu', exact: true }).click();
  expect(state.writes.at(-1)).toMatchObject({ path: '/pos/kitchen/tickets/t2/priority', body: { priority: false } });
  await expect(page.getByRole('tab', { name: 'Ưu tiên (2)' })).toBeVisible();

  const pho = (await column(page, 'waiting')).getByRole('listitem').filter({ hasText: 'Phở bò' });
  await pho.getByRole('button', { name: 'Đánh dấu ưu tiên cho Phở bò', exact: true }).click();
  expect(state.writes.at(-1)).toMatchObject({ path: '/pos/kitchen/items/i1/priority', body: { priority: true } });
  await expect(pho.getByRole('button', { name: 'Bỏ ưu tiên của Phở bò', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Ưu tiên (3)' })).toBeVisible();
});

test('station chips, search and the voided switch narrow the board and stay in the address', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/kitchen');
  const waiting = await column(page, 'waiting');
  await expect(waiting.getByRole('article')).toHaveCount(3);

  await page.getByRole('button', { name: 'Bar', exact: true }).click();
  await expect(page).toHaveURL(/stations=st_bar/);
  await expect(async () => expect(await cardTitles(await column(page, 'waiting'))).toEqual(['Bàn 7'])).toPass();
  expect(state.boards.at(-1)).toMatchObject({ station_ids: 'st_bar' });
  await page.getByRole('button', { name: 'Tất cả khu bếp', exact: true }).click();
  await expect(page).not.toHaveURL(/stations=/);
  await expect(async () => expect(await cardTitles(await column(page, 'waiting'))).toHaveLength(3)).toPass();

  await page.getByRole('searchbox', { name: 'Tìm món, bàn hoặc mã đơn' }).fill('pho');
  await expect(page).toHaveURL(/q=pho/);
  await expect(async () => expect(await cardTitles(await column(page, 'waiting'))).toEqual(['Bàn 5'])).toPass();
  await page.getByRole('searchbox', { name: 'Tìm món, bàn hoặc mã đơn' }).fill('A12');
  await expect(async () => expect(await cardTitles(await column(page, 'waiting'))).toEqual(['A12'])).toPass();
  await page.getByRole('searchbox', { name: 'Tìm món, bàn hoặc mã đơn' }).fill('P00002');
  await expect(async () => expect(await cardTitles(await column(page, 'waiting'))).toEqual(['Bàn 7'])).toPass();
  await page.getByRole('searchbox', { name: 'Tìm món, bàn hoặc mã đơn' }).fill('');
  await expect(page).not.toHaveURL(/q=/);

  const seven = (await column(page, 'waiting')).getByRole('article', { name: 'Bàn 7' });
  await expect(seven).not.toContainText('Trà đào');
  await page.getByRole('switch', { name: 'Món đã huỷ' }).click();
  await expect(page).toHaveURL(/voided=true/);
  await expect(seven).toContainText('Trà đào');
  await expect(seven).toContainText('Đã huỷ');

  // A shared link opens the same view.
  await page.goto('/store_1/kitchen?stations=st_bar&q=ca%20phe&voided=true');
  await expect(page.getByRole('switch', { name: 'Món đã huỷ' })).toBeChecked();
  await expect(page.getByRole('searchbox', { name: 'Tìm món, bàn hoặc mã đơn' })).toHaveValue('ca phe');
  await expect(async () => expect(await cardTitles(await column(page, 'waiting'))).toEqual(['Bàn 7'])).toPass();
});

test('the void requests tab lists kitchen requests only and grants or declines them', async ({ page }) => {
  const state = await install(page);
  await page.goto('/store_1/kitchen');
  await page.getByRole('tab', { name: 'Yêu cầu huỷ', exact: true }).click();
  await expect(page).toHaveURL(/tab=voids/);
  const list = page.getByRole('list').filter({ hasText: 'Bàn 5' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText('Đơn P00007')).toHaveCount(0);
  expect(state.voidLists.at(-1)).toMatchObject({ action: ['kitchen.void_sent'], branch: 'branch_q3' });
  const counts = page.getByRole('definition');
  await expect(counts).toHaveText(['2', '1', '1']);

  await list.getByRole('listitem').filter({ hasText: 'Bàn 5' }).getByRole('button', { name: 'Duyệt', exact: true }).click();
  expect(state.writes.at(-1)).toMatchObject({ path: '/pos/approval_requests/ar_1/grant' });
  await expect(page.getByRole('listitem').filter({ hasText: 'Bàn 5' })).toHaveCount(0);
  await expect(counts).toHaveText(['1', '2', '1']);

  await page.getByRole('listitem').filter({ hasText: 'Bàn 7' }).getByRole('button', { name: 'Từ chối', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Từ chối', exact: true }).click();
  expect(state.writes.at(-1)).toMatchObject({ path: '/pos/approval_requests/ar_2/decline' });
  await expect(page.getByText('Không có yêu cầu huỷ nào.')).toBeVisible();
  await expect(counts).toHaveText(['0', '2', '2']);

  await page.getByRole('tab', { name: 'Đã xử lý', exact: true }).click();
  await expect(page).toHaveURL(/voidStatus=handled/);
  await expect(page.getByRole('listitem').filter({ hasText: 'Bàn 2' })).toContainText('Đã duyệt');
  await expect(page.getByRole('listitem').filter({ hasText: 'Bàn 3' })).toContainText('Từ chối');
  expect(state.voidLists.some((row) => row.status.includes('granted') && row.status.includes('declined'))).toBe(true);
});

test('the settings button opens the kitchen tab of the branch', async ({ page }) => {
  await install(page, { capabilities: ['pos.kitchen.manage'] });
  await page.goto('/store_1/kitchen?branch=branch_main');
  await page.getByRole('link', { name: 'Cài đặt bếp', exact: true }).click();
  await expect(page).toHaveURL(/\/store_1\/branches\/branch_main\/kitchen/);
  await expect(page.getByText('Gửi bếp', { exact: true }).first()).toBeVisible();
});

test('operators without setup rights get no settings button', async ({ page }) => {
  await install(page, { capabilities: ['pos.kitchen.operate'] });
  await page.goto('/store_1/kitchen');
  await expect(page.getByRole('tab', { name: 'Bảng bếp', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cài đặt bếp', exact: true })).toHaveCount(0);
});

test('the menu entry follows the permission and the branch module, and a direct visit is guarded', async ({ page }, testInfo) => {
  const state = await install(page, { capabilities: ['pos.kitchen.operate'], kitchenOffAt: ['branch_main'] });
  const desktop = testInfo.project.name === 'desktop';
  await page.goto('/store_1/kitchen');
  await expect(page.getByRole('tab', { name: 'Bảng bếp', exact: true })).toBeVisible();
  if (desktop) await expect(sidebarLink(page)).toBeVisible();

  // The branch without the kitchen module: the entry leaves and the page says why instead of showing a board.
  await page.goto('/store_1/kitchen?branch=branch_main');
  await expect(page.getByRole('status').filter({ hasText: 'chưa bật chức năng bếp' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Bảng bếp', exact: true })).toHaveCount(0);
  if (desktop) await expect(sidebarLink(page)).toHaveCount(0);
  expect(state.boards.filter((row) => row.branch_id === 'branch_main')).toEqual([]);
});

test('staff with no kitchen right see no menu entry and are blocked from the address', async ({ page }, testInfo) => {
  const state = await install(page, { capabilities: ['pos.report.read'] });
  await page.goto('/store_1/kitchen');
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập', exact: true })).toBeVisible();
  expect(state.boards).toEqual([]);
  if (testInfo.project.name === 'desktop') await expect(sidebarLink(page)).toHaveCount(0);
});
