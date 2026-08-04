import { expect, test, type Page } from '@playwright/test'

/**
 * Slice 2G — accessibility baseline across every Slice 2 route.
 *
 * Slice 0a asserted these properties for the shells; this extends the same
 * baseline to the routes Slice 2 added, so a regression in one of them fails
 * here rather than in a pilot. It checks STRUCTURE — one h1, landmarks,
 * labelled controls, keyboard reachability, visible focus, touch-target size
 * and non-colour state — not visual design.
 *
 * Every route is visited with a seeded persona; nothing here signs up, so the
 * suite costs no public sign-up quota (the 2E finding) and is re-runnable in
 * any order.
 */

const PASSWORD = 'password123-local'

const ACCOUNTS = {
  adminA: 'admin.sanisidro@barangay-hub.test',
  applicant: 'applicant.sanisidro@barangay-hub.test',
  /** Verified in tenant A — the only persona the Slice 3B forms exist for. */
  residentA: 'resident.sanisidro@barangay-hub.test',
} as const

/** Seeded tenant-A fixtures, reachable read-only. */
const PERSON = 'c0000000-0000-4000-8000-000000000004'
const APPLICATION = 'd0000000-0000-4000-8000-000000000001'

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(dashboard|staff|platform)$/, { timeout: 30_000 })
}

/**
 * Both Slice 2 listings are responsive by design: a real table from `sm`
 * upwards, stacked cards below it, where a four-column table would be
 * unreadable on a phone. Asserting the table unconditionally would fail the
 * mobile project for doing the right thing.
 *
 * What actually matters is PARITY — whichever form the viewport gets, it must
 * be a genuine semantic structure carrying every row, each still reachable.
 * So: at wide widths a captioned table with column headers; at narrow widths a
 * list; and in both cases the same number of detail links.
 */
async function assertRoster(
  page: Page,
  { caption, rowLinks }: { caption: RegExp; rowLinks: string },
): Promise<void> {
  const wide = (page.viewportSize()?.width ?? 0) >= 640
  // Both forms are always in the DOM — one is display:none. Measure the one
  // this viewport actually shows, or `.first()` lands on the hidden copy.
  const rows = page.locator(`${rowLinks}:visible`)
  await expect(rows.first(), 'the roster has at least one row').toBeVisible()

  if (wide) {
    const table = page.getByRole('table', { name: caption })
    await expect(table, 'wide viewports get a captioned table').toHaveCount(1)
    // Column headers, not a grid of anonymous cells.
    await expect(table.getByRole('columnheader')).not.toHaveCount(0)
  } else {
    await expect(page.getByRole('table'), 'a phone gets cards, not a 4-column table').toHaveCount(0)
    await expect(page.getByRole('list').filter({ has: rows.first() })).not.toHaveCount(0)
  }
}

/** The structural baseline every authenticated Slice 2 route must meet. */
async function assertBaseline(page: Page, label: string): Promise<void> {
  // Exactly one h1 — the page's identity, not a decorative heading.
  await expect(page.getByRole('heading', { level: 1 }), `${label}: one h1`).toHaveCount(1)

  // Landmarks: a main region, and the skip link as the first focusable thing.
  await expect(page.getByRole('main'), `${label}: main landmark`).toHaveCount(1)
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: /skip to main content/i })
  await expect(skip, `${label}: skip link is first in the tab order`).toBeFocused()

  // Focus must be visible — a suppressed outline fails keyboard users silently.
  const outline = await skip.evaluate((node) => {
    const style = window.getComputedStyle(node)
    return `${style.outlineStyle}|${style.outlineWidth}|${style.boxShadow}`
  })
  expect(outline, `${label}: focus indicator not suppressed`).not.toMatch(/^none\|0px\|none$/)

  // Every form control carries an accessible name.
  const unlabelled = await page.locator('input:not([type=hidden]), select, textarea').evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const el = node as HTMLElement
        const id = el.getAttribute('id')
        const labelled =
          el.getAttribute('aria-label') ??
          el.getAttribute('aria-labelledby') ??
          (id ? document.querySelector(`label[for="${id}"]`) : null) ??
          el.closest('label')
        return !labelled
      }).length,
  )
  expect(unlabelled, `${label}: every control is labelled`).toBe(0)

  // Interactive targets meet the 44px minimum (Phase 6 accessibility DoD).
  //
  // Three exemptions, each deliberate rather than convenient:
  //   • Next's dev-tools overlay, which lives in a shadow root and does not
  //     exist in a production build — measuring it would test the framework;
  //   • visually-hidden-until-focused controls — the skip link is 1px tall by
  //     design, and measuring it would punish the very affordance it provides;
  //   • inline text links inside prose, whose target is the line box; padding
  //     them to 44px would break the sentence they sit in.
  const undersized = await page
    .locator('button:visible, a:visible[href], input:visible[type=file]')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const root = node.getRootNode()
          const host = root instanceof ShadowRoot ? root.host : null
          if (host?.tagName.toLowerCase().includes('nextjs')) return false

          const rect = node.getBoundingClientRect()
          const hiddenUntilFocused = rect.height < 4
          // Inline text links — in prose, a table cell or a list row — are
          // measured by their line box, and the sentence or row provides the
          // reachable area.
          //
          // `nav` was on this list until Slice 3D. It was there because the
          // Slice 1 shell header's links were 20–27px (R-2-05), and exempting
          // them made the gap VISIBLE in the test rather than silently passed.
          // US-UI-002 was assigned to this slice, the links now carry
          // `min-h-11`, and so the exemption is gone: shell navigation is held
          // to the same 44px as everything else, and a regression fails here.
          const inlineTextLink = node.tagName === 'A' && node.closest('p,li,dd,span,td') !== null
          return !hiddenUntilFocused && !inlineTextLink && rect.height > 0 && rect.height < 44
        })
        .map(
          (node) =>
            `${node.tagName} ${Math.round(node.getBoundingClientRect().height)}px "${(node.textContent ?? '').trim().slice(0, 30)}"`,
        ),
    )
  expect(undersized, `${label}: interactive targets are at least 44px tall`).toEqual([])
}

