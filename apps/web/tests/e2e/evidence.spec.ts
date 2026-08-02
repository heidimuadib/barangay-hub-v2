import { readFileSync } from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

/**
 * Slice 2F — private evidence Storage and browser-driven submission.
 *
 * This suite closes R-2-04: the resident completes the WHOLE journey in a
 * real browser — pick a file, upload it to the private bucket through a
 * signed ticket, and submit. No direct database insert, no service-role
 * shortcut, no seeded evidence.
 *
 * Every file used is SYNTHETIC and generated in-process: a 1×1 PNG and a
 * minimal PDF, both built from literals below. Nothing resembling a real
 * government ID exists anywhere in this repository (DEC-ENV-04).
 *
 * Sign-up quota discipline (the 2E finding): only the journey tests mint an
 * account. Every denial case below reuses seeded personas, so the suite stays
 * inside the app's own 10-per-client-address / 15-minute sign-up limit.
 */

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
const PASSWORD = 'password123-local'
const SIGNUP_PASSWORD = 'a-sufficiently-long-passphrase'

const ACCOUNTS = {
  platform: 'platform.admin@barangay-hub.test',
  adminA: 'admin.sanisidro@barangay-hub.test',
  staffA: 'staff.sanisidro@barangay-hub.test',
  adminB: 'admin.malinis@barangay-hub.test',
} as const

/** A seeded tenant-A application that already carries evidence metadata. */
const SEEDED_APPLICATION = 'd0000000-0000-4000-8000-000000000001'

/** Smallest valid PNG: 1×1 transparent pixel. Synthetic by construction. */
const SYNTHETIC_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

/** Smallest structurally valid PDF. Contains no personal data of any kind. */
const SYNTHETIC_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 99 99]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
  'latin1',
)

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

async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(dashboard|staff|platform)$/, { timeout: 30_000 })
}

async function signOut(page: Page): Promise<void> {
  await page.goto('/dashboard')
  await page.getByRole('button', { name: /sign out/i }).click()
  await page.waitForURL(/\/sign-in$/, { timeout: 30_000 })
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

/** Signs up, confirms by email, onboards. Leaves the browser on /verification. */
async function createOnboardedResident(page: Page, surname: string): Promise<{ email: string }> {
  const email = `evid-${Date.now()}-${Math.floor(Math.random() * 10000)}@barangay-hub.test`

  await page.goto('/sign-up')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(SIGNUP_PASSWORD)
  await page.getByLabel('Confirm password').fill(SIGNUP_PASSWORD)
  await page.getByRole('button', { name: /create account/i }).click()
  await expect(page.getByRole('status')).toBeVisible({ timeout: 15_000 })

  const link = await confirmationLinkFor(page, email)
  await page.goto(link)
  await page.waitForURL(/\/(dashboard|onboarding|sign-in)$/, { timeout: 30_000 })
  await page.goto('/onboarding')
  if (/\/sign-in$/.test(page.url())) {
    await signIn(page, email, SIGNUP_PASSWORD)
    await page.goto('/onboarding')
  }
  await page.waitForURL(/\/onboarding$/, { timeout: 30_000 })

  await page.getByLabel(/which barangay/i).selectOption({ label: 'San Isidro (Test)' })
  await page.getByLabel('First name').fill('Ebidensya')
  await page.getByLabel('Last name').fill(surname)
  await page.getByLabel(/how do you live/i).selectOption('renter')
  await page.getByRole('button', { name: /save and continue/i }).click()
  await page.waitForURL(/\/verification$/, { timeout: 30_000 })

  return { email }
}

/** Uploads one synthetic document through the real picker. */
async function uploadEvidence(
  page: Page,
  kind: 'identity evidence' | 'proof of residency',
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  await page.getByLabel(new RegExp(`add ${kind}`, 'i')).setInputFiles(file)
}

test.describe('resident evidence upload and submission (closes R-2-04)', () => {
  test('uploads both documents and submits entirely through the browser', async ({ page }) => {
    test.slow()
    const { email } = await createOnboardedResident(page, `Sanhi${Date.now()} (Test)`)

    // ── Nothing yet: both requirements named, submission blocked ───────────
    await expect(page.getByText(/identity evidence — still needed/i)).toBeVisible()
    await expect(page.getByText(/proof of residency — still needed/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /send for verification/i })).toBeDisabled()

    // ── Identity: a real browser upload into the private bucket ────────────
    await uploadEvidence(page, 'identity evidence', {
      name: 'synthetic-id.png',
      mimeType: 'image/png',
      buffer: SYNTHETIC_PNG,
    })
    await expect(page.getByText(/identity evidence — added/i)).toBeVisible({ timeout: 30_000 })
    // Still incomplete: one required kind is missing.
    await expect(page.getByRole('button', { name: /send for verification/i })).toBeDisabled()

    // ── Residency ──────────────────────────────────────────────────────────
    await uploadEvidence(page, 'proof of residency', {
      name: 'synthetic-residency.pdf',
      mimeType: 'application/pdf',
      buffer: SYNTHETIC_PDF,
    })
    await expect(page.getByText(/proof of residency — added/i)).toBeVisible({ timeout: 30_000 })

    // The list describes documents by category and type — never a filename.
    const documents = page.getByRole('list', { name: /documents you added/i })
    await expect(documents.getByText('PNG image')).toBeVisible()
    await expect(documents.getByText('PDF document')).toBeVisible()
    await expect(page.getByText('synthetic-id.png')).toHaveCount(0)
    await expect(page.getByText('synthetic-residency.pdf')).toHaveCount(0)

    // ── Submit ─────────────────────────────────────────────────────────────
    const submit = page.getByRole('button', { name: /send for verification/i })
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect(page.getByText('Waiting for review', { exact: true })).toBeVisible({
      timeout: 30_000,
    })

    // ── Frozen after submission: no upload, no removal ─────────────────────
    await expect(page.getByRole('button', { name: /remove/i })).toHaveCount(0)
    await expect(page.getByLabel(/add identity evidence/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /send for verification/i })).toHaveCount(0)

    // ── No PII and no signed URL in the address bar, at any point ──────────
    expect(page.url()).toMatch(/\/verification$/)
    expect(page.url()).not.toContain('token')
    expect(page.url()).not.toContain('Ebidensya')

    // ── A reviewer can now reach the document, on demand ───────────────────
    await signOut(page)
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/verification?state=submitted')
    await page
      .getByRole('link', { name: /Ebidensya/i })
      .filter({ visible: true })
      .first()
      .click()
    await page.waitForURL(/\/staff\/verification\/[0-9a-f-]{36}$/, { timeout: 30_000 })

    // Metadata is listed; bytes are NOT embedded or prefetched.
    await expect(page.getByText('PNG image')).toBeVisible()
    await expect(page.locator('img[src*="storage"]')).toHaveCount(0)
    await expect(page.locator('iframe')).toHaveCount(0)

    // The URL is minted only when asked, and opens in a new tab.
    const viewButton = page.getByRole('button', { name: /view identity evidence/i }).first()
    await expect(viewButton).toBeVisible()

    const popupPromise = page.context().waitForEvent('page', { timeout: 30_000 })
    await viewButton.click()
    const popup = await popupPromise
    // A genuine signed object URL — private bucket, token-bearing.
    expect(popup.url()).toContain('/storage/v1/object/sign/verification-evidence/')
    expect(popup.url()).toContain('token=')
    await popup.close()

    // The reviewer's own route never carried the signed URL.
    expect(page.url()).not.toContain('token=')
    expect(page.url()).toMatch(/\/staff\/verification\/[0-9a-f-]{36}$/)

    expect(email).toContain('@barangay-hub.test')
  })

  test('a resident removes a document before submitting', async ({ page }) => {
    test.slow()
    await createOnboardedResident(page, `Tanggal${Date.now()} (Test)`)

    await uploadEvidence(page, 'identity evidence', {
      name: 'synthetic-id.png',
      mimeType: 'image/png',
      buffer: SYNTHETIC_PNG,
    })
    await expect(page.getByText(/identity evidence — added/i)).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /^remove$/i }).click()

    // Gone from the list, and the requirement is unmet again.
    await expect(page.getByText(/identity evidence — still needed/i)).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole('button', { name: /send for verification/i })).toBeDisabled()
  })
})

