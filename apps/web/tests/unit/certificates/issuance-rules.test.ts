import { describe, expect, it } from 'vitest'

import {
  CERTIFICATE_TRANSITIONS,
  availableCertificateActions,
  canIssue,
  canTransition,
  isActive,
  issuanceBlock,
  templateIsApproved,
  templateWarnings,
  type IssuanceContext,
} from '@/features/certificates/rules/issuance'
import type {
  CertificateActorCapabilities,
  CertificateStatus,
  TemplateStanding,
} from '@/features/certificates/types/certificates'

const ALL_STATUSES: CertificateStatus[] = ['issued', 'voided']

const READY: IssuanceContext = {
  requestState: 'ready_for_issue',
  hasActiveCertificate: false,
  templateId: 'template-1',
  templateDocumentTypeId: 'type-1',
  requestDocumentTypeId: 'type-1',
  hasActiveSeries: true,
  canIssue: true,
}

const ALL_CAPABILITIES: CertificateActorCapabilities = {
  canIssue: true,
  canVoid: true,
  canReadArtifact: true,
}

const NO_CAPABILITIES: CertificateActorCapabilities = {
  canIssue: false,
  canVoid: false,
  canReadArtifact: false,
}

describe('issuance eligibility', () => {
  it('permits a ready request with a matching template and a live series', () => {
    expect(issuanceBlock(READY)).toBeNull()
    expect(canIssue(READY)).toBe(true)
  })

  it('refuses a request that has not been through review', () => {
    for (const requestState of ['draft', 'submitted', 'in_review']) {
      expect(issuanceBlock({ ...READY, requestState }), requestState).toBe('not_ready')
    }
  })

  it('refuses a request that already holds a live certificate', () => {
    expect(issuanceBlock({ ...READY, hasActiveCertificate: true })).toBe('already_issued')
  })

  it('refuses when no template was chosen', () => {
    expect(issuanceBlock({ ...READY, templateId: null })).toBe('no_template')
  })

  it('refuses a template that renders a different document type', () => {
    // Issuing an indigency template against a clearance request produces a
    // document that says the wrong thing over a real serial.
    expect(issuanceBlock({ ...READY, templateDocumentTypeId: 'type-2' })).toBe(
      'template_type_mismatch',
    )
  })

  it('refuses when the barangay has no serial book', () => {
    expect(issuanceBlock({ ...READY, hasActiveSeries: false })).toBe('no_series')
  })

  it('checks capability FIRST, so a refusal leaks nothing about the request', () => {
    // Phase 4 §13.6. If readiness were checked first, a caller without the
    // capability could distinguish "not ready" from "ready" — a probe for the
    // state of somebody else's request.
    const everythingWrong: IssuanceContext = {
      requestState: 'draft',
      hasActiveCertificate: true,
      templateId: null,
      templateDocumentTypeId: null,
      requestDocumentTypeId: 'type-1',
      hasActiveSeries: false,
      canIssue: false,
    }
    expect(issuanceBlock(everythingWrong)).toBe('not_permitted')
    // …and the answer is identical for a request that is perfectly ready.
    expect(issuanceBlock({ ...READY, canIssue: false })).toBe('not_permitted')
  })

  it('reports one block at a time so a surface can give one clear next step', () => {
    const block = issuanceBlock({ ...READY, requestState: 'draft', hasActiveSeries: false })
    expect(typeof block).toBe('string')
  })
})

