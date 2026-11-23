import { expect, type Page, test } from '@playwright/test';
import { teaMenu } from './support/menu-api';
import { installRetailApi, login, newWorld } from './support/retail-api';

// The toolbar at the right of the header offers help, the customer display,
// the printer and the quick settings of this device. Only settings that exist
// are listed, and a choice made there is the same one the screens keep.

async function openCounter(page: Page) {
  const world = newWorld({
    modules: { 'retail.units': true, 'fnb.menu': true, 'fnb.order_number': true },
    profile: { key: 'cafe_tra_sua', version: 1, display: { surface: 'menu_grid' } },
    menu: teaMenu(),
  });
  await installRetailApi(page, world);
  await login(page);
  await expect(page.getByRole('list', { name: 'Thực đơn' })).toBeVisible();
  // A phone-width screen starts with the toolbar folded.
  const unfold = toolbar(page).getByRole('button', { name: 'Mở thanh công cụ' });
  if (await unfold.isVisible()) await unfold.click();
}

const toolbar = (page: Page) => page.getByRole('region', { name: 'Công cụ bán hàng' });

test('a phone-width screen starts with the toolbar folded so the header keeps one row', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'only phone-width screens fold by default');
  await installRetailApi(
    page,
    newWorld({
      modules: { 'retail.units': true, 'fnb.menu': true, 'fnb.order_number': true },
      profile: { key: 'cafe_tra_sua', version: 1, display: { surface: 'menu_grid' } },
      menu: teaMenu(),
    }),
  );
  await login(page);
  await expect(toolbar(page).getByRole('button', { name: 'Mở thanh công cụ' })).toBeVisible();
  await expect(toolbar(page).getByRole('button', { name: 'Máy in' })).toHaveCount(0);
  const height = await page.locator('header.header').evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(56);
});

test('the toolbar lists the tools that exist, with the selling screen chooser', async ({ page }) => {
  await openCounter(page);
  const bar = toolbar(page);
  await expect(bar.getByRole('button', { name: 'Trợ giúp' })).toBeVisible();
  await expect(bar.getByRole('link', { name: 'Màn hình khách' })).toHaveAttribute('target', '_blank');
  await expect(bar.getByRole('button', { name: 'Máy in' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Cài đặt nhanh' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Chọn màn bán hàng' })).toBeVisible();
});

test('a popover closes on Esc and gives the focus back to its button', async ({ page }) => {
  await openCounter(page);
  const button = toolbar(page).getByRole('button', { name: 'Cài đặt nhanh' });
  await button.click();
  await expect(page.getByRole('dialog', { name: 'Cài đặt nhanh của máy này' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Cài đặt nhanh của máy này' })).toHaveCount(0);
  await expect(button).toBeFocused();

  await button.click();
  await page.mouse.click(4, 4);
  await expect(page.getByRole('dialog', { name: 'Cài đặt nhanh của máy này' })).toHaveCount(0);
});

test('quick settings change the menu tiles at once and are kept on this device', async ({ page }) => {
  await openCounter(page);
  await toolbar(page).getByRole('button', { name: 'Cài đặt nhanh' }).click();
  const popover = page.getByRole('dialog', { name: 'Cài đặt nhanh của máy này' });
  await popover.getByRole('button', { name: 'Dày', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Thực đơn' })).toHaveAttribute('data-density', 'dense');
  expect(await page.evaluate(() => localStorage.getItem('parkviet-pos:menu-density'))).toBe('dense');

  await popover.getByRole('switch', { name: 'Ảnh món' }).uncheck();
  await expect(page.getByRole('list', { name: 'Thực đơn' })).toHaveAttribute('data-images', 'false');

  await popover.getByRole('switch', { name: 'Âm báo khi quét' }).uncheck();
  expect(await page.evaluate(() => localStorage.getItem('parkviet-pos:scan-sounds'))).toBe('off');
});

test('the printer popover offers the automatic print of this device only', async ({ page }) => {
  await openCounter(page);
  await toolbar(page).getByRole('button', { name: 'Máy in' }).click();
  const popover = page.getByRole('dialog', { name: 'Máy in và mẫu in' });
  const auto = popover.getByRole('switch', { name: /Tự in hoá đơn sau khi thanh toán/ });
  await expect(auto).not.toBeChecked();
  await auto.check();
  expect(await page.evaluate(() => localStorage.getItem('parkviet-pos:auto-print:sale'))).toBe('on');
  await expect(popover.getByRole('link', { name: 'Hàng đợi in và in lại' })).toHaveAttribute('target', '_blank');
});

test('the toolbar folds to its button and stays folded after a reload', async ({ page }) => {
  await openCounter(page);
  await toolbar(page).getByRole('button', { name: 'Thu gọn thanh công cụ' }).click();
  await expect(toolbar(page).getByRole('button', { name: 'Máy in' })).toHaveCount(0);
  await page.reload();
  await expect(toolbar(page).getByRole('button', { name: 'Mở thanh công cụ' })).toBeVisible();
  await expect(toolbar(page).getByRole('button', { name: 'Máy in' })).toHaveCount(0);
  await toolbar(page).getByRole('button', { name: 'Mở thanh công cụ' }).click();
  await expect(toolbar(page).getByRole('button', { name: 'Máy in' })).toBeVisible();
});

test('toolbar buttons are icons only and show their name as a tooltip on keyboard focus', async ({ page }) => {
  await openCounter(page);
  const printer = toolbar(page).getByRole('button', { name: 'Máy in' });
  await expect(printer).toHaveText('Máy in');
  await expect(printer.locator('.tip')).toHaveCSS('opacity', '0');
  await printer.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(printer.locator('.tip')).toHaveCSS('opacity', '1');
  await expect(toolbar(page).locator('.toolbar-button-label')).toHaveCount(0);
});

test('the header keeps the logo, one context icon and compact status icons', async ({ page }, info) => {
  await openCounter(page);
  const header = page.locator('header.header');
  // A phone's header drops the logo to leave room for the icons.
  if (info.project.name !== 'mobile') await expect(header.getByRole('img', { name: 'ParkViet POS' })).toBeVisible();
  await expect(header.locator('.header-brand')).toHaveText('');
  await expect(header.locator('.pos-context-details > summary')).toHaveAccessibleName('Đổi chi nhánh / quầy');
  await expect(header.locator('.realtime-status .header-status-text')).toHaveCount(0);
  await expect(header.locator('.shift-status')).toHaveCount(1);
});
