import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Slice 2C — staff registry and walk-in creation.
 *
 * Requires the LOCAL Supabase stack with the Slice 1 + 2 seed fixtures
 * (`pnpm db:start`, `pnpm db:reset`). Synthetic accounts and synthetic
 * residents only — the shared password is a documented local fixture, not a
 * secret, and no real resident data or identity document ever enters this
 * suite.
 *
 * The capability split under test is ADR-0006 §D2-04: `barangay_staff` holds
 * `registry.read` but NOT `registry.create_walk_in`; `barangay_administrator`
 * holds both. Every assertion here is about the SCREEN — the database-level
 * proof of the same split lives in `supabase/tests/08_registry_staff_surface`.
 */

const PASSWORD = 'password123-local'
const ACCOUNTS = {
  platform: 'platform.admin@barangay-hub.test',
  adminA: 'admin.sanisidro@barangay-hub.test',
  staffA: 'staff.sanisidro@barangay-hub.test',
  residentA: 'resident.sanisidro@barangay-hub.test',
  adminB: 'admin.malinis@barangay-hub.test',
} as const

/** A seeded tenant-A person; tenant B must never be able to open it. */
const TENANT_A_PERSON = 'c0000000-0000-4000-8000-000000000004'

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(dashboard|staff|platform)$/)
}

async function search(page: Page, term: string): Promise<void> {
  await page.getByLabel(/find a resident/i).fill(term)
  await page.getByRole('button', { name: /^search$/i }).click()
}

/**
 * Every row is rendered TWICE — once in the `sm:` table and once in the
 * narrow-screen card list — and the breakpoint hides one of them. This suite
 * runs on both a desktop and a Pixel 5 project, so row assertions must pick
 * whichever copy the current viewport actually shows rather than assuming a
 * document order.
 */
function visibleRow(scope: Locator | Page, text: string | RegExp): Locator {
  return scope.getByText(text).filter({ visible: true }).first()
}

test.describe('staff registry list', () => {
  test('lists the tenant roster with residency, account and verification state', async ({
    page,
  }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry')

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/san isidro/i)

    const list = page.getByRole('region', { name: /all residents/i })
    // Seeded tenant-A residents, spanning both source channels.
    await expect(visibleRow(list, 'Juan Dela Cruz (Test)')).toBeVisible()
    await expect(visibleRow(list, 'Resident SanIsidro (Test)')).toBeVisible()
    // The cross-tenant name twin (Malinis) must never appear here.
    await expect(list.getByText('Malinis')).toHaveCount(0)

    // Verification state is surfaced, not just identity.
    await expect(visibleRow(list, 'approved')).toBeVisible()
    // A walk-in is labelled as one — staff need to know a record has no account.
    await expect(visibleRow(list, 'walk-in')).toBeVisible()
  })

  test('reaches a person record through an opaque id and offers no evidence', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry')

    await page
      .getByRole('region', { name: /all residents/i })
      .getByRole('link', { name: 'Juan Dela Cruz (Test)' })
      .filter({ visible: true })
      .first()
      .click()

    // The URL carries a UUID and nothing else — no name, no birthdate.
    // Waited for explicitly: this is the first hit on the [personId] segment,
    // which the dev server compiles on demand, and that can outlast the 5s
    // default expect timeout.
    await page.waitForURL(/\/staff\/registry\/[0-9a-f-]{36}$/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Juan Dela Cruz (Test)')
    await expect(page.getByText(/recorded by staff \(walk-in\)/i)).toBeVisible()
    await expect(page.getByText(/no account linked/i)).toBeVisible()
    // Evidence documents are subpart 2F, behind their own capability.
    await expect(page.getByRole('link', { name: /evidence/i })).toHaveCount(0)
  })

  test('paginates using a page NUMBER as the only query parameter', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry?page=1')

    // Whether or not a second page exists with seed data, the contract holds:
    // the only parameter this route accepts is an integer page.
    const url = new URL(page.url())
    expect([...url.searchParams.keys()]).toEqual(['page'])
    expect(url.searchParams.get('page')).toMatch(/^\d+$/)
    await expect(page.getByRole('navigation', { name: /registry pages/i })).toBeVisible()
  })
})