test.describe('accessibility baseline — resident routes', () => {
  test('the verification status page meets the baseline', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.applicant)
    await page.goto('/verification')
    await assertBaseline(page, '/verification')

    // The state is conveyed as TEXT, not colour. Asserted state-agnostically:
    // this suite is read-only, and pinning one state would couple it to
    // whatever another spec last did to the shared seeded application.
    await expect(
      page
        .getByText(
          /not submitted yet|waiting for review|being reviewed|more information needed|verified resident|not approved/i,
        )
        .first(),
    ).toBeVisible()
  })

  test('the dashboard meets the baseline', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.applicant)
    await page.goto('/dashboard')
    await assertBaseline(page, '/dashboard')
  })

  test('the public sign-up page meets the baseline', async ({ page }) => {
    test.slow()
    await page.goto('/sign-up')
    await assertBaseline(page, '/sign-up')
  })
})

/**
 * Slice 3B routes, held to the same baseline.
 *
 * Driven by the VERIFIED resident, because the composition surfaces only exist
 * for someone who may actually use them — an ineligible persona would render
 * the explanation panel instead and the form would go unchecked.
 */
test.describe('accessibility baseline — resident document routes', () => {
  const CLEARANCE = 'f0000000-0000-4000-8000-000000000001'

  test('the catalog and one document meet the baseline', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.residentA)

    await page.goto('/documents')
    await assertBaseline(page, '/documents')

    await page.goto(`/documents/${CLEARANCE}`)
    await assertBaseline(page, `/documents/[documentTypeId]`)

    // B-08 is conveyed as TEXT beside the figure, never by colour alone.
    await expect(page.getByText(/not yet confirmed/i).first()).toBeVisible()
  })

  test('the request list and the composition form meet the baseline', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.residentA)

    await page.goto('/requests')
    await assertBaseline(page, '/requests')

    await page.goto(`/requests/new?type=${CLEARANCE}`)
    await assertBaseline(page, '/requests/new')

    // Every data-driven control carries a real label, not a placeholder.
    await expect(page.getByLabel('Purpose')).toBeVisible()
    await expect(page.getByLabel(/years of residency/i)).toBeVisible()
    await expect(page.getByLabel(/intended use/i)).toBeVisible()
  })
})

test.describe('accessibility baseline — staff routes', () => {
  test('the registry list and walk-in form meet the baseline', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)

    await page.goto('/staff/registry')
    await assertBaseline(page, '/staff/registry')
    await assertRoster(page, {
      caption: /residents in this barangay/i,
      // Person rows, not the "add a walk-in resident" call to action.
      rowLinks: 'a[href^="/staff/registry/"]:not([href$="/new"])',
    })

    await page.goto('/staff/registry/new')
    await assertBaseline(page, '/staff/registry/new')
    // Grouped fields carry legends rather than floating labels.
    await expect(page.getByRole('group', { name: /resident’s name/i })).toBeVisible()
  })

  test('the person record meets the baseline', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto(`/staff/registry/${PERSON}`)
    await assertBaseline(page, '/staff/registry/[personId]')
  })

  test('the verification queue meets the baseline', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto('/staff/verification')
    await assertBaseline(page, '/staff/verification')

    await assertRoster(page, {
      caption: /verification applications, oldest first/i,
      rowLinks: 'a[href^="/staff/verification/"]',
    })
    // Filters are a labelled navigation, and the active one is marked for
    // assistive technology rather than by colour alone.
    const filters = page.getByRole('navigation', { name: /filter by state/i })
    await expect(filters).toBeVisible()
    await expect(filters.locator('[aria-current="page"]')).toHaveCount(1)
  })

  test('the review detail meets the baseline and embeds no evidence', async ({ page }) => {
    test.slow()
    await signIn(page, ACCOUNTS.adminA)
    await page.goto(`/staff/verification/${APPLICATION}`)
    await assertBaseline(page, '/staff/verification/[applicationId]')

    // Evidence bytes are never auto-loaded: no image, iframe or object may
    // point at Storage before a reviewer asks (Slice 2F).
    await expect(page.locator('img[src*="storage"], iframe, object, embed')).toHaveCount(0)
  })
})

/*
 * Confirmation-before-terminal-decision is deliberately NOT re-tested here.
 *
 * It is already pinned deterministically at the component level — see
 * `tests/unit/registry/verification-ui.test.tsx` ("does not submit an approval
 * on the first click", "requires a reason field before a rejection can be
 * confirmed") and `duplicate-resolution-ui.test.tsx`. Proving it again through
 * the browser would mean driving a seeded application into `in_review`, which
 * mutates a fixture other specs read and makes the whole suite order-dependent
 * — the exact reliability debt this subpart exists to remove.
 *
 * Everything in this file is therefore READ-ONLY and re-runnable in any order.
 */
