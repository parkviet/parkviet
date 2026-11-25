import { readFileSync, writeFileSync } from 'node:fs';
import { expect, type Page, test, type TestInfo } from '@playwright/test';

// Isolated UI fixtures: no real account or financial writes.
async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (testInfo.project.name === 'desktop') {
    const html = await page.locator('main').first().evaluate((el) => el.outerHTML);
    const css = readFileSync('src/styles.css', 'utf8');
    writeFileSync(testInfo.outputPath(`${name}.html`), `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>POS UI fixture — no real transaction</title><style>${css}</style></head><body>${html}</body></html>`);
  }
}

test('login shares register styling, reveals password and handles pending / failed authentication', async ({ page }, testInfo) => {
  let release = () => {};
  await page.route('**/api/v3/admin/auth/login', async (route) => {
    await new Promise<void>((resolve) => { release = resolve; });
    await route.fulfill({ status: 401, json: { error: { code: 'unauthorized' } } });
  });
  await page.goto('/login');
  // The sign-in page is the split login layout with its own brand column; the register shell header is not rendered here.
  await expect(page.locator('.header')).toHaveCount(0);
  await expect(page.locator('span:visible', { hasText: 'Quản trị POS' }).first()).toBeVisible();
  const saleButton = page.getByRole('button', { name: 'Đăng nhập', exact: true });
  await expect(saleButton).toBeEnabled();
  await capture(page, testInfo, 'login');
  const password = page.getByLabel('Mật khẩu', { exact: true });
  await password.fill('fixture-only');
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ẩn mật khẩu' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByLabel('Email', { exact: true }).fill('staff@example.test');
  await saleButton.click();
  await expect(saleButton).toBeDisabled();
  release();
  await expect(page.getByRole('alert')).toContainText('Email hoặc mật khẩu không đúng');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('staff@example.test');
  await capture(page, testInfo, 'login-error');
});
