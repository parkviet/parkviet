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
}

const toolbar = (page: Page) => page.getByRole('region', { name: 'Công cụ bán hàng' });

test('the toolbar lists the tools that exist and no layout chooser yet', async ({ page }) => {
  await openCounter(page);
  const bar = toolbar(page);
  await expect(bar.getByRole('button', { name: 'Trợ giúp' })).toBeVisible();
  await expect(bar.getByRole('link', { name: 'Màn hình khách' })).toHaveAttribute('target', '_blank');
  await expect(bar.getByRole('button', { name: 'Máy in' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Cài đặt nhanh' })).toBeVisible();
  await expect(bar.getByRole('button', { name: /Chọn màn bán hàng/ })).toHaveCount(0);
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
  await page.locator('.pos-context-status').click();
  await expect(page.getByRole('dialog', { name: 'Cài đặt nhanh của máy này' })).toHaveCount(0);
});

test('quick settings change the menu tiles at once and are kept on this device', async ({ page }) => {
  await openCounter(page);
  await toolbar(page).getByRole('button', { name: 'Cài đặt nhanh' }).click();
  const popover = page.getByRole('dialog', { name: 'Cài đặt nhanh của máy này' });
  await popover.getByRole('button', { name: 'Dày', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Thực đơn' })).toHaveAttribute('data-density', 'dense');
  expect(await page.evaluate(() => localStorage.getItem('parkviet-pos:menu-density'))).toBe('dense');

  await popover.getByRole('checkbox', { name: 'Ảnh món' }).uncheck();
  await expect(page.getByRole('list', { name: 'Thực đơn' })).toHaveAttribute('data-images', 'false');

  await popover.getByRole('checkbox', { name: 'Âm báo khi quét' }).uncheck();
  expect(await page.evaluate(() => localStorage.getItem('parkviet-pos:scan-sounds'))).toBe('off');
});

test('the printer popover offers the automatic print of this device only', async ({ page }) => {
  await openCounter(page);
  await toolbar(page).getByRole('button', { name: 'Máy in' }).click();
  const popover = page.getByRole('dialog', { name: 'Máy in và mẫu in' });
  const auto = popover.getByRole('checkbox', { name: /Tự in hoá đơn sau khi thanh toán/ });
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
