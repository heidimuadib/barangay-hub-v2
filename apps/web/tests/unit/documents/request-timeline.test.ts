import { describe, expect, it } from 'vitest'

import { REQUEST_TRANSITIONS } from '@/features/documents/rules/request-transitions'
import {
  REQUEST_PROGRESSION,
  requestTimeline,
  type RequestTimestamps,
} from '@/features/documents/rules/request-timeline'
import type { DocumentRequestState } from '@/features/documents/types/documents'

/**
 * Slice 3B — the resident's progress readout.
 *
 * The timeline is derived, not hand-written, so the guarantee under test is
 * that it cannot drift from the state machine the database enforces.
 */

const ALL: RequestTimestamps = {
  createdAt: '2026-08-01T00:00:00.000Z',
  submittedAt: '2026-08-02T00:00:00.000Z',
  reviewStartedAt: '2026-08-03T00:00:00.000Z',
  readyAt: '2026-08-04T00:00:00.000Z',
}

describe('REQUEST_PROGRESSION', () => {
  it('is exactly the states the transition map knows about', () => {
    expect([...REQUEST_PROGRESSION].sort()).toEqual(Object.keys(REQUEST_TRANSITIONS).sort())
  })

  it('follows the only path the database permits', () => {
    // Each step must be a legal successor of the one before it, so the drawn
    // order and the enforced order are provably the same order.
    for (let index = 0; index < REQUEST_PROGRESSION.length - 1; index += 1) {
      const from = REQUEST_PROGRESSION[index] as DocumentRequestState
      const to = REQUEST_PROGRESSION[index + 1] as DocumentRequestState
      expect(REQUEST_TRANSITIONS[from]).toContain(to)
    }
  })

  it('stops at the Slice 3 terminus and promises no Slice 4 step', () => {
    expect(REQUEST_PROGRESSION.at(-1)).toBe('ready_for_issue')
    expect(REQUEST_PROGRESSION).toHaveLength(4)
  })
})

describe('requestTimeline', () => {
  it('marks a draft as the current step with nothing done before it', () => {
    const steps = requestTimeline('draft', {
      ...ALL,
      submittedAt: null,
      reviewStartedAt: null,
      readyAt: null,
    })

    expect(steps.map((step) => step.status)).toEqual([
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ])
    expect(steps[0]?.at).toBe(ALL.createdAt)
  })

  it('marks everything before the current state as done', () => {
    const steps = requestTimeline('in_review', { ...ALL, readyAt: null })

    expect(steps.map((step) => step.status)).toEqual(['done', 'done', 'current', 'upcoming'])
  })

  it('marks the terminus current rather than done — nothing follows it in Slice 3', () => {
    const steps = requestTimeline('ready_for_issue', ALL)

    expect(steps.map((step) => step.status)).toEqual(['done', 'done', 'done', 'current'])
  })

  it('attaches each state its own timestamp', () => {
    const steps = requestTimeline('ready_for_issue', ALL)

    expect(steps.map((step) => step.at)).toEqual([
      ALL.createdAt,
      ALL.submittedAt,
      ALL.reviewStartedAt,
      ALL.readyAt,
    ])
  })

  it('never shows a time against a step that has not happened', () => {
    const steps = requestTimeline('submitted', ALL)

    // reviewStartedAt/readyAt are populated here, which only happens on a
    // malformed row — an upcoming step must still read as not-yet.
    expect(steps[2]?.at).toBeNull()
    expect(steps[3]?.at).toBeNull()
  })

  it('shows a missing timestamp as missing rather than inventing one', () => {
    const steps = requestTimeline('submitted', { ...ALL, submittedAt: null })

    expect(steps[1]?.status).toBe('current')
    expect(steps[1]?.at).toBeNull()
  })
})
