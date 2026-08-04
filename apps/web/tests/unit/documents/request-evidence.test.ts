import { describe, expect, it } from 'vitest'

import {
  REQUEST_EVIDENCE_MAX_BYTES,
  REQUEST_EVIDENCE_MIME_TYPES,
  formatRequestEvidenceSize,
  requestEvidenceMimeLabel,
  screenRequestEvidenceFile,
} from '@/features/documents/constants'
import {
  isAllowedRequestEvidenceMime,
  requestEvidenceReadiness,
} from '@/features/documents/rules/request-evidence'
import { EVIDENCE_MIME_TYPES, EVIDENCE_MAX_BYTES } from '@/features/registry/constants'
import type { RequestEvidenceItem } from '@/features/documents/types/documents'

/**
 * Slice 3D — supporting-evidence rules.
 *
 * The database re-decides all of this (the MIME CHECK, the size CHECK, the
 * bucket's allow-list and `submit_request`'s EVIDENCE_REQUIRED gate). What is
 * tested here is that the SCREEN agrees with it, so a resident is told what is
 * wrong before a round trip rather than after one.
 */

function item(overrides: Partial<RequestEvidenceItem> = {}): RequestEvidenceItem {
  return {
    evidenceId: 'e1000000-0000-4000-8000-000000000001',
    mimeType: 'application/pdf',
    declaredSizeBytes: 2048,
    sizeBytes: 2048,
    uploadedAt: '2026-08-04T00:00:00.000Z',
    createdAt: '2026-08-04T00:00:00.000Z',
    ...overrides,
  }
}

describe('the allow-list matches Slice 2F exactly', () => {
  it('accepts the same four types the verification bucket accepts', () => {
    // Two different answers to "what may a resident upload" would be a bug
    // waiting for someone to find it, so this is asserted across features.
    expect([...REQUEST_EVIDENCE_MIME_TYPES].sort()).toEqual([...EVIDENCE_MIME_TYPES].sort())
  })

  it('uses the same 10 MiB ceiling', () => {
    expect(REQUEST_EVIDENCE_MAX_BYTES).toBe(EVIDENCE_MAX_BYTES)
    expect(REQUEST_EVIDENCE_MAX_BYTES).toBe(10 * 1024 * 1024)
  })

  it.each([...REQUEST_EVIDENCE_MIME_TYPES])('admits %s', (mime) => {
    expect(isAllowedRequestEvidenceMime(mime)).toBe(true)
  })

  it.each(['application/zip', 'text/html', 'image/svg+xml', ''])('refuses %s', (mime) => {
    expect(isAllowedRequestEvidenceMime(mime)).toBe(false)
  })
})

describe('browser-side screening', () => {
  it('passes an ordinary file', () => {
    expect(screenRequestEvidenceFile({ size: 2048, type: 'application/pdf' })).toBeNull()
  })

  it('refuses an empty file — a failed read, not a document', () => {
    expect(screenRequestEvidenceFile({ size: 0, type: 'application/pdf' })).toBe('empty')
  })

  it('refuses anything over the ceiling', () => {
    expect(
      screenRequestEvidenceFile({ size: REQUEST_EVIDENCE_MAX_BYTES + 1, type: 'image/png' }),
    ).toBe('too-large')
  })

  it('accepts exactly the ceiling', () => {
    expect(
      screenRequestEvidenceFile({ size: REQUEST_EVIDENCE_MAX_BYTES, type: 'image/png' }),
    ).toBeNull()
  })

  it('refuses a disallowed type', () => {
    expect(screenRequestEvidenceFile({ size: 100, type: 'application/zip' })).toBe(
      'unsupported-type',
    )
  })
})

describe('readiness mirrors the submit_request gate', () => {
  it('is satisfied by nothing when the type asks for nothing', () => {
    const ready = requestEvidenceReadiness([], false)
    expect(ready.satisfied).toBe(true)
    expect(ready.finalizedCount).toBe(0)
  })

  it('is NOT satisfied when the type asks and nothing is attached', () => {
    expect(requestEvidenceReadiness([], true).satisfied).toBe(false)
  })

  it('counts only FINALIZED items — a pending upload is an intention', () => {
    // The exact tightening 2F applied to submit_verification, and the reason
    // a failed upload can never look like a successful one.
    const ready = requestEvidenceReadiness([item({ uploadedAt: null })], true)

    expect(ready.satisfied).toBe(false)
    expect(ready.finalizedCount).toBe(0)
    expect(ready.pendingCount).toBe(1)
  })

  it('is satisfied by one finalized document', () => {
    const ready = requestEvidenceReadiness([item()], true)
    expect(ready.satisfied).toBe(true)
    expect(ready.finalizedCount).toBe(1)
  })

  it('reports pending alongside finalized rather than hiding it', () => {
    const ready = requestEvidenceReadiness(
      [item(), item({ evidenceId: 'e2', uploadedAt: null })],
      true,
    )

    expect(ready.satisfied).toBe(true)
    expect(ready.finalizedCount).toBe(1)
    expect(ready.pendingCount).toBe(1)
  })
})

describe('presentation helpers', () => {
  it('labels the file by TYPE — the original filename is never stored', () => {
    expect(requestEvidenceMimeLabel('application/pdf')).toBe('PDF document')
    expect(requestEvidenceMimeLabel('image/png')).toBe('PNG image')
  })

  it('falls back to a neutral label for anything unexpected', () => {
    expect(requestEvidenceMimeLabel('application/zip')).toBe('File')
  })

  it('formats sizes coarsely — precision serves nobody here', () => {
    expect(formatRequestEvidenceSize(512)).toBe('512 B')
    expect(formatRequestEvidenceSize(2048)).toBe('2 KB')
    expect(formatRequestEvidenceSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})