describe('certificate lifecycle', () => {
  it('has exactly one edge: issued → voided', () => {
    const edges = ALL_STATUSES.flatMap((from) =>
      CERTIFICATE_TRANSITIONS[from].map((to) => `${from}->${to}`),
    )
    expect(edges).toEqual(['issued->voided'])
  })

  it('covers every status, so a new enum member cannot go unhandled', () => {
    expect(Object.keys(CERTIFICATE_TRANSITIONS).sort()).toEqual([...ALL_STATUSES].sort())
  })

  it('refuses to reinstate a voided certificate', () => {
    // A correction is a NEW certificate with a NEW serial. Reinstating would
    // leave the book unable to say which numbers are live.
    expect(canTransition('voided', 'issued')).toBe(false)
    expect(CERTIFICATE_TRANSITIONS.voided).toEqual([])
  })

  it('refuses a self-transition', () => {
    expect(canTransition('issued', 'issued')).toBe(false)
    expect(canTransition('voided', 'voided')).toBe(false)
  })

  it('treats only an issued certificate as active', () => {
    expect(isActive('issued')).toBe(true)
    expect(isActive('voided')).toBe(false)
  })
})

describe('available actions', () => {
  it('offers void on a live certificate to someone who may void', () => {
    expect(availableCertificateActions('issued', ALL_CAPABILITIES)).toContain('void')
  })

  it('withholds void from someone who may not void', () => {
    expect(
      availableCertificateActions('issued', { ...ALL_CAPABILITIES, canVoid: false }),
    ).not.toContain('void')
  })

  it('withholds void on an already voided certificate, however privileged the caller', () => {
    expect(availableCertificateActions('voided', ALL_CAPABILITIES)).not.toContain('void')
  })

  it('keeps a voided certificate downloadable — withdrawing it does not unmake it', () => {
    expect(availableCertificateActions('voided', ALL_CAPABILITIES)).toEqual(['download'])
  })

  it('requires the artifact capability for download, separately from read', () => {
    expect(
      availableCertificateActions('issued', { ...ALL_CAPABILITIES, canReadArtifact: false }),
    ).toEqual(['void'])
  })

  it('offers nothing at all to a caller with no capabilities', () => {
    for (const status of ALL_STATUSES) {
      expect(availableCertificateActions(status, NO_CAPABILITIES), status).toEqual([])
    }
  })

  it('never advertises an act the transition map forbids', () => {
    // Derived from CERTIFICATE_TRANSITIONS rather than a second hand-written
    // list, so this holds by construction — asserted anyway, because the
    // property is what matters and the derivation could be replaced.
    for (const status of ALL_STATUSES) {
      const actions = availableCertificateActions(status, ALL_CAPABILITIES)
      if (actions.includes('void')) {
        expect(canTransition(status, 'voided'), status).toBe(true)
      }
    }
  })
})

describe('template standing', () => {
  const standing = (overrides: Partial<TemplateStanding> = {}): TemplateStanding => ({
    contentIsPlaceholder: false,
    hasSignatory: true,
    requiresWetSignature: false,
    ...overrides,
  })

  it('approves a template only when the wording is approved AND a signatory is named', () => {
    expect(templateIsApproved(standing())).toBe(true)
  })

  it('refuses a template whose wording is still a placeholder (B-05/-06)', () => {
    expect(templateIsApproved(standing({ contentIsPlaceholder: true }))).toBe(false)
  })

  it('refuses a template with no named signatory', () => {
    expect(templateIsApproved(standing({ hasSignatory: false }))).toBe(false)
  })

  it('does not treat a wet-signature requirement as disapproval', () => {
    // B-07 says the paper still gets signed by hand. That is a workflow fact,
    // not a defect in the template.
    expect(templateIsApproved(standing({ requiresWetSignature: true }))).toBe(true)
  })

  it('reports EVERY applicable warning, not the first', () => {
    expect(
      templateWarnings(
        standing({ contentIsPlaceholder: true, hasSignatory: false, requiresWetSignature: true }),
      ),
    ).toEqual(['wording_unapproved', 'signatory_unconfirmed', 'requires_wet_signature'])
  })

  it('reports nothing for a fully approved template', () => {
    expect(templateWarnings(standing())).toEqual([])
  })

  it('warns about a wet signature even on an approved template', () => {
    expect(templateWarnings(standing({ requiresWetSignature: true }))).toEqual([
      'requires_wet_signature',
    ])
  })
})