test.describe('object privacy', () => {
  test('the bucket serves nothing to an anonymous fetch', async ({ page }) => {
    // A known-shaped path in the private bucket. Whether or not this exact
    // object exists, an unauthenticated fetch must never return bytes.
    const path = `a0000000-0000-4000-8000-000000000001/${SEEDED_APPLICATION}/e0000000-0000-4000-8000-000000000001`

    const unsigned = await page.request.get(
      `${SUPABASE_URL}/storage/v1/object/verification-evidence/${path}`,
      { headers: { apikey: localEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') } },
    )
    expect(unsigned.ok(), 'anonymous object read must fail').toBeFalsy()
    expect([400, 401, 403, 404]).toContain(unsigned.status())

    // The public-URL form must not serve a private object either.
    const asPublic = await page.request.get(
      `${SUPABASE_URL}/storage/v1/object/public/verification-evidence/${path}`,
    )
    expect(asPublic.ok(), 'the private bucket has no public URL form').toBeFalsy()

    // Nor may anyone LIST the bucket anonymously.
    const listed = await page.request.post(
      `${SUPABASE_URL}/storage/v1/object/list/verification-evidence`,
      {
        headers: {
          apikey: localEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
          'Content-Type': 'application/json',
        },
        data: { prefix: '', limit: 100 },
      },
    )
    const rows: unknown[] = listed.ok() ? ((await listed.json()) as unknown[]) : []
    expect(rows.length, 'anonymous listing must return nothing').toBe(0)
  })
})

test.describe('authorization', () => {
  test('staff without the evidence capability are offered no document access', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.staffA)
    await page.goto(`/staff/verification/${SEEDED_APPLICATION}`)

    // Slice 2D behaviour, still true: the metadata itself is withheld.
    await expect(page.getByText(/document details require the evidence capability/i)).toBeVisible()
    // Anchored: a bare /view/i also matches the "Start review" control.
    await expect(page.getByRole('button', { name: /^view / })).toHaveCount(0)
  })

  test('an administrator with the capability is offered access', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto(`/staff/verification/${SEEDED_APPLICATION}`)

    // The seeded application carries finalized-looking metadata rows.
    await expect(page.getByRole('heading', { name: /^documents$/i })).toBeVisible()
    await expect(page.getByText(/document details require the evidence capability/i)).toHaveCount(0)
  })

  test('a tenant-B administrator reaches neither the application nor its evidence', async ({
    page,
  }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminB)
    await page.goto(`/staff/verification/${SEEDED_APPLICATION}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/could not find that page/i)
  })

  test('a platform administrator is refused the review surface entirely', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.platform)
    await page.goto(`/staff/verification/${SEEDED_APPLICATION}`)
    await expect(page).toHaveURL(/\/access-denied$/)
  })
})
