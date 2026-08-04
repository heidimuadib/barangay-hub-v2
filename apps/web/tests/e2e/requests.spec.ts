import { expect, test, type Page } from '@playwright/test'

/**
 * Slice 3B — the resident document catalog and request intake.
 *
 * Requires the LOCAL Supabase stack with the Slice 1/2/3 seed fixtures.
 * Synthetic accounts and synthetic catalog content only — every fee,
 * turnaround and validity figure in this suite is INVENTED (blocker B-08),
 * which is exactly what several of these assertions are about.
 *
 * The journeys are re-runnable: each creates its OWN request rather than
 * driving a seeded one, because submission is a one-way transition and a
 * suite that passes once is not a suite.
 */

const PASSWORD = 'password123-local'

const ACCOUNTS = {
  /** Approved in San Isidro: the only persona that may file a request. */
  verified: 'resident.sanisidro@barangay-hub.test',
  /** ACTIVE member of San Isidro whose application is still `submitted`. */
  unverified: 'unverified.sanisidro@barangay-hub.test',
  /** Active member of Malinis (tenant B), with no person record. */
  otherTenant: 'resident.malinis@barangay-hub.test',
} as const

/** San Isidro catalog fixtures. */
const CLEARANCE = 'f0000000-0000-4000-8000-000000000001'
/** Withdrawn from service — residents must never see it. */
const RETIRED = 'f0000000-0000-4000-8000-000000000004'
/** Malinis's own type — San Isidro residents must never see it. */
const TENANT_B_TYPE = 'f0000000-0000-4000-8000-000000000011'
/** A request belonging to ANOTHER resident (person c0…01). */
const FOREIGN_REQUEST = 'f2000000-0000-4000-8000-000000000002'
/** Ids that exist nowhere, for the indistinguishability comparisons. */
const NO_SUCH_TYPE = 'f0000000-0000-4000-8000-0000000000ff'
const NO_SUCH_REQUEST = 'f2000000-0000-4000-8000-0000000000ff'

/**
 * Every test in this file gets the extended budget — 3× the 30s default, the
 * same multiplier `test.slow()` applies.
 *
 * Playwright drives `next dev`, which compiles each route on FIRST request.
 * Five new routes plus sign-in means a cold navigation here routinely exceeds
 * the default, and does so at a different point on every machine — the worst
 * kind of flake, because it looks like a product failure. The Slice 2 suites
 * reached the same conclusion and mark their journeys `test.slow()` one by
 * one; configuring the file once keeps it from being forgotten on the next
 * test added below.
 *
 * Set here rather than in a `beforeEach` calling `testInfo.slow()`: that hook
 * must take a destructuring pattern as its first argument, and an empty one
 * trips `no-empty-pattern`.
 *
 * This buys TIME, not tolerance: nothing here retries, and every assertion is
 * still an exact one.
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
 * Asserts that a real-but-unreachable id and an id that exists nowhere give
 * the SAME answer.
 *
 * The security property is indistinguishability (Phase 4 §13.6), not the
 * status code. These routes sit under a `loading.tsx` Suspense boundary, so
 * the response streams and its status is committed before `notFound()` runs —
 * both cases render the neutral page under a 200, in dev and in a production
 * build alike. Slice 2C reached the same conclusion for the registry; a fixed
 * 404 here would be testing Next.js's streaming, not our disclosure rule.
 */
async function indistinguishableFromNothing(
  page: Page,
  realPath: string,
  nowherePath: string,
): Promise<void> {
  const real = await page.goto(realPath)
  const realStatus = real?.status()
  const realHeading = await page.getByRole('heading', { level: 1 }).textContent()

  const nowhere = await page.goto(nowherePath)
  expect(nowhere?.status()).toBe(realStatus)
  expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe(realHeading)

  // And the shared answer discloses nothing at all.
  expect(realHeading).toMatch(/could not find that page/i)
  await expect(page.locator('body')).not.toContainText(/permission|denied|barangay hall/i)
}

