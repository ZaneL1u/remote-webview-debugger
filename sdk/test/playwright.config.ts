import { defineConfig, devices } from '@playwright/test'

// Two engines, two phones: WebKit as iPhone 15 (WKWebView-like) and
// Chromium as Pixel 7 (Android WebView-like). The mock gateway is started
// per worker by the fixtures (test/e2e/fixtures.ts).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    locale: 'zh-CN',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'webkit-iphone15', use: { ...devices['iPhone 15'] } },
    { name: 'chromium-pixel7', use: { ...devices['Pixel 7'] } },
  ],
})
