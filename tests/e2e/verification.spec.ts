import { readFileSync } from 'node:fs'

import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Slice 2D — verification queue and decision workflow.
 *
 * Requires the LOCAL Supabase stack with the Slice 1 + 2 seed fixtures.
 * Synthetic accounts and synthetic residents only — no real resident data and
 * no identity documents anywhere in this suite.
 *
 * The capability split under test is ADR-0006 §D2-04: `barangay_staff` holds
 * `verification.read` / `.review` / `.request_information` but NOT
 * `.approve` / `.reject`; `barangay_administrator` holds all of them. Every
 * assertion here is about the SCREEN — the database-level proof of the same
 * split lives in `supabase/tests/09_verification_workflow`.
 *
 * The decision tests each mint their OWN application through the resident
 * sign-up journey, because a decision is terminal: reusing a seeded fixture
 * would make the suite pass once and fail on every re-run.
 */

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
const PASSWORD = 'password123-local'
const SIGNUP_PASSWORD = 'a-sufficiently-long-passphrase'

const ACCOUNTS = {
  platform: 'platform.admin@barangay-hub.test',
  adminA: 'admin.sanisidro@barangay-hub.test',
  staffA: 'staff.sanisidro@barangay-hub.test',
  residentA: 'resident.sanisidro@barangay-hub.test',
  adminB: 'admin.malinis@barangay-hub.test',
} as const

/** A seeded tenant-A application; tenant B must never be able to open it. */
const TENANT_A_APPLICATION = 'd0000000-0000-4000-8000-000000000001'

function freshEmail(): string {
  return `verify-${Date.now()}-${Math.floor(Math.random() * 10000)}@barangay-hub.test`
}

/** Playwright does not load `.env.local`; CI exports the same names directly. */
function localEnv(name: string): string {
  const fromProcess = process.env[name]
  if (fromProcess) return fromProcess
  try {
    const line = readFileSync('.env.local', 'utf8')
      .split('\n')
      .find((entry) => entry.startsWith(`${name}=`))
    if (line) return line.slice(name.length + 1).trim()
  } catch {
    // Falls through to the explicit failure below.
  }
  throw new Error(`${name} is required for this suite (process env or .env.local)`)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'

/** A 1x1 PNG. Synthetic by construction — no real document, ever. */
const SYNTHETIC_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

/**
 * The resident's own access token, read from the session cookie `@supabase/ssr`
 * writes (chunked when large).
 */
async function accessTokenFor(page: Page): Promise<string> {
  const cookies = await page.context().cookies()
  const chunks = cookies
    .filter((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (chunks.length === 0) throw new Error('No Supabase auth cookie on this browser context')

  let raw = chunks.map((cookie) => decodeURIComponent(cookie.value)).join('')
  if (raw.startsWith('base64-')) {
    raw = Buffer.from(raw.slice('base64-'.length), 'base64').toString('utf8')
  }
  const session = JSON.parse(raw) as { access_token?: string }
  if (!session.access_token) throw new Error('Auth cookie carried no access token')
  return session.access_token
}

/**
 * Attaches the minimum evidence and submits, AS THE RESIDENT, through the same
 * granted RPCs and Storage policies the 2F browser flow uses.
 *
 * This is a FIXTURE shortcut, not a coverage claim: the real browser upload
 * journey is proven in `evidence.spec.ts`. Here it just gets an application
 * into `submitted` cheaply so the 2D decision workflow has something to
 * review — on the resident's own token throughout, so no service-role
 * shortcut and no direct table write are involved.
 *
 * Since 2F, metadata alone is not enough: `confirm_evidence_upload` reads
 * `storage.objects` and `submit_verification` requires FINALIZED items, so
 * this uploads real (synthetic) bytes. A 1×1 PNG — nothing resembling a
 * document, let alone a real one (DEC-ENV-04).
 */
async function submitOwnApplication(page: Page): Promise<void> {
  const token = await accessTokenFor(page)
  const anonKey = localEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  // Column list passed as a request param, not interpolated: a `select=` inside
  // a template literal reads as raw SQL to the Phase 6 §15.4 lint guard.
  const listed = await page.request.get(`${SUPABASE_URL}/rest/v1/verification_applications`, {
    headers,
    params: { select: 'id,state' },
  })
  expect(listed.ok(), 'the resident can read their own application').toBeTruthy()
  const applications = (await listed.json()) as { id: string; state: string }[]
  const application = applications[0]
  if (!application) throw new Error('Onboarding did not open an application')

  for (const [kind, mime] of [
    ['identity', 'image/png'],
    ['residency', 'application/pdf'],
  ] as const) {
    const added = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/add_evidence_metadata`, {
      headers,
      data: {
        p_application_id: application.id,
        p_kind: kind,
        p_mime_type: mime,
        p_declared_size_bytes: SYNTHETIC_BYTES.byteLength,
      },
    })
    expect(added.ok(), `evidence metadata (${kind}) accepted`).toBeTruthy()
    const rows = (await added.json()) as { evidence_id: string; storage_path: string }[]
    const row = rows[0]
    if (!row) throw new Error('add_evidence_metadata returned no row')

    // Slice 2F: the object must genuinely EXIST before it can be finalized —
    // `confirm_evidence_upload` reads storage.objects and takes the size from
    // there. Uploaded on the resident's own token, so the Storage INSERT
    // policy authorizes it exactly as the browser flow does.
    const uploaded = await page.request.post(
      `${SUPABASE_URL}/storage/v1/object/verification-evidence/${row.storage_path}`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'content-type': mime },
        data: SYNTHETIC_BYTES,
      },
    )
    expect(uploaded.ok(), `synthetic ${kind} object uploaded`).toBeTruthy()

    const finalized = await page.request.post(
      `${SUPABASE_URL}/rest/v1/rpc/confirm_evidence_upload`,
      {
        headers,
        data: {
          p_evidence_id: row.evidence_id,
          p_content_hash: '0'.repeat(64),
        },
      },
    )
    expect(finalized.ok(), `${kind} evidence finalized`).toBeTruthy()
  }

  const submitted = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/submit_verification`, {
    headers,
    data: { p_application_id: application.id },
  })
  expect(submitted.ok(), 'the resident submits their own application').toBeTruthy()
}

async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(dashboard|staff|platform)$/, { timeout: 30_000 })
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: /sign out/i }).click()
  await page.waitForURL(/\/sign-in$/, { timeout: 30_000 })
}

