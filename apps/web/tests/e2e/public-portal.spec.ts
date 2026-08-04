import { expect, test } from '@playwright/test'

/**
 * Slice 3D — the public portal (US-UI-006).
 *
 * The point of this suite is what an ANONYMOUS visitor can and cannot reach.
 * Nothing here signs in; a test that needed a session would be testing a
 * different surface.
 *
 * 3A withheld the `anon` catalog grant deliberately, saying the decision
 * belonged with the surface that needed it. This is that surface, so these are
 * the assertions that decision has to survive.
 */

test.describe.configure({ timeout: 90_000 })

/** San Isidro; the seeded active tenant. */
const TENANT_A = 'a0000000-0000-4000-8000-000000000001'
/** A request that exists — no anonymous route may reach it. */
const A_REQUEST = 'f2000000-0000-4000-8000-000000000003'

test.describe('the public home page', () => {
  test('names the barangays without asking anyone to sign in', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/barangay documents/i)
    await expect(page.getByRole('link', { name: /san isidro \(test\)/i })).toBeVisible()
    // The placeholder it replaced is gone.
    await expect(page.getByText(/slice 0a/i)).toHaveCount(0)
  })

  test('offers sign-in as an invitation, not a wall', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /sign in to request a document/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /create an account/i })).toBeVisible()
  })
})

test.describe('the public catalog', () => {
  test('shows what a barangay issues to someone with no account', async ({ page }) => {
    await page.goto(`/catalog/${TENANT_A}`)

    await expect(page.getByRole('heading', { name: /documents from san isidro/i })).toBeVisible()
    await expect(page.getByText(/barangay clearance \(test\)/i).first()).toBeVisible()
  })

  test('marks every unconfirmed figure, exactly as the resident view does', async ({ page }) => {
    // The B-08 rule is not relaxed for the public: an anonymous visitor
    // planning a trip is precisely who a made-up fee would mislead.
    await page.goto(`/catalog/${TENANT_A}`)

    await expect(page.getByText(/not yet confirmed/i).first()).toBeVisible()
    await expect(page.getByRole('note').first()).toContainText(/has not confirmed its fees/i)
  })

  test('never publishes a withdrawn document', async ({ page }) => {
    await page.goto(`/catalog/${TENANT_A}`)
    await expect(page.getByText(/retired community tax/i)).toHaveCount(0)
  })

  test('distinguishes a fee nobody decided from a document that is free', async ({ page }) => {
    // Both halves of the null-is-not-zero rule, on the same page:
    //   • Business Permit Endorsement has fee_amount NULL — nobody decided;
    //   • Certificate of Indigency has fee_amount 0.00 — decided, and free.
    // Asserting "no ₱0.00 anywhere" would be wrong: it would demand the free
    // document hide a real answer.
    await page.goto(`/catalog/${TENANT_A}`)

    const undecided = page.getByRole('listitem').filter({ hasText: /business permit endorsement/i })
    // Two, not one: that type is seeded with a null fee AND a null SLA, and
    // both must read as undecided rather than as zero or "same day".
    await expect(undecided.getByText(/not set by the barangay yet/i)).toHaveCount(2)
    await expect(undecided.getByText('₱0.00')).toHaveCount(0)

    const free = page.getByRole('listitem').filter({ hasText: /certificate of indigency/i })
    await expect(free.getByText('₱0.00')).toBeVisible()
  })

  test('an unknown barangay is not found', async ({ page }) => {
    await page.goto('/catalog/a0000000-0000-4000-8000-0000000000ff')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/could not find that page/i)
  })
})

test.describe('the public surface reaches nothing else', () => {
  test('every authenticated route still bounces an anonymous visitor', async ({ page }) => {
    for (const path of [
      '/documents',
      '/requests',
      '/requests/new',
      `/requests/${A_REQUEST}`,
      '/staff/requests',
      `/staff/requests/${A_REQUEST}`,
      '/dashboard',
    ]) {
      await page.goto(path)
      await expect(page, `${path} must not be anonymously reachable`).toHaveURL(/\/sign-in$/)
    }
  })

  test('the public page carries no resident data of any kind', async ({ page }) => {
    await page.goto(`/catalog/${TENANT_A}`)
    const body = (await page.locator('body').textContent()) ?? ''

    // Seeded resident names and purposes must appear nowhere on a page that
    // anyone on the internet can open.
    for (const secret of ['Juan', 'Dela Cruz', 'Resident SanIsidro', 'Scholarship', 'Loan']) {
      expect(body, `"${secret}" must not appear on the public catalog`).not.toContain(secret)
    }
  })

  test('and puts nothing but an opaque id in its own URL', async ({ page }) => {
    await page.goto(`/catalog/${TENANT_A}`)
    const tail = new URL(page.url()).pathname.split('/').filter(Boolean).slice(1)
    for (const segment of tail) {
      expect(segment).toMatch(/^[0-9a-f-]{36}$/)
    }
  })
})
