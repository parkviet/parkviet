import { expect, type Page, test } from '@playwright/test';
import { teaMenu } from './support/menu-api';
import { installRetailApi, login, newWorld, type World } from './support/retail-api';

// The selling screen of a cafe counter lays its panels out by the layout of
// this device: a sample screen from the toolbar's chooser, a few options on
// top of it, and dividers that can be dragged or moved with the keyboard.
// What the device chose is kept per branch; a device that chose nothing
// follows the branch's default. Presentation fixtures only.

const KEY = 'parkviet-pos:selling-layout:br_1';

function cafeWorld(sellingPreset?: World['sellingPreset']): World {
  const world = newWorld({
    modules: { 'retail.units': true, 'fnb.menu': true, 'fnb.order_number': true },
    profile: { key: 'cafe_tra_sua', version: 1, display: { surface: 'menu_grid' } },
    menu: teaMenu(),
  });
  world.sellingPreset = sellingPreset;
  return world;
}

async function openCounter(page: Page, world: World) {
  await installRetailApi(page, world);
  await login(page);
  await expect(page.getByRole('complementary', { name: 'Phiếu quầy' })).toBeVisible();
}

const toolbar = (page: Page) => page.getByRole('region', { name: 'Công cụ bán hàng' });
const chooser = (page: Page) => page.getByRole('dialog', { name: 'Chọn màn bán hàng' });
const stored = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), KEY);

async function openChooser(page: Page) {
  await toolbar(page).getByRole('button', { name: 'Chọn màn bán hàng' }).click();
  await expect(chooser(page)).toBeVisible();
}

