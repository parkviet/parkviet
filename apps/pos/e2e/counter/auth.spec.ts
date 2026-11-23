import { expect, test } from '@playwright/test'

test('login screen is Vietnamese and does not offer payment', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Chào mừng trở lại' })).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  const submit = page.getByRole('button', { name: 'Đăng nhập', exact: true })
  await expect(submit).toBeVisible()
  await page.getByLabel('Email', { exact: true }).focus()
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: /thu tiền|thanh toán|pay/i })).toHaveCount(0)
})
