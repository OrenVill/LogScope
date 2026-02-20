import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// ESM-safe __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load repo-level .env (so PLAYWRIGHT can see PORT if configured)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

// Backend port used by e2e tests (falls back to 3000)
const BACKEND_PORT = process.env.PORT || process.env.BACKEND_PORT || '3000'
const BACKEND_BASE = `http://127.0.0.1:${BACKEND_PORT}`
const BACKEND_HEALTH = `${BACKEND_BASE}/health`

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
    // Start frontend dev server and ensure backend health is reachable before tests.
    // The backend is only started if the health endpoint does not respond (prevents EADDRINUSE).
    command: process.env.CI
      ? `sh -c "VITE_API_URL=${BACKEND_BASE} npm run build && VITE_API_URL=${BACKEND_BASE} npm run preview -- --port 5174 & if ! curl -sSf ${BACKEND_HEALTH} >/dev/null 2>&1; then (cd ../server && npm run build && NODE_ENV=production node dist/index.js &) ; fi; sleep 0.5"`
      : `sh -c "if ! curl -sSf ${BACKEND_HEALTH} >/dev/null 2>&1; then (cd ../server && npm run dev &) ; fi ; VITE_API_URL=${BACKEND_BASE} npm run dev"`,
    port: 5174,
    reuseExistingServer: true,
    timeout: 120_000, // wait up to 2m for server startup in slow CI environments
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})