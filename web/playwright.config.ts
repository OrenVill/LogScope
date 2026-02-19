import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:5174',
    actionTimeout: 5000,
    trace: 'on-first-retry',
  },
  webServer: {
    // Use `vite dev` locally, but in CI build and serve the production preview (faster / more stable).
    command: process.env.CI ? 'npm run build && npm run preview -- --port 5174' : 'npm run dev',
    port: 5174,
    reuseExistingServer: true,
    timeout: 120_000, // wait up to 2m for server startup in slow CI environments
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})