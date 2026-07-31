import { expect, test, type Page } from '@playwright/test'

/**
 * Slice 1 identity and access end-to-end suite.
 *
 * Requires the LOCAL Supabase stack with the Slice 1 seed fixtures
 * (`pnpm db:start`, seeds applied). Synthetic accounts only — the shared
 * password is a documented local fixture, not a secret.
 */

const PASSWORD = 'password123-local'
const ACCOUNTS = {
  platform: 'platform.admin@barangay-hub.test',
  adminA: 'admin.sanisidro@barangay-hub.test',
  staffA: 'staff.sanisidro@barangay-hub.test',
  residentA: 'resident.sanisidro@barangay-hub.test',
} as const

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  // Every seeded account lands on an authenticated shell.
  await page.waitForURL(/\/(dashboard|staff|platform)$/)
}

test.describe('sign-in', () => {
  test('rejects wrong credentials with the uniform message and stays put', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByLabel('Email address').fill(ACCOUNTS.residentA)
    await page.getByLabel('Password').fill('wrong-password')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Note: getByRole('alert') alone is ambiguous — Next's route announcer is
    // also role="alert" — so the assertions anchor on the copy.
    await expect(page.getByText(/did not work/i)).toBeVisible()
    await expect(page).toHaveURL(/\/sign-in$/)

    // The same uniform copy for an unknown account — no enumeration signal.
    await page.getByLabel('Email address').fill('no-such-account@barangay-hub.test')
    await page.getByLabel('Password').fill('wrong-password')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/did not work/i)).toBeVisible()
  })
})

test.describe('resident', () => {
  test('lands on the dashboard and sees their membership', async ({ page }) => {
    await signIn(page, ACCOUNTS.residentA)

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/welcome/i)
    await expect(page.getByText('San Isidro (Test)')).toBeVisible()
    // No staff or platform affordance is offered to a resident.
    await expect(page.getByRole('link', { name: /staff workspace/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /platform console/i })).toHaveCount(0)
  })

  test('is refused by the staff and platform shells server-side', async ({ page }) => {
    // Four navigations, each potentially a dev-mode cold compile.
    test.slow()
    await signIn(page, ACCOUNTS.residentA)

    await page.goto('/staff')
    await expect(page).toHaveURL(/\/access-denied$/)
    await page.goto('/staff/members')
    await expect(page).toHaveURL(/\/access-denied$/)
    await page.goto('/platform')
    await expect(page).toHaveURL(/\/access-denied$/)
  })

  test('can update their own display name from the account page', async ({ page }) => {
    await signIn(page, ACCOUNTS.residentA)
    await page.goto('/account')

    const input = page.getByLabel('Display name')
    await input.fill('San Isidro Resident (Test)')
    await page.getByRole('button', { name: /save/i }).click()

    // Server action + revalidation round trip; generous under parallel load.
    await expect(page.getByRole('status')).toContainText(/saved/i, { timeout: 15_000 })
  })
})

test.describe('staff', () => {
  test('reads the roster but is offered no management controls', async ({ page }) => {
    await signIn(page, ACCOUNTS.staffA)

    await expect(page).toHaveURL(/\/staff$/)
    await page.goto('/staff/members')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/members/i)
    // The full seeded San Isidro roster is visible…
    await expect(page.getByText('San Isidro Admin (Test)')).toBeVisible()
    await expect(page.getByText('Invited Member (Test)')).toBeVisible()
    // …but no mutation affordance exists for read-only staff.
    await expect(page.getByRole('button', { name: /set status/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /add role/i })).toHaveCount(0)
    await expect(page.getByLabel(/invite an existing account/i)).toHaveCount(0)
  })

  test('is refused by the audit log', async ({ page }) => {
    await signIn(page, ACCOUNTS.staffA)

    await page.goto('/staff/audit')
    await expect(page).toHaveURL(/\/access-denied$/)
  })
})

test.describe('barangay administrator', () => {
  // Serial: these tests mutate the shared seeded state and restore it.
  test.describe.configure({ mode: 'serial' })

  test('performs a Slice 1 management action: activates and re-invites a membership', async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/members')

    const invitedRow = page.getByRole('row').filter({ hasText: 'Invited Member (Test)' })
    // The status CHIP is the second cell; the select in the manage cell also
    // contains the status words, so the assertion must target the chip.
    const statusChip = invitedRow.getByRole('cell').nth(1).locator('span')
    await expect(statusChip).toHaveText('invited')

    // Activate.
    await invitedRow.getByLabel(/change status/i).selectOption('active')
    await invitedRow.getByRole('button', { name: /set status/i }).click()
    await expect(statusChip).toHaveText('active')

    // Restore the seeded state so the suite is re-runnable.
    await invitedRow.getByLabel(/change status/i).selectOption('invited')
    await invitedRow.getByRole('button', { name: /set status/i }).click()
    await expect(statusChip).toHaveText('invited')
  })

  test('sees the audited trail of that action', async ({ page }) => {
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/audit')

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/audit log/i)
    await expect(page.getByText('membership.status_changed').first()).toBeVisible()
    await expect(page.getByText(/append-only/i)).toBeVisible()
  })
})

test.describe('platform administrator', () => {
  test('operates the console but holds NO tenant access', async ({ page }) => {
    await signIn(page, ACCOUNTS.platform)

    await expect(page).toHaveURL(/\/platform$/)
    // Tenant METADATA is visible…
    await expect(page.getByText('San Isidro (Test)')).toBeVisible()
    await expect(page.getByText('Malinis (Test)')).toBeVisible()
    // …but the staff workspace refuses: platform authority is not membership
    // (Phase 4 §16.4).
    await page.goto('/staff')
    await expect(page).toHaveURL(/\/access-denied$/)
    await page.goto('/staff/members')
    await expect(page).toHaveURL(/\/access-denied$/)
  })
})

test.describe('session lifecycle', () => {
  test('sign-out ends the session and protected routes bounce again', async ({ page }) => {
    await signIn(page, ACCOUNTS.residentA)

    await page.getByRole('button', { name: /sign out/i }).click()
    await page.waitForURL(/\/sign-in$/)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/sign-in$/)
  })
})