test('the chooser shows the four sample screens and locks the one the modules do not allow', async ({
  page,
}) => {
  await openCounter(page, cafeWorld());
  await openChooser(page);
  const dialog = chooser(page);
  await expect(dialog.getByRole('button', { name: /Chọn nhanh, tính tiền sau/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const tables = dialog.getByRole('button', { name: /Bàn trước, gọi món sau/ });
  await expect(tables).toBeDisabled();
  await expect(tables).toContainText('Cần bật chức năng Bàn');
  await expect(dialog.getByRole('button', { name: /Menu lớn, chạm dễ/ })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('a sample with its payment in a column keeps the payment open and is kept after a reload', async ({
  page,
}) => {
  await openCounter(page, cafeWorld());
  await expect(page.getByRole('complementary', { name: 'Thông tin thanh toán' })).toHaveCount(0);
  await openChooser(page);
  await chooser(page).getByRole('button', { name: /Bán & thanh toán một màn/ }).click();
  await expect(page.getByRole('complementary', { name: 'Thông tin thanh toán' })).toBeVisible();
  expect(await stored(page)).toMatchObject({ preset: 'one_step', pay: 'column', side: 'left' });
  // The tile size is the device's menu density, not a second setting.
  expect(await page.evaluate(() => localStorage.getItem('parkviet-pos:menu-density'))).toBe('dense');

  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Phiếu quầy' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Thông tin thanh toán' })).toBeVisible();
});

test('a device that chose nothing follows the branch default, and can come back to it', async ({
  page,
}) => {
  await openCounter(page, cafeWorld('one_step'));
  await expect(page.getByRole('complementary', { name: 'Thông tin thanh toán' })).toBeVisible();
  await openChooser(page);
  const dialog = chooser(page);
  await expect(dialog.getByRole('button', { name: /Bán & thanh toán một màn/ })).toContainText(
    'Đang dùng',
  );
  await expect(dialog.getByRole('button', { name: 'Dùng mặc định chi nhánh' })).toBeDisabled();

  await dialog.getByRole('button', { name: /Chọn nhanh, tính tiền sau/ }).click();
  await expect(page.getByRole('complementary', { name: 'Thông tin thanh toán' })).toHaveCount(0);
  expect(await stored(page)).toMatchObject({ preset: 'quick' });
  await expect(dialog.getByRole('button', { name: /Bán & thanh toán một màn/ })).toContainText(
    'Mặc định chi nhánh',
  );

  await dialog.getByRole('button', { name: 'Dùng mặc định chi nhánh' }).click();
  expect(await stored(page)).toBeNull();
  // The tile size follows the branch default again: no density of its own.
  expect(await page.evaluate(() => localStorage.getItem('parkviet-pos:menu-density'))).toBeNull();
  await expect(page.getByRole('complementary', { name: 'Thông tin thanh toán' })).toBeVisible();
});

test('a changed option is marked, and one button brings the sample back', async ({ page }) => {
  await openCounter(page, cafeWorld());
  await openChooser(page);
  const dialog = chooser(page);
  await expect(dialog.getByRole('button', { name: 'Về mặc định của màn mẫu' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Danh mục phải', exact: true }).click();
  await expect(dialog.getByRole('button', { name: /Chọn nhanh, tính tiền sau/ })).toContainText(
    'đã tuỳ chỉnh',
  );
  expect(await stored(page)).toMatchObject({ preset: 'quick', side: 'right' });
  await dialog.getByRole('button', { name: 'Về mặc định của màn mẫu' }).click();
  expect(await stored(page)).toMatchObject({ preset: 'quick', side: 'left' });
});

test('the divider moves by the keyboard between a third and two thirds, and resets', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile', 'the panels stack on a phone, with no divider');
  await openCounter(page, cafeWorld());
  const divider = page.getByRole('separator').first();
  await expect(divider).toBeVisible();
  await expect(divider).toHaveAttribute('aria-valuenow', '62');
  await divider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(divider).toHaveAttribute('aria-valuenow', '57');
  await page.keyboard.press('Home');
  await expect(divider).toHaveAttribute('aria-valuenow', '33');
  await page.keyboard.press('ArrowLeft');
  await expect(divider).toHaveAttribute('aria-valuenow', '33');
  await page.keyboard.press('End');
  await expect(divider).toHaveAttribute('aria-valuenow', '67');
  expect((await stored(page)).split).toBeCloseTo(2 / 3, 5);

  await page.reload();
  await expect(page.getByRole('separator').first()).toHaveAttribute('aria-valuenow', '67');
  await page.getByRole('separator').first().dblclick();
  await expect(page.getByRole('separator').first()).toHaveAttribute('aria-valuenow', '62');
});

test('dragging the divider changes the panels at once and keeps the share on release', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'drag needs the wide layout');
  await openCounter(page, cafeWorld());
  const divider = page.getByRole('separator').first();
  const box = await divider.boundingBox();
  if (!box) throw new Error('divider has no box');
  const frame = page.locator('.selling-frame');
  const frameBox = await frame.boundingBox();
  if (!frameBox) throw new Error('frame has no box');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  // Far past the left limit: held at a third, and flagged as the limit.
  await page.mouse.move(frameBox.x + 10, y, { steps: 5 });
  await expect(divider).toHaveAttribute('data-limit', 'true');
  await expect(divider.getByRole('status')).toContainText('giới hạn');
  await page.mouse.up();
  await expect(divider).toHaveAttribute('aria-valuenow', '33');
  expect((await stored(page)).split).toBeCloseTo(1 / 3, 5);
  const catalog = await page.locator('.selling-catalog').boundingBox();
  expect(catalog?.width ?? 0).toBeLessThan(frameBox.width * 0.4);
});

test('F9 opens the payment of an order with dishes in a dialog, and Esc closes it', async ({
  page,
}) => {
  await openCounter(page, cafeWorld());
  await page.getByRole('list', { name: 'Thực đơn' }).getByRole('button', { name: 'Bánh flan', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Phiếu quầy' }).locator('.ticket-line')).toHaveCount(1);
  await page.keyboard.press('F9');
  const pay = page.getByRole('dialog', { name: 'Thanh toán' });
  await expect(pay).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pay).toHaveCount(0);
});

test('the payment that replaces the cart has a way back', async ({ page }) => {
  await openCounter(page, cafeWorld('big_menu'));
  await page.getByRole('list', { name: 'Thực đơn' }).getByRole('button', { name: 'Bánh flan', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Phiếu quầy' }).locator('.ticket-line')).toHaveCount(1);
  await page.keyboard.press('F9');
  const sheet = page.getByRole('region', { name: 'Thanh toán' }).first();
  await expect(sheet).toBeVisible();
  // The menu stays in view while the payment takes the cart's place.
  await expect(page.getByRole('list', { name: 'Thực đơn' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Phiếu quầy' })).toHaveCount(0);
  await page.getByRole('button', { name: /Về|Đơn/ }).first().click();
  await expect(page.getByRole('complementary', { name: 'Phiếu quầy' })).toBeVisible();
});

test('pressing the divider without dragging does not store a share', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'drag needs the wide layout');
  await openCounter(page, cafeWorld());
  const divider = page.getByRole('separator').first();
  const box = await divider.boundingBox();
  if (!box) throw new Error('divider has no box');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await stored(page)).toBeNull();
});

test('the payment keys wait while the payment dialog is open', async ({ page }) => {
  await openCounter(page, cafeWorld());
  await page.getByRole('list', { name: 'Thực đơn' }).getByRole('button', { name: 'Bánh flan', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Phiếu quầy' }).locator('.ticket-line')).toHaveCount(1);
  await page.keyboard.press('F9');
  const pay = page.getByRole('dialog', { name: 'Thanh toán' });
  await expect(pay).toBeVisible();
  await page.keyboard.press('F1');
  // Cash was not taken behind the dialog: the order is still on the ticket.
  await expect(pay).toBeVisible();
  await expect(page.locator('.quick-ticket .ticket-line')).toHaveCount(1);
});

test('F9 opens the payment from an empty search box but not from a typed one', async ({ page }) => {
  await openCounter(page, cafeWorld());
  await page.getByRole('list', { name: 'Thực đơn' }).getByRole('button', { name: 'Bánh flan', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Phiếu quầy' }).locator('.ticket-line')).toHaveCount(1);
  const search = page.getByRole('searchbox').first();
  await search.focus();
  await search.fill('flan');
  await page.keyboard.press('F9');
  await expect(page.getByRole('dialog', { name: 'Thanh toán' })).toHaveCount(0);
  await search.fill('');
  await page.keyboard.press('F9');
  await expect(page.getByRole('dialog', { name: 'Thanh toán' })).toBeVisible();
});
