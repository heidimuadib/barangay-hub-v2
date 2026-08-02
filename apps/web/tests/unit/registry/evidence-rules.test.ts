import { describe, expect, it } from 'vitest'

import {
  EVIDENCE_FILE_EXTENSIONS,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MIME_TYPES,
  evidenceKindLabel,
  evidenceMimeLabel,
  formatEvidenceSize,
  screenEvidenceFile,
} from '@/features/registry/constants'
import { evidenceReadiness, isAllowedEvidenceMime } from '@/features/registry/rules/evidence'
import type { EvidenceItem } from '@/features/registry/types/registry'

/**
 * Slice 2F evidence rules. These mirror what the database enforces
 * independently — the value of testing them is that a resident gets an honest
 * answer before uploading, and that the mirror cannot silently drift from the
 * SQL it claims to reflect.
 */

function item(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    evidenceId: 'e0000000-0000-4000-8000-000000000001',
    kind: 'identity',
    mimeType: 'image/png',
    declaredSizeBytes: 2048,
    sizeBytes: 2048,
    uploadedAt: '2026-08-02T00:00:00.000Z',
    createdAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('screenEvidenceFile', () => {
  it('rejects an empty file', () => {
    expect(screenEvidenceFile({ size: 0, type: 'image/png' })).toBe('empty')
  })

  it('rejects a file over the 10 MiB ceiling but accepts one exactly at it', () => {
    expect(screenEvidenceFile({ size: EVIDENCE_MAX_BYTES + 1, type: 'image/png' })).toBe(
      'too-large',
    )
    expect(screenEvidenceFile({ size: EVIDENCE_MAX_BYTES, type: 'image/png' })).toBeNull()
  })

  it('rejects a type outside the D2-03 allow-list', () => {
    expect(screenEvidenceFile({ size: 1024, type: 'image/gif' })).toBe('unsupported-type')
    expect(screenEvidenceFile({ size: 1024, type: 'application/x-msdownload' })).toBe(
      'unsupported-type',
    )
    // An empty MIME string is what a browser reports for unknown types.
    expect(screenEvidenceFile({ size: 1024, type: '' })).toBe('unsupported-type')
  })

  it('accepts every allowed type', () => {
    for (const mime of EVIDENCE_MIME_TYPES) {
      expect(screenEvidenceFile({ size: 1024, type: mime })).toBeNull()
    }
  })

  it('checks emptiness before size and type, so the clearest reason wins', () => {
    expect(screenEvidenceFile({ size: 0, type: 'image/gif' })).toBe('empty')
  })
})

describe('isAllowedEvidenceMime', () => {
  it('agrees with the constant the database CHECK mirrors', () => {
    for (const mime of EVIDENCE_MIME_TYPES) expect(isAllowedEvidenceMime(mime)).toBe(true)
    expect(isAllowedEvidenceMime('text/html')).toBe(false)
    expect(isAllowedEvidenceMime('application/pdf ')).toBe(false)
  })
})

describe('file picker extensions', () => {
  it('offers exactly the extensions the allow-list can accept', () => {
    // A picker that offers .gif would let a resident choose a file the server
    // must then refuse — the two lists are kept in step deliberately.
    expect(EVIDENCE_FILE_EXTENSIONS).toBe('.jpg,.jpeg,.png,.webp,.pdf')
    expect(EVIDENCE_FILE_EXTENSIONS).not.toContain('.gif')
    expect(EVIDENCE_FILE_EXTENSIONS).not.toContain('.exe')
  })
})

describe('safe labels', () => {
  it('names categories generically — never a document catalog', () => {
    expect(evidenceKindLabel('identity')).toBe('Identity evidence')
    expect(evidenceKindLabel('residency')).toBe('Proof of residency')
    expect(evidenceKindLabel('supporting')).toBe('Supporting document')
  })

  it('describes the file by TYPE, never by filename', () => {
    expect(evidenceMimeLabel('image/jpeg')).toBe('JPEG image')
    expect(evidenceMimeLabel('application/pdf')).toBe('PDF document')
    // Unknown types degrade to a neutral word rather than echoing input back.
    expect(evidenceMimeLabel('application/x-evil')).toBe('File')
    expect(evidenceMimeLabel('<script>')).toBe('File')
  })

  it('formats sizes coarsely', () => {
    expect(formatEvidenceSize(512)).toBe('512 B')
    expect(formatEvidenceSize(2048)).toBe('2 KB')
    expect(formatEvidenceSize(1024 * 1024 * 3)).toBe('3.0 MB')
  })
})

describe('evidenceReadiness — mirrors submit_verification', () => {
  it('requires one FINALIZED item of each required kind', () => {
    const ready = evidenceReadiness([
      item({ kind: 'identity' }),
      item({ evidenceId: 'e2', kind: 'residency' }),
    ])
    expect(ready).toEqual({
      hasIdentity: true,
      hasResidency: true,
      pendingCount: 0,
      canSubmit: true,
    })
  })

  it('does not count a PENDING upload — the whole point of finalization', () => {
    const ready = evidenceReadiness([
      item({ kind: 'identity' }),
      item({ evidenceId: 'e2', kind: 'residency', uploadedAt: null, sizeBytes: null }),
    ])
    expect(ready.hasResidency).toBe(false)
    expect(ready.canSubmit).toBe(false)
    expect(ready.pendingCount).toBe(1)
  })

  it('refuses when either kind is missing entirely', () => {
    expect(evidenceReadiness([item({ kind: 'identity' })]).canSubmit).toBe(false)
    expect(evidenceReadiness([item({ kind: 'residency' })]).canSubmit).toBe(false)
    expect(evidenceReadiness([]).canSubmit).toBe(false)
  })

  it('does not let a supporting document stand in for a required kind', () => {
    const ready = evidenceReadiness([
      item({ kind: 'identity' }),
      item({ evidenceId: 'e2', kind: 'supporting' }),
    ])
    expect(ready.hasResidency).toBe(false)
    expect(ready.canSubmit).toBe(false)
  })

  it('counts every pending item, of any kind', () => {
    const ready = evidenceReadiness([
      item({ kind: 'identity' }),
      item({ evidenceId: 'e2', kind: 'residency' }),
      item({ evidenceId: 'e3', kind: 'supporting', uploadedAt: null }),
      item({ evidenceId: 'e4', kind: 'identity', uploadedAt: null }),
    ])
    // Still submittable: the required kinds are finalized, and the pending
    // extras simply will not be sent.
    expect(ready.canSubmit).toBe(true)
    expect(ready.pendingCount).toBe(2)
  })
})