/** Rows render twice (table + cards); pick whichever the viewport shows. */
function visibleRow(scope: Locator | Page, text: string | RegExp): Locator {
  return scope.getByText(text).filter({ visible: true }).first()
}

async function confirmationLinkFor(page: Page, email: string): Promise<string> {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const list = await page.request.get(`${MAILPIT}/api/v1/messages?limit=50`)
    if (list.ok()) {
      const body = (await list.json()) as {
        messages?: { ID: string; To?: { Address: string }[] }[]
      }
      const match = body.messages?.find((message) =>
        message.To?.some((recipient) => recipient.Address.toLowerCase() === email.toLowerCase()),
      )
      if (match) {
        const detail = await page.request.get(`${MAILPIT}/api/v1/message/${match.ID}`)
        const message = (await detail.json()) as { Text?: string; HTML?: string }
        const source = `${message.Text ?? ''}\n${message.HTML ?? ''}`
        const link = /https?:\/\/[^\s"'<>]+/g
          .exec(source.replace(/&amp;/g, '&'))?.[0]
          ?.replace(/[).,]+$/, '')
        if (link) return link
      }
    }
    await page.waitForTimeout(500)
  }
  throw new Error(`No confirmation email arrived for ${email}`)
}

/**
 * Creates a confirmed resident account with a fresh onboarded person, and
 * leaves the browser signed in as them. Returns the credentials so the test
 * can come back as this resident later.
 */
async function createOnboardedResident(page: Page, surname: string): Promise<{ email: string }> {
  const email = freshEmail()

  await page.goto('/sign-up')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(SIGNUP_PASSWORD)
  await page.getByLabel('Confirm password').fill(SIGNUP_PASSWORD)
  await page.getByRole('button', { name: /create account/i }).click()
  await expect(page.getByRole('status')).toBeVisible({ timeout: 15_000 })

  const link = await confirmationLinkFor(page, email)
  await page.goto(link)
  await page.waitForURL(/\/(dashboard|onboarding|sign-in)$/, { timeout: 30_000 })

  // Decide whether a sign-in is needed by NAVIGATING and seeing where we land,
  // rather than reading the URL straight after the callback: the confirmation
  // redirect can still be settling, so a URL sampled there may say /sign-in a
  // moment before the session makes that route bounce to /dashboard.
  await page.goto('/onboarding')
  if (/\/sign-in$/.test(page.url())) {
    await signIn(page, email, SIGNUP_PASSWORD)
    await page.goto('/onboarding')
  }
  await page.waitForURL(/\/onboarding$/, { timeout: 30_000 })
  await page.getByLabel(/which barangay/i).selectOption({ label: 'San Isidro (Test)' })
  await page.getByLabel('First name').fill('Bagong')
  await page.getByLabel('Last name').fill(surname)
  await page.getByLabel(/how do you live/i).selectOption('renter')
  await page.getByRole('button', { name: /save and continue/i }).click()
  await page.waitForURL(/\/verification$/, { timeout: 30_000 })

  // Reach `submitted` so the application enters the reviewer's queue.
  await submitOwnApplication(page)

  return { email }
}

