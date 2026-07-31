import { expect, test } from '@playwright/test'

/**
 * Slice 0a smoke suite.
 *
 * Proves that the application boots, that the four shells render in isolation,
 * that the accessibility baseline is present, and that the security headers and
 * URL-hygiene rules established in Slice 0a actually hold at runtime.
 */

test.describe('application boots', () => {
  test('health endpoint reports the environment and never caches', async ({ request }) => {
    const response = await request.get('/api/health')

    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toContain('no-store')

    const body = (await response.json()) as { status: string; appEnv: string; timestamp: string }
    expect(body.status).toBe('ok')
    expect(body.appEnv).not.toBe('production')
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow()
  })

  test('health endpoint discloses no internal topology', async ({ request }) => {
    const raw = await (await request.get('/api/health')).text()

    // A public liveness probe must not become a reconnaissance tool.
    expect(raw).not.toContain('supabase.co')
    expect(raw).not.toContain('54322')
    expect(raw.toLowerCase()).not.toContain('version')
    expect(raw.toLowerCase()).not.toContain('database')
  })

  test('returns a correlation ID that a user could quote to support', async ({ request }) => {
    const response = await request.get('/api/health')
    const correlationId = response.headers()['x-correlation-id']

    expect(correlationId).toBeTruthy()
    expect(correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test('echoes an inbound correlation ID rather than replacing it', async ({ request }) => {
    const supplied = '11111111-2222-3333-4444-555555555555'
    const response = await request.get('/api/health', {
      headers: { 'x-correlation-id': supplied },
    })

    expect(response.headers()['x-correlation-id']).toBe(supplied)
  })
})

test.describe('security headers', () => {
  test('baseline headers are present on a page response', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers() ?? {}

    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['permissions-policy']).toContain('camera=(self)')
    expect(headers['x-powered-by']).toBeUndefined()
  })

  test('no Content-Security-Policy is advertised yet', async ({ page }) => {
    // Slice 0a deliberately ships no CSP rather than a permissive one that would
    // read as protection while providing none (Phase 6 §34.2). The nonce-based
    // policy lands in Slice 1; this test is inverted at that point.
    const response = await page.goto('/')

    expect(response?.headers()['content-security-policy']).toBeUndefined()
  })
})

test.describe('shells render in isolation', () => {
  const shells = [
    { path: '/', heading: /engineering foundation/i },
    { path: '/sign-in', heading: /sign in/i },
    { path: '/dashboard', heading: /resident dashboard/i },
    { path: '/staff', heading: /staff workspace/i },
    { path: '/platform', heading: /platform console/i },
  ]

  for (const shell of shells) {
    test(`${shell.path} renders one h1 and one main landmark`, async ({ page }) => {
      await page.goto(shell.path)

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(shell.heading)
      await expect(page.getByRole('main')).toHaveCount(1)
    })
  }
})

test.describe('accessibility baseline', () => {
  test('the skip link is the first focusable element and moves focus to main', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')

    const skipLink = page.getByRole('link', { name: /skip to main content/i })
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#main$/)
  })

  test('the focus indicator is visible and not suppressed', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')

    const outline = await page.evaluate(() => {
      const active = document.activeElement
      if (!active) return null
      const style = window.getComputedStyle(active)
      return { width: style.outlineWidth, style: style.outlineStyle }
    })

    expect(outline).not.toBeNull()
    expect(outline?.style).not.toBe('none')
    expect(parseFloat(outline?.width ?? '0')).toBeGreaterThanOrEqual(2)
  })

  test('pinch zoom is not disabled', async ({ page }) => {
    await page.goto('/')
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')

    expect(viewport).not.toContain('user-scalable=no')
    expect(viewport).not.toContain('maximum-scale=1')
  })
})

test.describe('URL hygiene', () => {
  test('no personal value is placed in a URL', async ({ page }) => {
    // P6-C-E: search terms, names and birthdates must never appear in a URL that
    // a resident could paste into a chat message. Slice 0a has no search screen,
    // so this asserts the baseline that later slices must not break.
    for (const path of ['/', '/sign-in', '/dashboard', '/staff', '/platform']) {
      await page.goto(path)
      expect(new URL(page.url()).search).toBe('')
    }
  })

  test('unknown routes return the tenant-neutral not-found page', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist')

    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/could not find that page/i)
    // The copy must not distinguish "does not exist" from "belongs to another
    // barangay" (Phase 4 §13.6).
    await expect(page.locator('body')).not.toContainText(/barangay|tenant|permission/i)
  })
})
