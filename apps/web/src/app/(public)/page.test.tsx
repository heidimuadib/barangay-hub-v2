import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import PublicLayout from './layout'
import PublicHomePage from './page'

/**
 * The public shell's accessibility baseline.
 *
 * Slice 0a wrote these assertions and noted they were behavioural "so they
 * survive the Slice 1 rewrite of these components". The rewrite arrived in
 * Slice 3D instead (US-UI-006), and the assertions did survive — but the page
 * is now an async Server Component that reads the public barangay directory,
 * so it has to be awaited and its data stubbed.
 *
 * The directory is stubbed rather than reached: this file is about the SHELL,
 * and a unit test that needed a database would be testing something else.
 */

vi.mock('@/features/documents', () => ({
  getPublicBarangays: () =>
    Promise.resolve([
      { id: 'a0000000-0000-4000-8000-000000000001', name: 'San Isidro (Test)', code: 'test-si' },
    ]),
}))

describe('public shell', () => {
  it('renders exactly one level-1 heading on the home page', async () => {
    render(await PublicHomePage())

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('makes the skip link the first focusable element', async () => {
    const { container } = render(<PublicLayout>{await PublicHomePage()}</PublicLayout>)

    const focusable = container.querySelectorAll('a[href], button, input, select, textarea')
    const first = focusable[0]

    expect(first).toBeDefined()
    expect(first).toHaveAttribute('href', '#main')
    expect(first).toHaveTextContent(/skip to main content/i)
  })

  it('points the skip link at the main landmark', async () => {
    render(<PublicLayout>{await PublicHomePage()}</PublicLayout>)

    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('lists each barangay as a link into its public catalog', async () => {
    render(await PublicHomePage())

    expect(screen.getByRole('link', { name: 'San Isidro (Test)' })).toHaveAttribute(
      'href',
      '/catalog/a0000000-0000-4000-8000-000000000001',
    )
  })

  it('asks nobody to sign in before looking', async () => {
    // The portal exists to save a trip to the barangay hall. A page that
    // demanded an account first would not save it.
    render(await PublicHomePage())

    expect(screen.getByText(/you do not need an account to look/i)).toBeInTheDocument()
  })
})