/**
 * Opens an application from the queue by the person's (run-unique) surname.
 * The name is matched as literal TEXT — the "(Test)" suffix every synthetic
 * fixture carries would otherwise be read as a regex group.
 */
async function openApplication(page: Page, surname: string, state?: string): Promise<void> {
  await page.goto(state ? `/staff/verification?state=${state}` : '/staff/verification')
  await page
    .getByRole('link', { name: surname, exact: false })
    .filter({ visible: true })
    .first()
    .click()
  await page.waitForURL(/\/staff\/verification\/[0-9a-f-]{36}$/, { timeout: 30_000 })
}

test.describe('verification queue', () => {
  test('lists the tenant queue oldest-first with state and waiting time', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/verification')

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/verification queue/i)
    await expect(page.getByText(/oldest submissions first/i)).toBeVisible()

    // The seeded submitted application is actionable and therefore listed.
    await expect(visibleRow(page, 'Applicant One (Test)')).toBeVisible()
    // A decided application is NOT in the default "needs action" view.
    await expect(page.getByText('Applicant Rejected (Test)')).toHaveCount(0)
  })

  test('filters by state, carrying only the state key in the URL', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/verification')

    await page.getByRole('link', { name: /^rejected$/i }).click()
    await expect(page).toHaveURL(/\/staff\/verification\?state=rejected$/)
    await expect(visibleRow(page, 'Applicant Rejected (Test)')).toBeVisible()

    // Every parameter is from the fixed vocabulary — no personal value.
    const url = new URL(page.url())
    expect([...url.searchParams.keys()].sort()).toEqual(['state'])
    expect(url.searchParams.get('state')).toBe('rejected')
  })

  test('ignores an unknown filter rather than echoing it', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)

    // A forged parameter must not reach the query or the rendered page.
    await page.goto('/staff/verification?state=Juan%20Dela%20Cruz&page=abc')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/verification queue/i)
    await expect(page.getByText('Juan Dela Cruz')).toHaveCount(0)
    // It falls back to the default view, which lists actionable work.
    await expect(visibleRow(page, 'Applicant One (Test)')).toBeVisible()
  })

  test('opens a review detail through an opaque application id', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/verification')

    await page
      .getByRole('link', { name: 'Applicant One (Test)' })
      .filter({ visible: true })
      .first()
      .click()
    await page.waitForURL(/\/staff\/verification\/[0-9a-f-]{36}$/, { timeout: 30_000 })

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Applicant One (Test)')
    await expect(page.getByRole('heading', { name: /application timeline/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^applicant$/i })).toBeVisible()
    // Duplicate context is present but explicitly non-actionable (2E).
    await expect(page.getByText(/nothing on this page merges records/i)).toBeVisible()

    // No personal value in the address bar.
    expect(page.url().toLowerCase()).not.toContain('applicant')
  })
})

