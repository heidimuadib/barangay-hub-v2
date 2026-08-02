import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'
import { fail, ok, type Result } from '@/lib/errors'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

type States = readonly (Result<unknown> | null)[]

function renderStates(initial: States) {
  return renderHook(({ states }: { states: States }) => useRefreshOnSuccess(states), {
    initialProps: { states: initial },
  })
}

describe('useRefreshOnSuccess', () => {
  beforeEach(() => {
    refresh.mockClear()
  })

  it('does not refetch before any action has run', () => {
    renderStates([null])

    expect(refresh).not.toHaveBeenCalled()
  })

  it('refetches once an action reports success', () => {
    const { rerender } = renderStates([null])
    expect(refresh).not.toHaveBeenCalled()

    rerender({ states: [ok(null)] })

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does NOT refetch when an action fails — nothing changed server-side', () => {
    const { rerender } = renderStates([null])

    rerender({ states: [fail({ code: 'AUTHORIZATION_DENIED', message: 'nope' })] })

    expect(refresh).not.toHaveBeenCalled()
  })

  /**
   * The regression that shipped and had to be measured out of production: a
   * hook that counts currently-successful actions refreshes the first mutation
   * and silently never refreshes any later one, because the count stays at 1.
   * Every consecutive success on the SAME form must refetch.
   */
  it('refetches again when the SAME action succeeds a second and third time', () => {
    const { rerender } = renderStates([null])

    rerender({ states: [ok(null)] })
    expect(refresh).toHaveBeenCalledTimes(1)

    rerender({ states: [ok(null)] })
    expect(refresh).toHaveBeenCalledTimes(2)

    rerender({ states: [ok(null)] })
    expect(refresh).toHaveBeenCalledTimes(3)
  })

  it('refetches when a different action in the same group succeeds', () => {
    const first = ok(null)
    const { rerender } = renderStates([null, null])

    rerender({ states: [first, null] })
    expect(refresh).toHaveBeenCalledTimes(1)

    // The first result is unchanged; only the second completed.
    rerender({ states: [first, ok(null)] })
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('does not refetch repeatedly while the result is unchanged', () => {
    const settled = ok(null)
    const { rerender } = renderStates([settled])
    expect(refresh).toHaveBeenCalledTimes(1)

    // Re-rendering for any other reason must not spin the router — an unstable
    // router identity re-runs this effect on every render.
    rerender({ states: [settled] })
    rerender({ states: [settled] })

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('ignores failures interleaved between successes', () => {
    const failure = fail({ code: 'CONFLICT', message: 'already has this role' })
    // Reused deliberately: a NEW ok() object means a NEW completed action and
    // must refetch, so holding the identity fixed is what isolates the failure.
    const success = ok(null)
    const { rerender } = renderStates([null, null])

    rerender({ states: [failure, null] })
    expect(refresh).not.toHaveBeenCalled()

    rerender({ states: [failure, success] })
    expect(refresh).toHaveBeenCalledTimes(1)

    // A later, different failure alongside the unchanged success: nothing new
    // committed, so nothing to re-read.
    rerender({ states: [fail({ code: 'NOT_FOUND', message: 'gone' }), success] })
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
