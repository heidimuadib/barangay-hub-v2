import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import DocumentCatalogLoading from '@/app/(resident)/documents/loading'
import { CatalogList } from '@/features/documents/components/catalog-list'
import { DocumentTerms } from '@/features/documents/components/document-terms'
import { RequirementList } from '@/features/documents/components/requirement-list'
import { presentTerms } from '@/features/documents/rules/catalog-terms'
import type {
  CatalogEntry,
  CatalogTerms,
  RequirementField,
} from '@/features/documents/types/documents'

/**
 * Slice 3B presentation contract for the catalog.
 *
 * The rule that must never regress is B-08 / RES-06: no screen may present an
 * unconfirmed fee, turnaround or validity period as though it were official,
 * and a missing figure must never render as zero.
 */

const CONFIRMED_TERMS: CatalogTerms = {
  feeAmount: 50,
  feeCurrency: 'PHP',
  slaDays: 3,
  validityDays: 180,
  valuesArePlaceholder: false,
}

function terms(overrides: Partial<CatalogTerms> = {}): CatalogTerms {
  return { ...CONFIRMED_TERMS, ...overrides }
}

function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    documentTypeId: 'f0000000-0000-4000-8000-000000000001',
    code: 'barangay-clearance',
    name: 'Barangay Clearance (Test)',
    description: 'Certifies that the requester is a resident in good standing.',
    terms: terms({ valuesArePlaceholder: true }),
    requiresSupportingEvidence: false,
    requirementCount: 3,
    ...overrides,
  }
}

function requirement(overrides: Partial<RequirementField> = {}): RequirementField {
  return {
    requirementId: 'f1000000-0000-4000-8000-000000000001',
    key: 'years_of_residency',
    label: 'Years of residency',
    helpText: null,
    inputKind: 'text',
    isRequired: true,
    options: [],
    ...overrides,
  }
}

describe('DocumentTerms — B-08 honesty', () => {
  it('marks every unconfirmed figure and explains why', () => {
    render(<DocumentTerms terms={presentTerms(terms({ valuesArePlaceholder: true }))} />)

    // One chip per figure, plus the explanation that qualifies all three.
    expect(screen.getAllByText(/not yet confirmed/i).length).toBeGreaterThanOrEqual(3)
    expect(screen.getByRole('note')).toHaveTextContent(/has not confirmed its fees/i)
    expect(screen.getByRole('note')).toHaveTextContent(/B-08/)
  })

  it('states a missing fee as missing rather than as zero', () => {
    render(
      <DocumentTerms
        terms={presentTerms(terms({ feeAmount: null, valuesArePlaceholder: true }))}
      />,
    )

    expect(screen.getAllByText(/not set by the barangay yet/i).length).toBeGreaterThan(0)
    // The failure this guards against: a null amount rendering as a price.
    expect(screen.queryByText(/₱0\.00/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument()
  })

  it('shows a free document as a real amount, because free is a decision', () => {
    render(<DocumentTerms terms={presentTerms(terms({ feeAmount: 0 }))} />)

    expect(screen.getByText(/₱0\.00/)).toBeInTheDocument()
    expect(screen.queryByText(/not set by the barangay yet/i)).not.toBeInTheDocument()
  })

  it('drops the chip and the notice only once every figure is confirmed', () => {
    render(<DocumentTerms terms={presentTerms(terms())} />)

    expect(screen.queryByText(/not yet confirmed/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(screen.getByText('₱50.00')).toBeInTheDocument()
    expect(screen.getByText('3 working days')).toBeInTheDocument()
    expect(screen.getByText('6 months')).toBeInTheDocument()
  })

  it('still warns when a figure is missing even if the row claims to be confirmed', () => {
    // requiresPlaceholderNotice treats an absent figure as unconfirmed too, so
    // a half-filled "confirmed" row cannot look complete.
    render(<DocumentTerms terms={presentTerms(terms({ slaDays: null }))} />)
    expect(screen.getByRole('note')).toBeInTheDocument()
  })
})

describe('CatalogList', () => {
  it('explains an empty catalog instead of rendering nothing', () => {
    render(<CatalogList items={[]} />)

    expect(screen.getByText(/has not published any documents yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('links each document by opaque id only (P6-C-E)', () => {
    const item = entry()
    render(<CatalogList items={[{ entry: item, terms: presentTerms(item.terms) }]} />)

    const link = screen.getByRole('link', { name: item.name })
    expect(link).toHaveAttribute('href', `/documents/${item.documentTypeId}`)
    expect(link.getAttribute('href')).not.toContain('clearance')
  })

  it('carries the placeholder marking onto every card', () => {
    const item = entry()
    render(<CatalogList items={[{ entry: item, terms: presentTerms(item.terms) }]} />)

    const card = within(screen.getByRole('listitem'))
    expect(card.getAllByText(/not yet confirmed/i).length).toBeGreaterThan(0)
  })

  it('counts the questions so a resident can prepare before starting', () => {
    const cards = [
      { entry: entry({ requirementCount: 0 }), terms: presentTerms(terms()) },
      {
        entry: entry({
          documentTypeId: 'f0000000-0000-4000-8000-000000000002',
          requirementCount: 1,
        }),
        terms: presentTerms(terms()),
      },
      {
        entry: entry({
          documentTypeId: 'f0000000-0000-4000-8000-000000000003',
          requirementCount: 4,
        }),
        terms: presentTerms(terms()),
      },
    ]
    render(<CatalogList items={cards} />)

    expect(screen.getByText(/no extra questions/i)).toBeInTheDocument()
    expect(screen.getByText(/^1 question to answer\.$/)).toBeInTheDocument()
    expect(screen.getByText(/^4 questions to answer\.$/)).toBeInTheDocument()
  })

  it('says when supporting documents are expected', () => {
    const item = entry({ requiresSupportingEvidence: true })
    render(<CatalogList items={[{ entry: item, terms: presentTerms(item.terms) }]} />)

    expect(screen.getByText(/supporting documents are requested/i)).toBeInTheDocument()
  })
})

describe('RequirementList', () => {
  it('says plainly when a document asks for nothing extra', () => {
    render(<RequirementList requirements={[]} />)
    expect(screen.getByText(/asks for nothing beyond/i)).toBeInTheDocument()
  })

  it('marks optional questions as optional rather than hiding them', () => {
    render(
      <RequirementList
        requirements={[
          requirement(),
          requirement({ requirementId: 'r2', key: 'remarks', label: 'Remarks', isRequired: false }),
        ]}
      />,
    )

    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByText('Optional')).toBeInTheDocument()
  })

  it('shows the help text and the available choices up front', () => {
    render(
      <RequirementList
        requirements={[
          requirement({ helpText: 'How long they have lived at the address on file.' }),
          requirement({
            requirementId: 'r2',
            key: 'intended_use',
            label: 'Intended use',
            inputKind: 'select',
            options: ['Employment', 'School'],
          }),
        ]}
      />,
    )

    expect(screen.getByText(/how long they have lived/i)).toBeInTheDocument()
    expect(screen.getByText(/choose one: employment, school/i)).toBeInTheDocument()
  })
})

describe('catalog loading state', () => {
  it('announces progress to assistive technology', () => {
    render(<DocumentCatalogLoading />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading the documents/i)
  })
})