test.describe('review workflow', () => {
  test('staff start review, request information, resident resubmits, admin approves', async ({
    page,
  }) => {
    test.slow()
    const surname = `Aprub${Date.now()} (Test)`
    const { email } = await createOnboardedResident(page, surname)
    await signOut(page)

    // ── Staff: start review ────────────────────────────────────────────────
    await signIn(page, ACCOUNTS.staffA)
    await openApplication(page, surname)

    await expect(page.getByRole('button', { name: /start review/i })).toBeVisible()
    // Staff hold no decide capability, so no decision control is offered.
    await expect(page.getByRole('button', { name: /approve/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /reject/i })).toHaveCount(0)

    await page.getByRole('button', { name: /start review/i }).click()
    await expect(visibleRow(page, 'in review')).toBeVisible({ timeout: 15_000 })

    // ── Staff: request more information ────────────────────────────────────
    await page.getByRole('button', { name: /request more information/i }).click()
    await page
      .getByLabel(/what does the resident need to provide/i)
      .fill('Please bring a proof of residency to the office (synthetic).')
    await page.getByRole('button', { name: /send request/i }).click()
    await expect(visibleRow(page, 'info requested')).toBeVisible({ timeout: 15_000 })
    await signOut(page)

    // ── Resident: sees the request and resubmits ───────────────────────────
    await signIn(page, email, SIGNUP_PASSWORD)
    await page.goto('/verification')
    await expect(page.getByText('More information needed', { exact: true })).toBeVisible()
    // The heading specifically: the resubmission form's copy repeats the phrase.
    await expect(page.getByRole('heading', { name: /what the barangay asked for/i })).toBeVisible()
    await expect(page.getByText(/proof of residency to the office/i)).toBeVisible()

    await page.getByRole('button', { name: /resubmit for review/i }).click()

    // Assert the SETTLED state, not the form's transient success panel: the
    // post-action refresh re-renders the page, and the form is only rendered
    // while the application sits in info_requested — so the panel is unmounted
    // as soon as the refresh lands.
    await expect(page.getByText('Waiting for review', { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/updated registration is back with the barangay/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /resubmit for review/i })).toHaveCount(0)
    await signOut(page)

    // ── Admin: re-review, then approve ─────────────────────────────────────
    await signIn(page, ACCOUNTS.adminA)
    await openApplication(page, surname, 'resubmitted')

    // A resubmitted application must re-enter review before any decision.
    await expect(page.getByRole('button', { name: /start review/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /approve/i })).toHaveCount(0)
    await page.getByRole('button', { name: /start review/i }).click()
    await expect(visibleRow(page, 'in review')).toBeVisible({ timeout: 15_000 })

    // The opaque id of the application this journey has been driving — needed
    // below to pick its own audit rows out of the tenant log.
    const applicationId = page.url().split('/').pop() ?? ''
    expect(applicationId).toMatch(/^[0-9a-f-]{36}$/)

    // Approval is confirmed deliberately, never on the first click.
    await page.getByRole('button', { name: /approve…/i }).click()
    await expect(page.getByText(/approval is final/i)).toBeVisible()
    await page.getByRole('button', { name: /confirm approval/i }).click()
    await expect(visibleRow(page, 'approved')).toBeVisible({ timeout: 15_000 })

    // Terminal: nothing further is offered, to anyone.
    await expect(page.getByRole('button', { name: /start review/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /approve/i })).toHaveCount(0)
    await expect(page.getByRole('status')).toContainText(/this decision is final/i)
    await signOut(page)

    // ── Resident: sees the approval ────────────────────────────────────────
    await signIn(page, email, SIGNUP_PASSWORD)
    await page.goto('/verification')
    await expect(page.getByText(/verified resident/i)).toBeVisible()
    // No resubmission control survives a terminal decision.
    await expect(page.getByRole('button', { name: /resubmit/i })).toHaveCount(0)
    await signOut(page)

    // ── The journey left a complete, non-personal trail (Slice 2G) ──────────
    // Every subpart proved its own audit row in pgTAP. What only this journey
    // can show is that the WHOLE lifecycle is reconstructable afterwards from
    // the screen a barangay actually has — and that reconstructing it exposes
    // nobody's personal details.
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/audit')

    const trail = page.getByRole('row').filter({ hasText: applicationId })
    // Ten rows and no more — the count is the "nothing else was recorded"
    // assertion, and it is deterministic because this journey mints its own
    // application rather than reusing a fixture.
    await expect(trail, 'the whole journey is reconstructable').toHaveCount(10)

    // The lifecycle: the submission, then in_review → info_requested →
    // resubmitted → in_review → approved.
    const lifecycle = trail.filter({ hasText: 'verification_application' })
    await expect(lifecycle.filter({ hasText: 'verification.submitted' })).toHaveCount(1)
    await expect(lifecycle.filter({ hasText: 'verification.state_changed' })).toHaveCount(5)

    // The evidence: each of the two documents recorded when it was declared and
    // again when its bytes were confirmed in Storage (Slice 2F).
    const evidence = trail.filter({ hasText: 'verification_evidence' })
    await expect(evidence.filter({ hasText: 'verification.evidence_added' })).toHaveCount(2)
    await expect(evidence.filter({ hasText: 'verification.evidence_finalized' })).toHaveCount(2)

    // No step was recorded as anything but a success.
    await expect(trail.getByText('failure')).toHaveCount(0)

    // The audit trail is the densest concentration of Slice 2 metadata in the
    // product, so it is the right place to assert the hygiene rule end-to-end:
    // the resident's name and the staff-authored note reach the application
    // row, and stop there (Phase 6 §37.2).
    const trailText = (await trail.allInnerTexts()).join('\n')
    expect(trailText, 'no resident name in the audit trail').not.toContain(surname)
    expect(trailText, 'no staff note in the audit trail').not.toMatch(/proof of residency/i)
    expect(trailText, 'no evidence object path in the audit trail').not.toMatch(
      /verification-evidence\//,
    )
    // Presence, not content — that is the whole contract.
    expect(trailText).toContain('"note_present":true')
    expect(trailText).toMatch(/"to_state":"approved"/)
  })

  test('an administrator rejects with a reason, and the resident sees it', async ({ page }) => {
    test.slow()
    const surname = `Tanggi${Date.now()} (Test)`
    const { email } = await createOnboardedResident(page, surname)
    await signOut(page)

    await signIn(page, ACCOUNTS.adminA)
    await openApplication(page, surname)
    await page.getByRole('button', { name: /start review/i }).click()
    await expect(visibleRow(page, 'in review')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: /reject…/i }).click()
    await page
      .getByLabel(/reason \(required\)/i)
      .fill('The address given is outside this barangay (synthetic).')
    await page.getByRole('button', { name: /confirm rejection/i }).click()
    await expect(visibleRow(page, 'rejected')).toBeVisible({ timeout: 15_000 })

    // The reason is kept on the record for the reviewer too.
    await expect(page.getByText(/outside this barangay/i)).toBeVisible()
    await signOut(page)

    await signIn(page, email, SIGNUP_PASSWORD)
    await page.goto('/verification')
    // The badge specifically: the explanation paragraph repeats the phrase.
    await expect(page.getByText('Not approved', { exact: true })).toBeVisible()
    await expect(page.getByText(/reason given/i)).toBeVisible()
    await expect(page.getByText(/outside this barangay/i)).toBeVisible()
    // The resident is told what they can do next, not left stranded.
    await expect(page.getByText(/staff can start a new registration/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /resubmit/i })).toHaveCount(0)
  })
})

