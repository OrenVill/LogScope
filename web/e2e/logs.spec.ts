import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Basic smoke + accessibility check
test('search + expand lazy-load + accessibility smoke', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.log-table')).toBeVisible()

  // Ensure backend is available and has at least one log; seed if empty (CI can start with zero logs)
  const health = await page.request.get('http://localhost:3000/health').catch(() => null)
  if (!health || health.status() !== 200) test.skip('backend not available')

  const listRes = await page.request.get('http://localhost:3000/api/logs/search')
  let listJson = null
  try { listJson = await listRes.json() } catch (e) { /* ignore */ }

  if (!listRes.ok || !listJson?.data || listJson.data.length === 0) {
    // Seed a log so the UI has something to render
    const payload = {
      timestamp: new Date().toISOString(),
      level: 'info',
      subject: 'e2e-seed',
      message: `seed-${Date.now()}`,
      data: { seeded: true },
      source: { function: 'e2e', file: 'seed.ts', process: 'ci', runtime: 'browser', serviceName: 'e2e-service' },
      correlation: {},
    }
    const collect = await page.request.post('http://localhost:3000/api/logs/collect', { data: payload })
    expect(collect.ok()).toBeTruthy()
  }

  // Wait for table rows to render (longer timeout for slow CI)
  await page.waitForSelector('tbody tr', { timeout: 30000 })
  const firstRowToggle = page.locator('tbody tr').first().locator('td').first()
  await firstRowToggle.click()
  await expect(page.locator('.log-details')).toBeVisible()

  const accessibilityScan = await new AxeBuilder({ page }).analyze()
  if (accessibilityScan.violations.length > 0) {
    // log violations for debugging and attach to Playwright report
    console.log('Axe violations:', JSON.stringify(accessibilityScan.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => ({ target: n.target })) })), null, 2))
  }
  expect(accessibilityScan.violations.length).toBe(0)
})

// Real-time: post a new log to backend and assert it appears in the UI
test('real-time: new log appears when posted to backend', async ({ page }) => {
  await page.goto('/')

  // Check backend health; skip if backend not running
  const health = await page.request.get('http://localhost:3000/health').catch(() => null)
  if (!health || health.status() !== 200) test.skip('backend not available')

  // Read current top-row message (if any)
  const topMessageLocator = page.locator('tbody tr').first().locator('td').nth(4)

  // Post a new unique log
  const unique = `e2e-msg-${Date.now()}`
  const payload = {
    timestamp: new Date().toISOString(),
    level: 'info',
    subject: 'e2e-realtime',
    message: unique,
    data: { e2e: true },
    source: { function: 'e2e', file: 'e2e.ts', process: 'test', runtime: 'browser', serviceName: 'e2e-service' },
    correlation: { requestId: `req-${Date.now()}` },
  }

  const collect = await page.request.post('http://localhost:3000/api/logs/collect', { data: payload })
  expect(collect.ok()).toBeTruthy()

  // Wait for the UI to show the new message at top (WebSocket push)
  await page.waitForFunction((msg) => {
    const el = document.querySelector('tbody tr td:nth-child(5)')
    return el && el.textContent && el.textContent.includes(msg)
  }, unique, { timeout: 3000 })

  const afterText = await topMessageLocator.textContent()
  expect(afterText).toContain(unique)
})

// Correlation filter: create two logs with same requestId and filter by that requestId
test('correlation filter returns correlated logs', async ({ page }) => {
  await page.goto('/')

  const health = await page.request.get('http://localhost:3000/health').catch(() => null)
  if (!health || health.status() !== 200) test.skip('backend not available')

  const reqId = `corr-${Date.now()}`
  const msgs = [`c1-${Date.now()}`, `c2-${Date.now()}`]

  for (const m of msgs) {
    const payload = {
      timestamp: new Date().toISOString(),
      level: 'info',
      subject: 'e2e-corr',
      message: m,
      data: null,
      source: { function: 'e2e', file: 'e2e.ts', process: 'test', runtime: 'browser', serviceName: 'e2e-service' },
      correlation: { requestId: reqId },
    }
    const res = await page.request.post('http://localhost:3000/api/logs/collect', { data: payload })
    expect(res.ok()).toBeTruthy()
  }

  // Ensure we're in Historical mode (filter panel disabled when Real-time is on)
  const rtToggle = page.locator('#rtToggle')
  if (await rtToggle.isVisible() && await rtToggle.isChecked()) {
    await rtToggle.click()
    // wait for inputs to become enabled
    await page.waitForSelector('input[placeholder="Correlation ID"]:not([disabled])')
  }

  // Use filter panel to search by requestId
  await page.fill('input[placeholder="Correlation ID"]', reqId)
  await page.click('button:has-text("🔍 Search")')

  // Wait for results and assert both messages are present
  await page.waitForSelector('tbody tr')
  const tableText = await page.locator('tbody').innerText()
  expect(tableText).toContain(msgs[0])
  expect(tableText).toContain(msgs[1])
})

// Dark mode toggle
test('dark mode toggles data-bs-theme attribute', async ({ page }) => {
  await page.goto('/')
  const root = page.locator('div.app')
  await expect(root).toHaveAttribute('data-bs-theme', 'light')

  await page.click('button[title="Dark Mode"]')
  await expect(root).toHaveAttribute('data-bs-theme', 'dark')

  await page.click('button[title="Light Mode"]')
  await expect(root).toHaveAttribute('data-bs-theme', 'light')
})

// Copy data to clipboard for an expanded log
test('copy data button places JSON on clipboard', async ({ page }) => {
  await page.goto('/')

  const health = await page.request.get('http://localhost:3000/health').catch(() => null)
  if (!health || health.status() !== 200) test.skip('backend not available')

  // Post a log with data and wait for it to appear
  const unique = `copy-${Date.now()}`
  const payload = {
    timestamp: new Date().toISOString(),
    level: 'info',
    subject: 'e2e-copy',
    message: unique,
    data: { hello: 'world' },
    source: { function: 'e2e', file: 'e2e.ts', process: 'test', runtime: 'browser', serviceName: 'e2e-service' },
    correlation: {},
  }
  const res = await page.request.post('http://localhost:3000/api/logs/collect', { data: payload })
  expect(res.ok()).toBeTruthy()

  // Grant clipboard permissions in the context (Chromium supports this)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

  // Wait for the new log to appear then expand it
  await page.waitForFunction((msg) => {
    return !!Array.from(document.querySelectorAll('tbody tr td:nth-child(5)')).find(el => el.textContent && el.textContent.includes(msg))
  }, unique, { timeout: 3000 })

  // Find the row with our message and expand
  const rows = page.locator('tbody tr')
  const count = await rows.count()
  for (let i = 0; i < count; i++) {
    const cell = rows.nth(i).locator('td').nth(4)
    const text = await cell.textContent()
    if (text && text.includes(unique)) {
      // click expand arrow
      await rows.nth(i).locator('td').first().click()
      break
    }
  }

  // Click copy button in expanded details
  const copyBtn = page.locator('button[title="Copy data to clipboard"]').first()
  await expect(copyBtn).toBeVisible()
  await copyBtn.click()

  // Read clipboard and verify
  const clipboard = await page.evaluate(async () => navigator.clipboard.readText())
  expect(clipboard).toContain('"hello": "world"')
})