/** Composes a fresh draft and returns the request id from its URL. */
async function createDraft(page: Page, purpose: string): Promise<string> {
  await page.goto(`/requests/new?type=${CLEARANCE}`)
  await page.getByLabel('Purpose').fill(purpose)
  await page.getByLabel(/years of residency/i).fill('12')
  await page.getByLabel(/intended use/i).selectOption('Employment')
  await page.getByRole('button', { name: /save my request/i }).click()

  await page.waitForURL(/\/requests\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  const requestId = page.url().split('/').pop() ?? ''
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  return requestId
}

test.describe('resident browses the catalog', () => {
  test('sees the active catalog, and never a withdrawn or foreign document', async ({ page }) => {
    await signIn(page, ACCOUNTS.verified)
    await page.goto('/documents')

    await expect(page.getByRole('heading', { name: /documents from san isidro/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /barangay clearance \(test\)/i })).toBeVisible()

    // The withdrawn type is staff-only; the Malinis type is another tenant's.
    await expect(page.getByRole('link', { name: /retired community tax/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /malinis/i })).toHaveCount(0)
  })

  test('every unconfirmed figure stays visibly marked (B-08 / RES-06)', async ({ page }) => {
    await signIn(page, ACCOUNTS.verified)
    await page.goto('/documents')

    // Every seeded type is placeholder-marked, so the chip must be on the page
    // and the explanation must accompany it.
    await expect(page.getByText(/not yet confirmed/i).first()).toBeVisible()
    await expect(page.getByRole('note').first()).toContainText(/has not confirmed its fees/i)
  })

  test('a document with no decided fee says so instead of showing zero', async ({ page }) => {
    await signIn(page, ACCOUNTS.verified)
    // Business Permit Endorsement is seeded with a NULL fee on purpose.
    await page.goto('/documents/f0000000-0000-4000-8000-000000000003')

    await expect(page.getByText(/not set by the barangay yet/i).first()).toBeVisible()
    await expect(page.getByText('₱0.00')).toHaveCount(0)
  })

  test('the detail page lists what will be asked before anything is started', async ({ page }) => {
    await signIn(page, ACCOUNTS.verified)
    await page.goto('/documents')
    await page.getByRole('link', { name: /barangay clearance \(test\)/i }).click()

    await expect(page).toHaveURL(new RegExp(`/documents/${CLEARANCE}$`))
    await expect(page.getByRole('heading', { name: /what you will be asked/i })).toBeVisible()
    await expect(page.getByText('Years of residency')).toBeVisible()
    await expect(page.getByText('Intended use')).toBeVisible()
    // The optional one is shown AS optional rather than hidden.
    await expect(page.getByText('Optional').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /request this document/i })).toBeVisible()
  })

  test('a withdrawn document is not reachable by id either', async ({ page }) => {
    await signIn(page, ACCOUNTS.verified)
    // Withdrawn and never-existed must be the same answer, or the difference
    // is itself a disclosure about the barangay's catalog.
    await indistinguishableFromNothing(page, `/documents/${RETIRED}`, `/documents/${NO_SUCH_TYPE}`)
  })
})

test.describe('resident request journey', () => {
  test.describe.configure({ mode: 'serial' })

  test('creates a draft, reviews it, and submits it to the barangay', async ({ page }) => {
    await signIn(page, ACCOUNTS.verified)

    const purpose = `Employment requirement (synthetic ${Date.now()})`
    const requestId = await createDraft(page, purpose)

    // The draft is the resident's own record and nothing has been sent yet.
    await expect(page.getByText(/draft — not sent/i)).toBeVisible()
    await expect(page.getByRole('region', { name: /why you need it/i })).toContainText(purpose)

    // Scoped to the answers region, by EXACT name. Two traps here: the purpose
    // text contains digits an unscoped getByText('12') matches, and `name`
    // matches as a SUBSTRING by default — so "Your answers" also selects the
    // draft's "Change your answers" form, whose select still holds an
    // <option>Employment</option>.
    const answers = page.getByRole('region', { name: 'Your answers', exact: true })
    await expect(answers.getByText('12', { exact: true })).toBeVisible()
    await expect(answers.getByText('Employment', { exact: true })).toBeVisible()

    // The terms stay marked on the request itself, not just in the catalog.
    await expect(page.getByText(/not yet confirmed/i).first()).toBeVisible()

    // Submit. The control is offered because every required answer exists.
    const submit = page.getByRole('button', { name: /submit to the barangay/i })
    await expect(submit).toBeEnabled()
    await submit.click()

    // Asserted by RELOADING rather than by watching the chip change in place.
    // R-1-06 (risk register): under a production server the client refetch
    // after a committed Server Action can lag, leaving the old value rendered
    // — and reliably only after the FIRST mutation in a page session, so an
    // isolated run passes and a full one does not. The server always tells the
    // truth. `toPass` also covers the action still being in flight.
    await expect(async () => {
      await page.goto(`/requests/${requestId}`)
      await expect(page.getByText(/waiting for review/i).first()).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 45_000 })

    // A submitted request is no longer editable, so the composition controls
    // are gone — the second submission the database refuses is not offered.
    await expect(page.getByRole('button', { name: /submit to the barangay/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /save answers/i })).toHaveCount(0)
  })

  test('refuses to submit until every required question is answered', async ({ page }) => {
    await signIn(page, ACCOUNTS.verified)

    // Answer only ONE of the two required questions.
    await page.goto(`/requests/new?type=${CLEARANCE}`)
    await page.getByLabel('Purpose').fill(`Incomplete draft (synthetic ${Date.now()})`)
    await page.getByLabel(/years of residency/i).fill('4')
    await page.getByRole('button', { name: /save my request/i }).click()

    // The form refuses before anything is created — the missing answer is
    // reported against its own field.
    await expect(page.getByText(/this answer is required/i).first()).toBeVisible()
    await expect(page).toHaveURL(/\/requests\/new/)
  })

  test('the resident sees their own request in their list', async ({ page }) => {
    await signIn(page, ACCOUNTS.verified)

    const purpose = `Listed request (synthetic ${Date.now()})`
    const requestId = await createDraft(page, purpose)

    await page.goto('/requests')
    await expect(page.getByRole('heading', { name: /my document requests/i })).toBeVisible()
    await expect(page.locator(`a[href="/requests/${requestId}"]`).first()).toBeVisible()

    // ...and on the dashboard, which US-RES-004 made real in this subpart.
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /my document requests/i })).toBeVisible()
  })
})