test.describe('registry search — no PII in URLs (P6-C-E)', () => {
  test('finds a resident without the term ever entering the address or history', async ({
    page,
  }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry')

    const before = page.url()
    await search(page, 'Dela Cruz')

    await expect(page.getByText(/1 match\b/i)).toBeVisible()

    // THE central 2C privacy claim, asserted three ways.
    const after = page.url()
    expect(after).toBe(before)
    expect(after.toLowerCase()).not.toContain('dela')
    expect(after.toLowerCase()).not.toContain('cruz')
    expect(after).not.toContain('?q=')

    // Nor did the search push a history entry carrying the term.
    const historyUrls = await page.evaluate(() => [location.href, document.referrer])
    for (const entry of historyUrls) {
      expect(entry.toLowerCase()).not.toContain('cruz')
    }

    // Going back must not replay a search URL — there is none.
    await page.goBack()
    expect(page.url().toLowerCase()).not.toContain('cruz')
  })

  test('matches the accented duplicate pair and stays tenant-scoped', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry')

    // "maria santos" must reach BOTH the plain and accented tenant-A rows
    // (unaccent + trigram), and never tenant B's identical name.
    await search(page, 'maria santos')
    await expect(page.getByText(/2 matches/i)).toBeVisible()
    expect(page.url().toLowerCase()).not.toContain('maria')
  })

  test('shows an empty state for a term that matches nobody', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry')

    await search(page, 'zzzznotaresident')
    await expect(page.getByText(/no resident in this barangay matched/i)).toBeVisible()
    expect(page.url().toLowerCase()).not.toContain('zzzz')
  })

  test('guards the two-character floor before a round trip', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry')

    await page.getByLabel(/find a resident/i).fill('a')
    await expect(page.getByText(/type at least 2 characters/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^search$/i })).toBeDisabled()

    await page.getByLabel(/find a resident/i).fill('ab')
    await expect(page.getByRole('button', { name: /^search$/i })).toBeEnabled()
  })
})

test.describe('walk-in creation', () => {
  test('an administrator records a counter registration end to end', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry')

    await page.getByRole('link', { name: /add a walk-in resident/i }).click()
    await expect(page).toHaveURL(/\/staff\/registry\/new$/)

    const surname = `Walkin${Date.now()} (Test)`
    await page.getByLabel('First name').fill('Sinta')
    await page.getByLabel('Last name').fill(surname)
    await page.getByLabel(/house number and street/i).fill('12 Sampaguita St (synthetic)')
    await page.getByLabel(/how do they live/i).selectOption('renter')
    await page.getByLabel('Reason').fill('Registered at the counter, no email address (synthetic)')
    await page.getByRole('button', { name: /create resident record/i }).click()

    // This suite is re-runnable against a database it does not reset, and
    // `duplicate_candidates` matches on trigram similarity at 0.30 — so an
    // earlier run's "Sinta Walkin…" record legitimately trips the warning.
    // Acknowledging it IS the documented path for a genuinely new person, so
    // the test follows it rather than pretending a clean database.
    //
    // Settle on ONE of the two outcomes before branching: `isVisible()` is an
    // instantaneous read, so testing it directly after the click just races
    // the server action and always sees "not yet".
    const warning = page.getByRole('heading', { name: /possible existing records/i })
    const recorded = page.getByRole('heading', { name: /resident recorded/i })
    await expect(warning.or(recorded)).toBeVisible({ timeout: 15_000 })

    if (await warning.isVisible()) {
      await page.getByRole('checkbox').check()
      await page.getByRole('button', { name: /create anyway/i }).click()
    }

    await expect(page.getByRole('heading', { name: /resident recorded/i })).toBeVisible({
      timeout: 15_000,
    })
    // Created without an account — the whole point of the walk-in channel.
    await expect(page.getByText(/they have no online account/i)).toBeVisible()

    await page.getByRole('link', { name: /open the record/i }).click()
    await page.waitForURL(/\/staff\/registry\/[0-9a-f-]{36}$/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { level: 1 })).toContainText(surname)
    await expect(page.getByText(/no account linked/i)).toBeVisible()

    // Nothing about the new resident reached the address bar.
    expect(page.url()).not.toContain('Sinta')
    expect(page.url()).not.toContain('Walkin')
  })

  test('requires the audited reason before it will write', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry/new')

    await page.getByLabel('First name').fill('Noreason')
    await page.getByLabel('Last name').fill(`Case${Date.now()} (Test)`)
    await page.getByLabel(/how do they live/i).selectOption('renter')
    // Reason deliberately left blank.
    await page.getByRole('button', { name: /create resident record/i }).click()

    await expect(page.getByRole('heading', { name: /resident recorded/i })).toHaveCount(0)
  })

  test('demands an explanation when the residency basis is "other" (D2-01)', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry/new')

    await page.getByLabel(/how do they live/i).selectOption('other')
    // The explanation field appears only for the basis that requires it.
    await expect(page.getByLabel(/explain the arrangement/i)).toBeVisible()

    await page.getByLabel(/how do they live/i).selectOption('renter')
    await expect(page.getByLabel(/explain the arrangement/i)).toHaveCount(0)
  })
})

