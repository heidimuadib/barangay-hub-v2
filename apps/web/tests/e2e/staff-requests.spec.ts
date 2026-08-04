import { expect, test, type Page } from '@playwright/test'

/**
 * Slice 3C — the staff intake queue and the counter workflow.
 *
 * Requires the LOCAL Supabase stack with the Slice 1/2/3 seed fixtures.
 * Synthetic personas and synthetic catalog content only.
 *
 * The capability split under test is the roadmap's reason for two capabilities
 * rather than one: `barangay_staff` holds `requests.read` and
 * `requests.review` but NOT `requests.mark_ready` or
 * `requests.create_walk_in`; `barangay_administrator` holds all four. Every
 * assertion here is about the SCREEN — the database-level proof of the same
 * split lives in `supabase/tests/16_staff_request_queue`.
 *
 * The transition tests each drive a request they created themselves, because
 * a transition is one-way: reusing a seeded fixture would pass once and fail
 * on every re-run.
 */

const PASSWORD = 'password123-local'

const ACCOUNTS = {
  /** requests.read + requests.review, and neither of the other two. */
  staffA: 'staff.sanisidro@barangay-hub.test',
  /** All four request capabilities. */
  adminA: 'admin.sanisidro@barangay-hub.test',
  /** Verified resident — holds none of them. */
  residentA: 'resident.sanisidro@barangay-hub.test',
  /** Tenant B administration. */
  adminB: 'admin.malinis@barangay-hub.test',
} as const

const CLEARANCE = 'f0000000-0000-4000-8000-000000000001'
/** Juan Dela Cruz — a registry person with NO online account. */
const WALK_IN_PERSON = 'c0000000-0000-4000-8000-000000000004'
/** A seeded tenant-A request; tenant B must never open it. */
const TENANT_A_REQUEST = 'f2000000-0000-4000-8000-000000000003'

/**
 * `next dev` compiles each route on first request, so a cold navigation here
 * exceeds the 30s default at a different point on every machine. Same
 * reasoning as the 3B suite: this buys time, not tolerance.
 */
test.describe.configure({ timeout: 90_000 })

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(dashboard|staff|platform)$/)
}

/**
 * Required before switching persona: `/sign-in` bounces an already
 * authenticated visitor to their landing route, so the email field is simply
 * not there and the next `signIn` fails on a missing locator rather than on
 * anything meaningful.
 */
async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: /sign out/i }).click()
  await page.waitForURL(/\/sign-in$/, { timeout: 30_000 })
}

/**
 * Asserts a request reached a state, by RELOADING rather than by watching the
 * chip change in place.
 *
 * **R-1-06** (risk register): under a production server the client refetch
 * after a committed Server Action can lag, so the previous value stays
 * rendered. The mutation and its audit entry are always correct — only the
 * in-place render is stale, and reliably so only for the *first* mutation in a
 * page session, which is why an isolated run of these tests passes and a full
 * one does not.
 *
 * Reloading asks the SERVER, which always tells the truth. Wrapped in
 * `toPass` so the poll also covers the action still being in flight. This
 * tests our state machine, not Next.js's cache invalidation.
 */
async function expectStateAfterTransition(
  page: Page,
  requestId: string,
  state: string,
): Promise<void> {
  await expect(async () => {
    await page.goto(`/staff/requests/${requestId}`)
    await expect(page.getByText(state).first()).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 45_000 })
}

/**
 * Files and submits a request at the counter, returning its id.
 *
 * Drives the real screens rather than the API, because the counter journey IS
 * what 3C ships — and it gives every transition test a fresh request.
 */
async function fileWalkIn(page: Page, purpose: string): Promise<string> {
  await page.goto(`/staff/requests/new?person=${WALK_IN_PERSON}&type=${CLEARANCE}`)
  await page.getByLabel('Purpose').fill(purpose)
  await page.getByLabel(/years of residency/i).fill('30')
  await page.getByLabel(/intended use/i).selectOption('Loan')
  await page.getByLabel('Reason').fill('Requested at the counter, no online account (synthetic)')
  await page.getByRole('button', { name: /file and submit the request/i }).click()

  await page.waitForURL(/\/staff\/requests\/[0-9a-f-]{36}$/, { timeout: 30_000 })
  const requestId = page.url().split('/').pop() ?? ''
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  return requestId
}

