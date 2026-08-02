import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Slice 2E — duplicate review and supersede-link resolution.
 *
 * Requires the LOCAL Supabase stack with the Slice 1 + 2 seed fixtures.
 * Synthetic residents only.
 *
 * The successful resolution mints its OWN duplicate pair (two walk-ins),
 * because a supersede is permanent: consuming the seeded Maria Santos pair
 * would make the suite pass once and break the other suites relying on it.
 * The REFUSAL cases use seeded personas instead — they change nothing, and
 * creating accounts would spend the public sign-up quota (10 per client
 * address / 15 minutes) the rest of the suite depends on.
 *
 * The policy under test is ADR-0006 §D2-02: candidates are signals, nothing
 * merges automatically, the survivor is an explicit administrator choice
 * with a written reason, and every refusal fails closed. The database-level
 * proof of the same matrix lives in `supabase/tests/10_duplicate_resolution`.
 */

const PASSWORD = 'password123-local'

const ACCOUNTS = {
  platform: 'platform.admin@barangay-hub.test',
  adminA: 'admin.sanisidro@barangay-hub.test',
  staffA: 'staff.sanisidro@barangay-hub.test',
  residentA: 'resident.sanisidro@barangay-hub.test',
  adminB: 'admin.malinis@barangay-hub.test',
} as const

/** Seeded tenant-A fixtures. */
const MARIA_PLAIN = 'c0000000-0000-4000-8000-000000000005'
const REJECTED_PERSON = 'c0000000-0000-4000-8000-000000000003'

async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(dashboard|staff|platform)$/, { timeout: 30_000 })
}

function visibleRow(scope: Locator | Page, text: string | RegExp): Locator {
  return scope.getByText(text).filter({ visible: true }).first()
}

/**
 * Creates a walk-in resident as the signed-in administrator and returns the
 * created record's URL. Acknowledges the advisory duplicate warning when it
 * appears — creating a LOOK-ALIKE is the point of these fixtures.
 */
async function createWalkIn(
  page: Page,
  firstName: string,
  lastName: string,
  birthdate: string,
): Promise<string> {
  await page.goto('/staff/registry/new')
  await page.getByLabel('First name').fill(firstName)
  await page.getByLabel('Last name').fill(lastName)
  await page.getByLabel(/date of birth/i).fill(birthdate)
  await page.getByLabel(/how do they live/i).selectOption('renter')
  await page.getByLabel('Reason').fill('Duplicate-resolution fixture (synthetic)')
  await page.getByRole('button', { name: /create resident record/i }).click()

  const warning = page.getByRole('heading', { name: /possible existing records/i })
  const recorded = page.getByRole('heading', { name: /resident recorded/i })
  await expect(warning.or(recorded)).toBeVisible({ timeout: 15_000 })
  if (await warning.isVisible()) {
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /create anyway/i }).click()
    await expect(recorded).toBeVisible({ timeout: 15_000 })
  }

  await page.getByRole('link', { name: /open the record/i }).click()
  await page.waitForURL(/\/staff\/registry\/[0-9a-f-]{36}$/, { timeout: 30_000 })
  return page.url()
}

/**
 * A fully RANDOM name, letters only. Timestamp-suffixed names are not enough
 * here: two different runs' surnames would share most of their trigrams
 * (`doble178…` vs `doble179…`), so earlier runs' pairs would come back as
 * search matches and resolution candidates. Random letters keep cross-run
 * similarity below the 0.30 floor while the within-run pair stays identical.
 */
