import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end configuration (Phase 6 §20.3).
 *
 * Slice 0a runs a smoke suite only. The full journey suites — resident request,
 * staff approval, walk-in issuance, verification — are added with their slices.
 *
 * The dev server is started by Playwright itself so that `pnpm e2e` works from a
 * clean checkout without a second terminal. `reuseExistingServer` keeps a running
 * dev server if one is already up locally, but never in CI.
 */
/**
 * A dedicated port, not 3000. If the dev server finds its port occupied it
 * silently shifts to the next free one, and Playwright then waits on a URL that
 * never answers — a 2-minute timeout with no useful message. Pinning a port the
 * developer is unlikely to already be using avoids that, and the command below
 * passes it explicitly so the two can never disagree.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100)
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Serial in CI so a shared local Supabase stack is never contended.
  // Capped locally too: every worker shares ONE dev server doing on-demand
  // compilation and ONE database — unbounded parallelism turns cold-compile
  // latency into spurious navigation timeouts.
  workers: isCI ? 1 : 4,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    // Barangay staff work on low-end hardware over unreliable connections;
    // a generous action timeout avoids flaky failures masking real regressions.
    actionTimeout: 10_000,
  },

  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    // Residents are overwhelmingly mobile (Phase 2 §4.2), so mobile is a
    // first-class target, not an afterthought.
    { name: 'chromium-mobile', use: { ...devices['Pixel 5'] } },
  ],

  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    // The app builds its email-confirmation redirect from this value, so it
    // must name the port the suite actually serves on — otherwise the
    // confirmation link points at a dev server that is not running.
    env: { NEXT_PUBLIC_APP_URL: BASE_URL },
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
