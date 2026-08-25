import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  LoadingState,
  PageHeader,
  SectionHeader,
  SkeletonRows,
  TBody,
  Table,
  TableCardList,
  TableFooter,
  TableFrame,
  Td,
  Th,
  THead,
  Tr,
  buttonClasses,
} from '@/components/ui'

/**
 * UI-A — the primitives' behavioural contracts.
 *
 * Not snapshots. Each assertion here is a property some route depends on, and
 * the reason the primitive exists rather than the class string being copied a
 * twenty-first time.
 */

describe('Button', () => {
  it('defaults to type="button"', () => {
    // The HTML default is `submit`. An unlabelled type inside a form is how a
    // "Cancel" ends up submitting it.
    render(<Button>Cancel</Button>)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('type', 'button')
  })

  it('still allows an explicit submit', () => {
    render(<Button type="submit">Send</Button>)
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAttribute('type', 'submit')
  })

  it('keeps its icon decorative so the label is announced once', () => {
    const { container } = render(<Button icon="plus">Add a walk-in resident</Button>)

    expect(screen.getByRole('button', { name: 'Add a walk-in resident' })).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('forwards disabled state', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})

describe('buttonClasses — the 44px floor', () => {
  /**
   * R-2-05 was a shell link at 20–27px against a stated 44px Definition of Done.
   * Two properties keep that from recurring, and the second is the subtle one:
   * `min-h-11` on a bare `next/link` does nothing, because an inline `<a>`
   * ignores min-height. `inline-flex` is what makes the floor real.
   */
  it('applies the minimum height in every variant and size', () => {
    for (const variant of ['primary', 'secondary', 'subtle', 'danger'] as const) {
      for (const size of ['md', 'sm'] as const) {
        expect(buttonClasses({ variant, size }), `${variant}/${size}`).toContain('min-h-11')
      }
    }
  })

  it('makes the height apply to inline elements such as a link', () => {
    expect(buttonClasses()).toContain('inline-flex')
  })

  it('never reduces height for the small size — only padding and type', () => {
    expect(buttonClasses({ size: 'sm' })).toContain('min-h-11')
    expect(buttonClasses({ size: 'sm' })).not.toContain('min-h-9')
  })
})

describe('IconButton', () => {
  it('carries an accessible name and does not repeat it in the glyph', () => {
    const { container } = render(<IconButton icon="x" label="Dismiss" />)

    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('is at least the minimum target in both dimensions', () => {
    render(<IconButton icon="x" label="Dismiss" />)
    expect(screen.getByRole('button', { name: 'Dismiss' }).className).toContain('size-11')
  })
})

describe('Badge', () => {
  it('renders the state as text, never colour alone', () => {
    render(<Badge tone="success">ready for issue</Badge>)
    expect(screen.getByText('ready for issue')).toBeInTheDocument()
  })

  it('offers no brand tone, so a tenant cannot recolour a status', () => {
    // Asserted as an absence: statuses draw from the locked semantic scale only
    // (Phase 2 §8.1). A `brand` tone would let a barangay make "rejected" green.
    const tones = ['neutral', 'info', 'success', 'warning', 'danger']
    for (const tone of tones) {
      const { unmount } = render(<Badge tone={tone as 'neutral'}>state</Badge>)
      unmount()
    }
    expect(tones).not.toContain('brand')
  })
})

describe('Alert', () => {
  it('announces a result by default', () => {
    render(<Alert tone="success">Your request was submitted.</Alert>)
    expect(screen.getByRole('status')).toHaveTextContent('Your request was submitted.')
  })

  it('interrupts for a blocking failure', () => {
    render(
      <Alert tone="danger" live="alert">
        We could not save that.
      </Alert>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('We could not save that.')
  })

  it('stays silent for standing page content', () => {
    // A notice that was on the page before the user arrived must not be read out
    // on load — that announces the furniture.
    render(
      <Alert tone="warning" live="none">
        Fees are not yet confirmed.
      </Alert>,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Fees are not yet confirmed.')).toBeInTheDocument()
  })

  it('conveys tone in text, not only in the icon', () => {
    const { container } = render(
      <Alert tone="warning" title="Not yet confirmed">
        This fee is a placeholder.
      </Alert>,
    )
    expect(screen.getByText('Not yet confirmed')).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('EmptyState', () => {
  it('announces the absence and explains it', () => {
    render(
      <EmptyState title="No requests need action">
        Requests appear here as residents submit them.
      </EmptyState>,
    )

    const status = screen.getByRole('status')
    expect(within(status).getByText('No requests need action')).toBeInTheDocument()
    expect(
      within(status).getByText('Requests appear here as residents submit them.'),
    ).toBeInTheDocument()
  })

  it('can say "not yours to see" rather than "nothing here"', () => {
    // The two facts are different, and conflating them tells a user something
    // untrue while hiding a capability-mapping mistake.
    render(
      <EmptyState title="Not available to your role" reason="restricted">
        Ask your barangay administrator.
      </EmptyState>,
    )
    expect(screen.getByText('Not available to your role')).toBeInTheDocument()
  })
})

describe('LoadingState', () => {
  it('announces loading as text with a decorative spinner', () => {
    const { container } = render(<LoadingState label="Loading the verification queue…" />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading the verification queue…')
    // Under prefers-reduced-motion the spinner stops turning, so the text has to
    // carry the meaning on its own.
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })
})

describe('SkeletonRows', () => {
  it('announces once and hides the placeholder bars', () => {
    const { container } = render(<SkeletonRows rows={4} label="Loading members…" />)

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByText('Loading members…')).toBeInTheDocument()
    // Four bars, none of them announced — otherwise a screen reader reads four
    // empty rows.
    expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(4)
  })
})

describe('Breadcrumbs', () => {
  const trail = [
    { label: 'Requests', href: '/staff/requests' },
    { label: 'Request detail' },
  ] as const

  it('is a labelled navigation landmark', () => {
    render(<Breadcrumbs trail={trail} />)
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
  })

  it('marks the current page and does not link it', () => {
    render(<Breadcrumbs trail={trail} />)

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(nav).getByRole('link', { name: 'Requests' })).toHaveAttribute(
      'href',
      '/staff/requests',
    )
    expect(within(nav).queryByRole('link', { name: 'Request detail' })).not.toBeInTheDocument()
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  })

  it('renders nothing for an empty trail', () => {
    render(<Breadcrumbs trail={[]} />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

describe('PageHeader', () => {
  it('renders exactly one h1', () => {
    // Every route is asserted end-to-end to have exactly one h1. A component
    // that emitted two, or none, could break that from inside any page.
    render(<PageHeader title="Resident registry" description="Everyone registered here." />)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Resident registry')
  })

  it('places breadcrumbs, status and action alongside the heading', () => {
    render(
      <PageHeader
        title="Request detail"
        breadcrumbs={[{ label: 'Requests', href: '/staff/requests' }, { label: 'Detail' }]}
        meta={<Badge tone="info">in review</Badge>}
        action={<Button>Mark ready</Button>}
      />,
    )

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
    expect(screen.getByText('in review')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark ready' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})

describe('SectionHeader and CardHeader', () => {
  it('never emits an h1, so it cannot compete with the page heading', () => {
    render(
      <>
        <SectionHeader title="Main menu" />
        <Card>
          <CardHeader as="h2" title="My document requests" />
        </Card>
      </>,
    )

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Main menu' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'My document requests' }),
    ).toBeInTheDocument()
  })

  it('exposes an id so a card can label its own section', () => {
    render(
      <section aria-labelledby="requests-heading">
        <CardHeader as="h2" id="requests-heading" title="My document requests" />
      </section>,
    )
    expect(screen.getByRole('region', { name: 'My document requests' })).toBeInTheDocument()
  })
})

describe('Table', () => {
  function listing() {
    return render(
      <TableFrame>
        <Table caption="Document requests, oldest first">
          <THead>
            <Tr>
              <Th>Requester</Th>
              <Th>Status</Th>
            </Tr>
          </THead>
          <TBody>
            <Tr>
              <Td>Juan Dela Cruz (Test)</Td>
              <Td>
                <Badge tone="info">in review</Badge>
              </Td>
            </Tr>
          </TBody>
        </Table>
        <TableCardList>
          <li>Juan Dela Cruz (Test) — in review</li>
        </TableCardList>
        <TableFooter summary="Showing 1 of 1 request" />
      </TableFrame>,
    )
  }

  it('is named by its caption', () => {
    // `getByRole('table', { name })` is exactly how the e2e roster assertion
    // finds it, so the caption is the accessible name and not decoration.
    listing()
    expect(
      screen.getByRole('table', { name: 'Document requests, oldest first' }),
    ).toBeInTheDocument()
  })

  it('gives every column header a scope', () => {
    listing()
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(2)
    for (const header of headers) {
      expect(header).toHaveAttribute('scope', 'col')
    }
  })

  it('pairs a wide-viewport table with a narrow-viewport list', () => {
    /**
     * The e2e suite asserts a phone gets NO table and a list instead. jsdom has
     * no viewport, so what is checkable here is that the two halves carry
     * complementary breakpoints — a table hidden until `sm`, a list hidden from
     * `sm`. Rendering one without the other leaves a viewport blank.
     */
    listing()
    const table = screen.getByRole('table')
    expect(table.className).toContain('hidden')
    expect(table.className).toContain('sm:table')
    expect(screen.getByRole('list').className).toContain('sm:hidden')
  })

  it('states the count, not only page controls', () => {
    listing()
    expect(screen.getByText('Showing 1 of 1 request')).toBeInTheDocument()
  })

  it('can show the caption when a listing needs a visible title', () => {
    render(
      <Table caption="All residents" captionVisible>
        <TBody>
          <Tr>
            <Td>row</Td>
          </Tr>
        </TBody>
      </Table>,
    )
    const caption = screen.getByText('All residents')
    expect(caption.className).not.toContain('sr-only')
  })
})