function randomName(): string {
  const letters = (length: number) =>
    Array.from({ length }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')
  const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
  return `${cap(letters(5))} ${cap(letters(9))} (Test)`
}

function randomBirthdate(): string {
  const year = 1950 + Math.floor(Math.random() * 50)
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  return `${year}-${month}-${day}`
}

test.describe('duplicate resolution', () => {
  test('an administrator reviews a pair side by side and resolves it by supersede', async ({
    page,
  }) => {
    test.slow()
    const fullName = randomName()
    const [firstName = 'X', ...rest] = fullName.split(' ')
    const surname = rest.join(' ')
    const birthdate = randomBirthdate()
    await signIn(page, ACCOUNTS.adminA)

    // Fresh pair: same name, same birthdate — a strong two-signal match.
    await createWalkIn(page, firstName, surname, birthdate)
    const secondUrl = await createWalkIn(page, firstName, surname, birthdate)

    // ── Nothing merged automatically: both records exist, unresolved ───────
    // Assertions scoped to the SEARCH region: the page also lists the whole
    // roster below it, where earlier runs' resolved pairs legitimately show
    // superseded chips.
    const searchRegion = page.getByRole('region', { name: /search the registry/i })
    await page.goto('/staff/registry')
    await page.getByLabel(/find a resident/i).fill(surname)
    await page.getByRole('button', { name: /^search$/i }).click()
    await expect(searchRegion.getByText(/2 matches/i)).toBeVisible()
    await expect(searchRegion.getByText('superseded')).toHaveCount(0)

    // ── Side-by-side review on the second record ───────────────────────────
    await page.goto(secondUrl)
    await expect(page.getByRole('heading', { name: /possible duplicate records/i })).toBeVisible()
    await expect(page.getByText(/names are nearly identical/i)).toBeVisible()
    await expect(page.getByText(/same birthdate/)).toBeVisible()
    await expect(page.getByText(/signal, not proof of identity/i)).toBeVisible()
    await expect(page.getByText('This record')).toBeVisible()
    await expect(page.getByText('Candidate')).toBeVisible()

    // ── Resolve: explicit survivor, required reason, spelled consequences ──
    await page.getByRole('button', { name: /resolve as the same person/i }).click()
    await expect(page.getByText(/frozen, preserved, and pointing at the survivor/i)).toBeVisible()

    const confirm = page.getByRole('button', { name: /confirm: mark as the same person/i })
    await expect(confirm).toBeDisabled()

    // Keep the CANDIDATE (the first record): this record becomes superseded.
    await page.getByRole('radio', { name: /the candidate/i }).check()
    await page
      .getByLabel(/reason \(required\)/i)
      .fill('Recorded twice at the counter; same person (synthetic).')
    await confirm.click()

    // Assert the SETTLED state: the post-action refresh re-renders the page,
    // the record is now superseded, and the panel (with its transient success
    // message) unmounts — the banner is the durable proof.
    await expect(page.getByText(/this record was superseded/i)).toBeVisible({ timeout: 15_000 })

    // ── The superseded record links to its survivor ────────────────────────
    await page.goto(secondUrl)
    await expect(page.getByText(/this record was superseded/i)).toBeVisible()
    const survivorLink = page.getByRole('link', { name: fullName }).first()
    await expect(survivorLink).toBeVisible()

    // ── And the survivor shows the absorbed record ─────────────────────────
    await survivorLink.click()
    await page.waitForURL(/\/staff\/registry\/[0-9a-f-]{36}$/, { timeout: 30_000 })
    await expect(
      page.getByRole('heading', { name: /superseded records pointing here/i }),
    ).toBeVisible()

    // ── Search distinguishes the two ───────────────────────────────────────
    await page.goto('/staff/registry')
    await page.getByLabel(/find a resident/i).fill(surname)
    await page.getByRole('button', { name: /^search$/i }).click()
    await expect(searchRegion.getByText(/2 matches/i)).toBeVisible()
    await expect(visibleRow(searchRegion, 'superseded')).toBeVisible()

    // ── The audit trail shows the resolution, without names ────────────────
    await page.goto('/staff/audit')
    await expect(visibleRow(page, 'person.superseded')).toBeVisible()

    // ── URL hygiene held throughout ────────────────────────────────────────
    expect(secondUrl).toMatch(/\/staff\/registry\/[0-9a-f-]{36}$/)
    expect(secondUrl.toLowerCase()).not.toContain('isko')
  })

  test('staff see the comparison but hold no resolution control', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.staffA)

    // The seeded Maria Santos pair — read-only, so re-runs keep their fixture.
    await page.goto(`/staff/registry/${MARIA_PLAIN}`)
    await expect(page.getByRole('heading', { name: /possible duplicate records/i })).toBeVisible()
    await expect(page.getByText(/names are nearly identical/i)).toBeVisible()
    await expect(page.getByText(/can compare but not resolve/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /resolve as the same person/i })).toHaveCount(0)
  })

  test('both-accounts and open-application pairs are refused, fail closed', async ({ page }) => {
    test.slow()
    // Built entirely from SEEDED personas, deliberately: both paths below
    // REFUSE, so nothing is consumed and the test is re-runnable — and
    // minting an account here would spend the public sign-up quota (10 per
    // client address / 15 minutes) that the rest of the suite needs.
    //
    //   c3 "Applicant Rejected (Test)" — account u12, TERMINAL application
    //   c1 "Applicant One (Test)"      — account u10, OPEN submitted one
    //
    // Their shared "Applicant … (Test)" shape makes them mutual candidates.
    await signIn(page, ACCOUNTS.adminA)
    await page.goto(`/staff/registry/${REJECTED_PERSON}`)
    await expect(page.getByRole('heading', { name: /possible duplicate records/i })).toBeVisible()

    // Scope every interaction to the Applicant One card — the page lists one
    // labelled article per candidate, each with its own form.
    const card = page.getByRole('article', { name: 'Applicant One (Test)' })
    await card.getByRole('button', { name: /resolve as the same person/i }).click()

    // Proactive warning: both sides have linked accounts.
    await expect(card.getByText(/both records have linked accounts/i)).toBeVisible()

    // Survivor = the candidate (c1) → loser = c3, which has an account but no
    // OPEN application, so the two-account rule is what refuses.
    await card.getByRole('radio', { name: /the candidate/i }).check()
    await card.getByLabel(/reason \(required\)/i).fill('Refusal check (synthetic).')
    await card.getByRole('button', { name: /confirm: mark as the same person/i }).click()
    await expect(
      card.getByRole('alert').filter({ hasText: /both records have linked/i }),
    ).toBeVisible({ timeout: 15_000 })

    // REGRESSION GUARD: the refusal must not wipe the typed reason — an
    // uncontrolled textarea would be reset by React when the action resolved,
    // and native validation would then block the retry silently.
    await expect(card.getByLabel(/reason \(required\)/i)).toHaveValue('Refusal check (synthetic).')

    // Survivor = this record (c3) → loser = c1, whose application is OPEN:
    // the live-review rule refuses first, ahead of the account rule.
    await card.getByRole('radio', { name: /this record/i }).check()
    await card.getByRole('button', { name: /confirm: mark as the same person/i }).click()
    await expect(
      card.getByRole('alert').filter({ hasText: /open verification application/i }),
    ).toBeVisible({ timeout: 15_000 })

    // Fail closed means NOTHING changed, on either record.
    await page.goto(`/staff/registry/${REJECTED_PERSON}`)
    await expect(page.getByText(/this record was superseded/i)).toHaveCount(0)
    await page.goto('/staff/registry/c0000000-0000-4000-8000-000000000001')
    await expect(page.getByText(/this record was superseded/i)).toHaveCount(0)
  })
})

test.describe('authorization', () => {
  test('a resident and a platform administrator are refused the surface', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.residentA)
    await page.goto(`/staff/registry/${MARIA_PLAIN}`)
    await expect(page).toHaveURL(/\/access-denied$/)

    // Sign out before the next persona: with a live session, /sign-in simply
    // redirects to the dashboard and the form never appears. The access-denied
    // shell carries no sign-out control, so go somewhere that does.
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /sign out/i }).click()
    await page.waitForURL(/\/sign-in$/, { timeout: 30_000 })

    await signIn(page, ACCOUNTS.platform)
    await page.goto(`/staff/registry/${MARIA_PLAIN}`)
    await expect(page).toHaveURL(/\/access-denied$/)
  })

  test('a tenant-B administrator cannot even see a tenant-A pair', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminB)

    await page.goto(`/staff/registry/${MARIA_PLAIN}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/could not find that page/i)
    await expect(page.getByText(/santos/i)).toHaveCount(0)
  })
})
