import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import PublicLayout from './layout'
import PublicHomePage from './page'

/**
 * Verifies that React Testing Library, the JSX pipeline and the accessibility
 * baseline are all wired correctly. The assertions are behavioural rather than
 * structural so they survive the Slice 1 rewrite of these components.
 */
describe('public shell', () => {
  it('renders exactly one level-1 heading on the home page', () => {
    render(<PublicHomePage />)

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('makes the skip link the first focusable element', () => {
    const { container } = render(
      <PublicLayout>
        <PublicHomePage />
      </PublicLayout>,
    )

    const focusable = container.querySelectorAll('a[href], button, input, select, textarea')
    const first = focusable[0]

    expect(first).toBeDefined()
    expect(first).toHaveAttribute('href', '#main')
    expect(first).toHaveTextContent(/skip to main content/i)
  })

  it('points the skip link at the main landmark', () => {
    render(
      <PublicLayout>
        <PublicHomePage />
      </PublicLayout>,
    )

    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })
})
