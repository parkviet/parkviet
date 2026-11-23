import { defineConfig, devices } from '@playwright/test'

const port = process.env.POS_TEST_PORT || '5175'
const host = process.env.POS_LIVE_REVIEW === '1' ? 'localhost' : '127.0.0.1'

export default defineConfig({
  testDir: './e2e',
  workers: process.env.CI ? 2 : 4,
  timeout: process.env.CI ? 60_000 : 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://${host}:${port}`, trace: 'retain-on-failure' },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
    env: { POS_CABLE_PROXY: process.env.POS_LIVE_REVIEW === '1' ? 'on' : 'off' },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
})