test.describe('the intake queue', () => {
  test('shows the tenant queue with the requester, document and status', async ({ page }) => {
    await signIn(page, ACCOUNTS.staffA)
    await page.goto('/staff/requests')

    await expect(
      page.getByRole('heading', { name: /document requests — san isidro/i }),
    ).toBeVisible()
    // Seeded submitted/in-review requests are the default "needs action" view.
    await expect(page.locator('a[href^="/staff/requests/"]:visible').first()).toBeVisible()
  })

  test('filters by state, carrying only the state key in the URL', async ({ page }) => {
    await signIn(page, ACCOUNTS.staffA)
    await page.goto('/staff/requests')

    await page.getByRole('link', { name: 'In review' }).click()
    await expect(page).toHaveURL(/\/staff\/requests\?state=in_review$/)
    await expect(page.getByRole('link', { name: 'In review' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // Nothing personal is ever a parameter (P6-C-E).
    const url = decodeURIComponent(page.url()).toLowerCase()
    expect(url).not.toContain('juan')
    expect(url).not.toContain('dela cruz')
  })

  test('ignores an unknown filter rather than echoing it back', async ({ page }) => {
    await signIn(page, ACCOUNTS.staffA)
    await page.goto('/staff/requests?state=approved')

    // `approved` belongs to verification, not to requests — the parse fails
    // and the queue falls back to its default view.
    await expect(page.getByRole('link', { name: 'Needs action' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.locator('body')).not.toContainText('approved')
  })

  test('a resident is refused the staff queue entirely', async ({ page }) => {
    await signIn(page, ACCOUNTS.residentA)
    await page.goto('/staff/requests')
    await expect(page).toHaveURL(/\/(access-denied|dashboard)$/)
  })
})

test.describe('the capability split on the request detail', () => {
  test.describe.configure({ mode: 'serial' })

  test('staff may start a review but are never offered mark-ready', async ({ page }) => {
    // The counter filing needs the administrator; the review needs staff.
    await signIn(page, ACCOUNTS.adminA)
    const requestId = await fileWalkIn(page, `Split check (synthetic ${Date.now()})`)

    await signOut(page)
    await signIn(page, ACCOUNTS.staffA)
    await page.goto(`/staff/requests/${requestId}`)

    await expect(page.getByRole('button', { name: /start review/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /mark ready/i })).toHaveCount(0)

    await page.getByRole('button', { name: /start review/i }).click()
    await expectStateAfterTransition(page, requestId, 'in review')

    // Now in review, staff still cannot promise it is ready.
    await expect(page.getByRole('button', { name: /mark ready/i })).toHaveCount(0)
    await expect(page.getByText(/nothing for you to do/i)).toBeVisible()
  })

  test('an administrator can mark the same request ready', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminA)
    const requestId = await fileWalkIn(page, `Ready check (synthetic ${Date.now()})`)

    await page.goto(`/staff/requests/${requestId}`)
    await page.getByRole('button', { name: /start review/i }).click()
    await expectStateAfterTransition(page, requestId, 'in review')

    await page.getByRole('button', { name: /mark ready to collect/i }).click()
    await expectStateAfterTransition(page, requestId, 'ready for issue')
  })
})

test.describe('the counter workflow', () => {
  test('files a request for a person with no online account', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminA)

    const purpose = `Counter filing (synthetic ${Date.now()})`
    await fileWalkIn(page, purpose)

    // The detail records who it is for, how it arrived, and why staff acted.
    await expect(page.getByRole('heading', { name: /requester/i })).toBeVisible()
    await expect(page.getByText(/none — walk-in resident/i)).toBeVisible()
    await expect(page.getByText(/filed at the counter by staff/i)).toBeVisible()
    await expect(page.getByText(/no online account/i)).toBeVisible()
    await expect(page.getByText(purpose)).toBeVisible()

    // It is IN the queue, not stranded as a draft nobody can see.
    await expect(page.getByText('submitted').first()).toBeVisible()
  })

  test('is reachable from the resident’s registry record', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminA)
    await page.goto(`/staff/registry/${WALK_IN_PERSON}`)

    const cta = page.getByRole('link', { name: /file a document request/i })
    await expect(cta).toBeVisible()
    await cta.click()
    await expect(page).toHaveURL(new RegExp(`/staff/requests/new\\?person=${WALK_IN_PERSON}$`))
  })

  test('staff without the capability are offered no counter filing at all', async ({ page }) => {
    await signIn(page, ACCOUNTS.staffA)

    await page.goto(`/staff/registry/${WALK_IN_PERSON}`)
    await expect(page.getByRole('link', { name: /file a document request/i })).toHaveCount(0)

    await page.goto(`/staff/requests/new?person=${WALK_IN_PERSON}&type=${CLEARANCE}`)
    await expect(page).toHaveURL(/\/access-denied$/)
  })
})

test.describe('tenant isolation', () => {
  test('a tenant-B administrator cannot open a tenant-A request', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminB)

    // Indistinguishable from an id that exists nowhere — a different answer
    // would confirm the request is real in another barangay (Phase 4 §13.6).
    const real = await page.goto(`/staff/requests/${TENANT_A_REQUEST}`)
    const realStatus = real?.status()
    const realHeading = await page.getByRole('heading', { level: 1 }).textContent()

    const nowhere = await page.goto('/staff/requests/f2000000-0000-4000-8000-0000000000ff')
    expect(nowhere?.status()).toBe(realStatus)
    expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe(realHeading)
    expect(realHeading).toMatch(/could not find that page/i)
  })

  test('and sees none of tenant A in their own queue', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminB)
    await page.goto('/staff/requests')

    await expect(page.locator(`a[href="/staff/requests/${TENANT_A_REQUEST}"]`)).toHaveCount(0)
    // Their own queue, not tenant A's — asserted positively so a typo in the
    // negative check above cannot make this pass vacuously.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/malinis/i)
  })
})

test.describe('the staff request routes are private', () => {
  test('anonymous visitors are bounced to sign-in', async ({ page }) => {
    for (const path of ['/staff/requests', '/staff/requests/new']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/sign-in$/)
    }
  })
})
