import { expect, test, type Page } from '@playwright/test'

/**
 * Slice 2B — public registration and onboarding (ADR-0006 Option C).
 *
 * Exercises the real policy end to end: sign up, confirm through the local
 * Mailpit catcher (confirmations are ENABLED locally so the approved rule is
 * tested, not assumed), sign in, onboard into the shared registry, and read
 * the verification status.
 *
 * Synthetic addresses only; every run uses a fresh one so the suite is
 * re-runnable without cleanup.
 */

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
const PASSWORD = 'a-sufficiently-long-passphrase'

function freshEmail(): string {
  // Distinct per run; the domain is reserved for synthetic fixtures.
  return `signup-${Date.now()}-${Math.floor(Math.random() * 10000)}@barangay-hub.test`
}

/** Reads the confirmation link Supabase sent, via Mailpit's API. */
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

test.describe('public sign-up', () => {
  test('is reachable from sign-in and never reveals whether an address is registered', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page.getByRole('link', { name: /create an account/i }).click()
    await expect(page).toHaveURL(/\/sign-up$/)

    // A brand-new address and an address that certainly EXISTS (the seeded
    // resident) must produce byte-identical outcomes.
    const responses: string[] = []
    for (const email of [freshEmail(), 'resident.sanisidro@barangay-hub.test']) {
      await page.goto('/sign-up')
      await page.getByLabel('Email address').fill(email)
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
      await page.getByLabel('Confirm password').fill(PASSWORD)
      await page.getByRole('button', { name: /create account/i }).click()

      const panel = page.getByRole('status')
      await expect(panel).toBeVisible({ timeout: 15_000 })
      responses.push(((await panel.textContent()) ?? '').replace(/\s+/g, ' ').trim())
    }

    expect(responses[0]).toBe(responses[1])
    expect(responses[0]).toMatch(/if that address can be registered/i)
  })

  test('validates the form without disclosing anything about the address', async ({ page }) => {
    await page.goto('/sign-up')
    await page.getByLabel('Email address').fill('resident.sanisidro@barangay-hub.test')
    await page.getByLabel('Password', { exact: true }).fill('too-short')
    await page.getByLabel('Confirm password').fill('too-short')
    await page.getByRole('button', { name: /create account/i }).click()

    // Feedback describes the SUBMITTED value only.
    await expect(page.getByText(/at least 12 characters/i).first()).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })
})

test.describe('registration journey', () => {
  test.describe.configure({ mode: 'serial' })

  test('sign up, confirm by email, onboard, and see the pending status', async ({ page }) => {
    test.slow()
    const email = freshEmail()

    await page.goto('/sign-up')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Confirm password').fill(PASSWORD)
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page.getByRole('status')).toBeVisible({ timeout: 15_000 })

    // Confirmation is REQUIRED before onboarding (ADR-0006 point 2).
    const link = await confirmationLinkFor(page, email)
    await page.goto(link)

    // The callback establishes the session and routes by context; a brand-new
    // account has no membership, so it lands on the resident dashboard.
    await page.waitForURL(/\/(dashboard|onboarding|sign-in)$/, { timeout: 20_000 })

    if (page.url().endsWith('/sign-in')) {
      await page.getByLabel('Email address').fill(email)
      await page.getByLabel('Password').fill(PASSWORD)
      await page.getByRole('button', { name: /sign in/i }).click()
      await page.waitForURL(/\/dashboard$/)
    }

    // The dashboard card is the single next action for an unregistered account.
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /resident registration/i })).toBeVisible()
    await page.getByRole('link', { name: /start my registration/i }).click()
    await expect(page).toHaveURL(/\/onboarding$/)

    await page.getByLabel(/which barangay/i).selectOption({ label: 'San Isidro (Test)' })
    await page.getByLabel('First name').fill('Bagong')
    await page.getByLabel('Last name').fill('Residente (Test)')
    await page.getByLabel(/how do you live/i).selectOption('renter')
    await page.getByRole('button', { name: /save and continue/i }).click()

    await page.waitForURL(/\/verification$/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /my registration/i })).toBeVisible()
    // Unverified until a reviewer approves (ADR-0006 point 4).
    await expect(page.getByText(/not submitted yet/i)).toBeVisible()

    // Onboarding runs once: returning to it redirects to the status page.
    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/verification$/)
  })

  test('the "other" residency basis demands an explanation', async ({ page }) => {
    test.slow()
    const email = freshEmail()

    await page.goto('/sign-up')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Confirm password').fill(PASSWORD)
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page.getByRole('status')).toBeVisible({ timeout: 15_000 })

    const link = await confirmationLinkFor(page, email)
    await page.goto(link)
    await page.waitForURL(/\/(dashboard|onboarding|sign-in)$/, { timeout: 20_000 })
    if (page.url().endsWith('/sign-in')) {
      await page.getByLabel('Email address').fill(email)
      await page.getByLabel('Password').fill(PASSWORD)
      await page.getByRole('button', { name: /sign in/i }).click()
      await page.waitForURL(/\/dashboard$/)
    }

    await page.goto('/onboarding')
    await page.getByLabel(/how do you live/i).selectOption('other')
    // The explanation field appears only for "other" (D2-01).
    await expect(page.getByLabel(/explain your arrangement/i)).toBeVisible()
  })
})

test.describe('registration routes are private', () => {
  test('onboarding and verification refuse anonymous visitors', async ({ page }) => {
    for (const path of ['/onboarding', '/verification']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/sign-in$/)
    }
  })
})