test.describe('duplicate candidates are a warning, never a merge', () => {
  test('pauses on a likely duplicate and refuses to merge anything', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry/new')

    // Matches the seeded duplicate pair on name AND birthdate.
    await page.getByLabel('First name').fill('Maria')
    await page.getByLabel('Last name').fill('Santos (Test)')
    await page.getByLabel(/date of birth/i).fill('1988-08-08')
    await page.getByLabel(/how do they live/i).selectOption('renter')
    await page.getByLabel('Reason').fill('Duplicate-warning check (synthetic)')
    await page.getByRole('button', { name: /create resident record/i }).click()

    // Warned, not merged, not created.
    await expect(page.getByRole('heading', { name: /possible existing records/i })).toBeVisible()
    await expect(
      page.getByText(/a matching name and birthdate is a hint, not proof/i),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: /resident recorded/i })).toHaveCount(0)

    // No merge/resolve affordance exists on this screen — resolution is 2E,
    // behind registry.resolve_duplicates.
    await expect(page.getByRole('button', { name: /merge/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /resolve/i })).toHaveCount(0)
    await expect(page.getByText(/nothing is merged here/i)).toBeVisible()

    // Proceeding requires a deliberate acknowledgement.
    const acknowledge = page.getByRole('checkbox')
    await expect(acknowledge).toBeVisible()
    await expect(page.getByRole('button', { name: /create anyway/i })).toBeVisible()

    // REGRESSION GUARD: the warning must not cost the clerk their typing.
    // React resets an uncontrolled form when its action resolves, which
    // silently emptied every field here and left "Create anyway" submitting a
    // blank record. The person is standing at the counter — retyping the form
    // to dismiss an advisory warning is not an acceptable answer.
    await expect(page.getByLabel('First name')).toHaveValue('Maria')
    await expect(page.getByLabel('Last name')).toHaveValue('Santos (Test)')
    await expect(page.getByLabel(/date of birth/i)).toHaveValue('1988-08-08')
    await expect(page.getByLabel('Reason')).toHaveValue('Duplicate-warning check (synthetic)')

    // Leaving without acknowledging must leave the pair exactly as it was.
    await page.goto('/staff/registry')
    await search(page, 'maria santos')
    await expect(page.getByText(/2 matches/i)).toBeVisible()
  })
})

