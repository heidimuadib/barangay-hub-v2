import { expect, test, type Page } from '@playwright/test'

/**
 * UI-B — the application shells, in a real browser.
 *
 * The unit tests pin the shells' logic against jsdom, which has no layout: it
 * cannot tell whether the sidebar is actually on screen at 1280px and gone at
 * 393px, whether anything overflows the viewport, or whether the drawer really
 * covers the page. Those are the properties checked here.
 *
 * Both projects run this file. `wide` branches where desktop and mobile are
 * genuinely supposed to differ, rather than skipping either one — the point of
 * a responsive shell is that both halves work.
 */

const PASSWORD = 'password123-local'
const ACCOUNTS = {
  adminA: 'admin.sanisidro@barangay-hub.test',
  residentA: 'resident.sanisidro@barangay-hub.test',
  /** Console access with NO tenant membership — Slice 1 seeds. */
  platformAdmin: 'platform.admin@barangay-hub.test',
} as const

/** The shell breakpoint: a persistent sidebar from `lg` (1024px) upwards. */
function isWide(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1024
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(dashboard|staff|platform)$/, { timeout: 30_000 })
}

/**
 * Nothing may push the page sideways. A shell that overflows horizontally is
 * the classic failure of squeezing a desktop sidebar into a phone, and it is
 * invisible in a unit test.
 */
async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth }
  })
  expect(
    overflow.scrollWidth,
    `${label}: page is ${overflow.scrollWidth}px wide in a ${overflow.clientWidth}px viewport`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1)
}

test.describe('staff shell', () => {
  test('shows a persistent sidebar on desktop and a drawer trigger on mobile', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminA)

    const nav = page.getByRole('navigation', { name: 'Main' })
    const trigger = page.getByRole('button', { name: /open navigation menu/i })

    if (isWide(page)) {
      await expect(nav.first()).toBeVisible()
      // A trigger for an always-visible sidebar is noise.
      await expect(trigger).toBeHidden()
    } else {
      // The desktop sidebar must not merely be narrower on a phone — it is gone,
      // and the drawer replaces it.
      await expect(trigger).toBeVisible()
      const box = await trigger.boundingBox()
      expect(
        box?.height ?? 0,
        'the menu trigger meets the 44px touch target',
      ).toBeGreaterThanOrEqual(44)
    }

    await assertNoHorizontalOverflow(page, 'staff workspace')
  })

  test('marks the current module and moves the mark on navigation', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminA)

    if (!isWide(page)) {
      await page.getByRole('button', { name: /open navigation menu/i }).click()
    }

    const dashboard = page.getByRole('link', { name: 'Dashboard' }).first()
    await expect(dashboard).toHaveAttribute('aria-current', 'page')

    await page.getByRole('link', { name: 'Registry' }).first().click()
    await page.waitForURL(/\/staff\/registry$/)

    if (!isWide(page)) {
      // The drawer closes itself after a choice — legacy left it covering the
      // page it had just navigated to.
      await expect(page.getByRole('dialog')).toBeHidden()
      await page.getByRole('button', { name: /open navigation menu/i }).click()
    }

    await expect(page.getByRole('link', { name: 'Registry' }).first()).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('link', { name: 'Dashboard' }).first()).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('keeps the parent module current on a detail route', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry/c0000000-0000-4000-8000-000000000004')

    if (!isWide(page)) {
      await page.getByRole('button', { name: /open navigation menu/i }).click()
    }

    await expect(page.getByRole('link', { name: 'Registry' }).first()).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('a staff listing route does not overflow its viewport', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await assertNoHorizontalOverflow(page, 'staff registry')
  })
})

test.describe('mobile navigation drawer', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, 'desktop has no drawer')

  test('opens, traps focus, and closes on Escape returning focus to the trigger', async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.adminA)

    const trigger = page.getByRole('button', { name: /open navigation menu/i })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Navigation menu' })
    await expect(dialog).toBeVisible()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    // Focus is inside the panel, not stranded on the trigger behind the scrim.
    const focusInside = await dialog.evaluate((node) => node.contains(document.activeElement))
    expect(focusInside, 'focus moves into the drawer').toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('closes from its own close control', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminA)

    await page.getByRole('button', { name: /open navigation menu/i }).click()
    await page.getByRole('button', { name: /close navigation menu/i }).click()

    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('does not let the page behind it scroll', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry')

    await page.getByRole('button', { name: /open navigation menu/i }).click()
    const overflow = await page.evaluate(() => document.body.style.overflow)
    expect(overflow, 'body scroll is locked while the drawer is open').toBe('hidden')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    const restored = await page.evaluate(() => document.body.style.overflow)
    expect(restored, 'body scroll is restored on close').not.toBe('hidden')
  })

  test('does not overflow the viewport while open', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminA)
    await page.getByRole('button', { name: /open navigation menu/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await assertNoHorizontalOverflow(page, 'drawer open')
  })
})

test.describe('resident shell', () => {
  test('carries the same navigation without the staff modules', async ({ page }) => {
    await signIn(page, ACCOUNTS.residentA)

    if (!isWide(page)) {
      await page.getByRole('button', { name: /open navigation menu/i }).click()
    }

    await expect(page.getByRole('link', { name: 'Documents' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'My requests' }).first()).toBeVisible()
    // A resident with no staff capability is offered no staff console.
    await expect(page.getByRole('link', { name: 'Staff workspace' })).toHaveCount(0)

    await assertNoHorizontalOverflow(page, 'resident dashboard')
  })
})

test.describe('platform shell', () => {
  test('states in words that it is not a barangay tenant context', async ({ page }) => {
    await signIn(page, ACCOUNTS.platformAdmin)

    // The near-black sidebar is the glance-level cue, but colour alone cannot
    // carry this: an operator moving fast between two tabs must be told.
    await expect(page.getByText(/tenant administration only/i)).toBeVisible()
    await expect(page.getByText(/no barangay resident data is shown here/i)).toBeVisible()

    await assertNoHorizontalOverflow(page, 'platform console')
  })

  test('offers no barangay module navigation', async ({ page }) => {
    await signIn(page, ACCOUNTS.platformAdmin)

    if (!isWide(page)) {
      await page.getByRole('button', { name: /open navigation menu/i }).click()
    }

    for (const label of ['Registry', 'Verification', 'Requests', 'Members', 'Audit log']) {
      await expect(
        page.getByRole('link', { name: label }),
        `platform offers no ${label}`,
      ).toHaveCount(0)
    }
  })
})

test.describe('public shell', () => {
  test('is a portal, not the console', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()
    await expect(page.getByRole('link', { name: /^sign in$/i }).first()).toBeVisible()

    // No application navigation of any kind for someone who has never signed in.
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /open navigation menu/i })).toHaveCount(0)

    await assertNoHorizontalOverflow(page, 'public home')
  })
})