test.describe('a resident sees only their own requests', () => {
  test('another resident’s request is not found, not forbidden', async ({ page }) => {
    await signIn(page, ACCOUNTS.verified)

    // A real request belonging to someone else must be indistinguishable from
    // one that never existed — a "forbidden" would confirm the id is real.
    await indistinguishableFromNothing(
      page,
      `/requests/${FOREIGN_REQUEST}`,
      `/requests/${NO_SUCH_REQUEST}`,
    )
  })

  test('the list never contains a request the resident did not make', async ({ page }) => {
    await signIn(page, ACCOUNTS.verified)
    await page.goto('/requests')

    await expect(page.locator(`a[href="/requests/${FOREIGN_REQUEST}"]`)).toHaveCount(0)
    // The seeded foreign request is for the Certificate of Indigency; the
    // resident's own requests must not be mistaken for it.
    await expect(page.getByText(/scholarship application/i)).toHaveCount(0)
  })
})

test.describe('an unverified resident is refused', () => {
  test('may browse, but is told why they cannot request anything yet', async ({ page }) => {
    await signIn(page, ACCOUNTS.unverified)
    await page.goto('/documents')

    // Browsing is open to members — the catalog still renders.
    await expect(page.getByRole('link', { name: /barangay clearance \(test\)/i })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /registration is still being checked/i }),
    ).toBeVisible()
  })

  test('is offered no request control on the document detail', async ({ page }) => {
    await signIn(page, ACCOUNTS.unverified)
    await page.goto(`/documents/${CLEARANCE}`)

    await expect(page.getByRole('link', { name: /request this document/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /view my registration/i })).toBeVisible()
  })

  test('gets an explanation instead of a form at /requests/new', async ({ page }) => {
    await signIn(page, ACCOUNTS.unverified)
    await page.goto(`/requests/new?type=${CLEARANCE}`)

    await expect(
      page.getByRole('heading', { name: /registration is still being checked/i }),
    ).toBeVisible()
    // The form is not merely disabled — it is not rendered at all.
    await expect(page.getByLabel('Purpose')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /save my request/i })).toHaveCount(0)
  })
})

test.describe('tenant isolation', () => {
  test('another tenant’s resident sees neither the catalog nor the requests', async ({ page }) => {
    await signIn(page, ACCOUNTS.otherTenant)
    await page.goto('/documents')

    // Malinis has its own catalog; San Isidro's must not appear in it.
    await expect(page.getByRole('link', { name: /barangay clearance \(test\)$/i })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /documents from malinis/i })).toBeVisible()
  })

  test('a San Isidro document is not found from the other tenant', async ({ page }) => {
    await signIn(page, ACCOUNTS.otherTenant)
    await indistinguishableFromNothing(
      page,
      `/documents/${CLEARANCE}`,
      `/documents/${NO_SUCH_TYPE}`,
    )
  })

  test('and a San Isidro resident cannot open the other tenant’s document', async ({ page }) => {
    await signIn(page, ACCOUNTS.verified)
    await indistinguishableFromNothing(
      page,
      `/documents/${TENANT_B_TYPE}`,
      `/documents/${NO_SUCH_TYPE}`,
    )
  })
})

test.describe('URL hygiene (P6-C-E)', () => {
  test('no route carries anything but opaque identifiers', async ({ page }) => {
    await signIn(page, ACCOUNTS.verified)

    const purpose = `Sensitive purpose text (synthetic ${Date.now()})`
    const requestId = await createDraft(page, purpose)

    for (const url of [
      '/documents',
      `/documents/${CLEARANCE}`,
      `/requests/new?type=${CLEARANCE}`,
      '/requests',
      `/requests/${requestId}`,
    ]) {
      await page.goto(url)
      const current = decodeURIComponent(page.url()).toLowerCase()

      // Nothing identifying the person, and nothing they typed.
      expect(current).not.toContain('sensitive')
      expect(current).not.toContain('resident.sanisidro')
      expect(current).not.toContain('sanisidro (test)')
      expect(current).not.toContain('employment')
      // Every path segment beyond the route name is a bare UUID.
      const tail = new URL(page.url()).pathname.split('/').filter(Boolean).slice(1)
      for (const segment of tail) {
        expect(segment).toMatch(/^(new|[0-9a-f-]{36})$/)
      }
    }
  })
})

test.describe('the request routes are private', () => {
  test('anonymous visitors are bounced to sign-in', async ({ page }) => {
    for (const path of ['/documents', '/requests', '/requests/new']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/sign-in$/)
    }
  })
})