test.describe('authorization', () => {
  test('barangay staff read the registry but are refused walk-in creation', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.staffA)

    await page.goto('/staff/registry')
    // registry.read → the list is theirs.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/resident registry/i)
    await expect(
      visibleRow(page.getByRole('region', { name: /all residents/i }), 'Juan Dela Cruz (Test)'),
    ).toBeVisible()

    // No create_walk_in → the affordance is absent...
    await expect(page.getByRole('link', { name: /add a walk-in resident/i })).toHaveCount(0)

    // ...and the route itself refuses, which is the control that matters.
    //
    // Waited for explicitly rather than asserted with `toHaveURL`: the server
    // redirect is real but can land after that matcher's 5s default on a
    // loaded machine, which turned a passing SECURITY control into recurring
    // noise. This waits on the navigation itself instead.
    await page.goto('/staff/registry/new')
    await page.waitForURL(/\/access-denied$/, { timeout: 30_000 })
  })

  test('an administrator is offered the walk-in affordance', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry')
    await expect(page.getByRole('link', { name: /add a walk-in resident/i })).toBeVisible()

    await page.goto('/staff/registry/new')
    await expect(page).toHaveURL(/\/staff\/registry\/new$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/add a walk-in resident/i)
  })

  test('a resident is refused the registry entirely', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.residentA)

    await page.goto('/staff/registry')
    await expect(page).toHaveURL(/\/access-denied$/)

    await page.goto('/staff/registry/new')
    await expect(page).toHaveURL(/\/access-denied$/)

    await page.goto(`/staff/registry/${TENANT_A_PERSON}`)
    await expect(page).toHaveURL(/\/access-denied$/)
  })

  test('a platform administrator holds no tenant registry access (ADR-0006 point 18)', async ({
    page,
  }) => {
    test.slow()
    await signIn(page, ACCOUNTS.platform)

    // Platform role carries NO barangay membership, so the staff shell refuses.
    await page.goto('/staff/registry')
    await expect(page).toHaveURL(/\/access-denied$/)

    await page.goto(`/staff/registry/${TENANT_A_PERSON}`)
    await expect(page).toHaveURL(/\/access-denied$/)
  })

  test('a tenant-B administrator cannot open a tenant-A record by id', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminB)

    // Admin B legitimately reaches THEIR registry.
    await page.goto('/staff/registry')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/malinis/i)

    // The property that matters is INDISTINGUISHABILITY (Phase 4 §13.6): a real
    // tenant-A id and an id that exists nowhere must produce the same answer,
    // or the difference between them is itself the disclosure.
    //
    // Asserted as an equality rather than a fixed 404 on purpose. This segment
    // inherits the Suspense boundary from `staff/registry/loading.tsx`, so the
    // response streams and its status is committed before `notFound()` runs —
    // both cases render the neutral page under a 200 in dev AND in a
    // production build. The status is therefore not the security property; the
    // absence of any difference is.
    const real = await page.goto(`/staff/registry/${TENANT_A_PERSON}`)
    const realStatus = real?.status()
    const realHeading = await page.getByRole('heading', { level: 1 }).textContent()

    const nowhere = await page.goto('/staff/registry/c0000000-0000-4000-8000-0000000000ff')
    expect(nowhere?.status()).toBe(realStatus)
    expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe(realHeading)

    // And the answer is the tenant-neutral not-found page, carrying nothing of
    // tenant A and no hint that the record exists elsewhere.
    expect(realHeading).toMatch(/could not find that page/i)
    await page.goto(`/staff/registry/${TENANT_A_PERSON}`)
    await expect(page.getByText('Juan Dela Cruz (Test)')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(/barangay|tenant|permission|denied/i)
  })
})

test.describe('presentation', () => {
  test('renders a table on wide viewports and cards on narrow ones', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/registry')

    const table = page.getByRole('table', { name: /residents in this barangay/i })

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(table).toBeVisible()

    // Below `sm` the four-column table would be unreadable, so it is replaced
    // by stacked cards carrying the same fields.
    await page.setViewportSize({ width: 380, height: 800 })
    await expect(table).toBeHidden()
    await expect(
      visibleRow(page.getByRole('region', { name: /all residents/i }), 'Juan Dela Cruz (Test)'),
    ).toBeVisible()
  })
})