test.describe('authorization', () => {
  test('staff reach the queue but are never offered a decision', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.staffA)

    await page.goto('/staff/verification')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/verification queue/i)

    await page
      .getByRole('link', { name: 'Applicant One (Test)' })
      .filter({ visible: true })
      .first()
      .click()
    await page.waitForURL(/\/staff\/verification\/[0-9a-f-]{36}$/, { timeout: 30_000 })

    await expect(page.getByRole('button', { name: /approve/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /reject/i })).toHaveCount(0)
    // Evidence metadata needs its own capability, which staff do not hold.
    await expect(page.getByText(/document details require the evidence capability/i)).toBeVisible()
  })

  test('a resident is refused the staff verification routes', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.residentA)

    await page.goto('/staff/verification')
    await expect(page).toHaveURL(/\/access-denied$/)

    await page.goto(`/staff/verification/${TENANT_A_APPLICATION}`)
    await expect(page).toHaveURL(/\/access-denied$/)
  })

  test('a platform administrator holds no tenant verification access', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.platform)

    await page.goto('/staff/verification')
    await expect(page).toHaveURL(/\/access-denied$/)

    await page.goto(`/staff/verification/${TENANT_A_APPLICATION}`)
    await expect(page).toHaveURL(/\/access-denied$/)
  })

  test('a tenant-B administrator cannot open a tenant-A application', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminB)

    await page.goto('/staff/verification')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/malinis/i)
    await expect(page.getByText('Applicant One (Test)')).toHaveCount(0)

    // Indistinguishability: a real tenant-A id and an id that exists nowhere
    // must answer identically, or the difference is itself the disclosure
    // (Phase 4 §13.6). Asserted as an equality rather than a fixed status —
    // the segment streams under `loading.tsx`, so the status commits before
    // notFound() runs, in dev and in a production build alike.
    const real = await page.goto(`/staff/verification/${TENANT_A_APPLICATION}`)
    const realStatus = real?.status()
    const realHeading = await page.getByRole('heading', { level: 1 }).textContent()

    const nowhere = await page.goto('/staff/verification/d0000000-0000-4000-8000-0000000000ff')
    expect(nowhere?.status()).toBe(realStatus)
    expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe(realHeading)

    expect(realHeading).toMatch(/could not find that page/i)
    await page.goto(`/staff/verification/${TENANT_A_APPLICATION}`)
    await expect(page.getByText('Applicant One (Test)')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(/barangay|tenant|permission|denied/i)
  })
})

test.describe('presentation', () => {
  test('renders a table on wide viewports and cards on narrow ones', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/verification')

    const table = page.getByRole('table', { name: /verification applications, oldest first/i })

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(table).toBeVisible()

    await page.setViewportSize({ width: 380, height: 800 })
    await expect(table).toBeHidden()
    await expect(visibleRow(page, 'Applicant One (Test)')).toBeVisible()
  })
})
