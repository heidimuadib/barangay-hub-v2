import { describe, expect, it } from 'vitest'

import {
  TERMINAL_STATES,
  VERIFICATION_TRANSITIONS,
  canTransition,
  isActionableByStaff,
  isEditable,
  isTerminal,
  requiresReason,
} from '@/features/registry/rules/verification-transitions'
import type { VerificationState } from '@/features/registry/types/registry'

const ALL: VerificationState[] = [
  'draft',
  'submitted',
  'in_review',
  'info_requested',
  'resubmitted',
  'approved',
  'rejected',
]

describe('verification state machine', () => {
  it('permits exactly the seven approved transitions and nothing else', () => {
    const permitted = ALL.flatMap((from) =>
      ALL.filter((to) => canTransition(from, to)).map((to) => `${from}→${to}`),
    )
    expect(permitted.sort()).toEqual(
      [
        'draft→submitted',
        'submitted→in_review',
        'resubmitted→in_review',
        'in_review→info_requested',
        'in_review→approved',
        'in_review→rejected',
        'info_requested→resubmitted',
      ].sort(),
    )
  })

  it('locks terminal states outright — a new application is the only way forward', () => {
    for (const terminal of TERMINAL_STATES) {
      expect(isTerminal(terminal)).toBe(true)
      for (const to of ALL) {
        expect(canTransition(terminal, to)).toBe(false)
      }
    }
  })

  it('never permits a self-transition', () => {
    for (const state of ALL) {
      expect(canTransition(state, state)).toBe(false)
    }
  })

  it('covers every state in the transition map exactly once', () => {
    expect(Object.keys(VERIFICATION_TRANSITIONS).sort()).toEqual([...ALL].sort())
  })

  it('marks only draft and info_requested as evidence-editable', () => {
    expect(ALL.filter(isEditable)).toEqual(['draft', 'info_requested'])
  })

  it('surfaces exactly the staff-actionable states for the queue', () => {
    expect(ALL.filter(isActionableByStaff)).toEqual(['submitted', 'in_review', 'resubmitted'])
  })

  it('requires a reason for rejection and only for rejection', () => {
    expect(ALL.filter(requiresReason)).toEqual(['rejected'])
  })
})
