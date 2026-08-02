'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import type { Result } from '@/lib/errors'

/**
 * Refetches the current route once a Server Action reports success.
 *
 * Why this exists — measured against a production server, not theorised:
 *
 * 1. `revalidatePath()` inside the action invalidates the server caches, but
 *    its implicit client refresh did not arrive: with the mutation committed
 *    and audited, the members table still showed the previous value, and did
 *    not recover within 30 seconds (R-1-06). A hard reload always showed the
 *    new value, locating the fault in the client router, not the data.
 * 2. Refreshing on a COUNT of successful actions looks equivalent to the
 *    identity check below and is not: the same form succeeding twice leaves
 *    the count unchanged, so every mutation after the first silently stopped
 *    refetching.
 *
 * `revalidatePath()` stays in the actions: it invalidates server caches for
 * other clients and routes, which a local `router.refresh()` cannot do.
 *
 * KNOWN RESIDUAL (R-1-06): under `next start` the FIRST mutation in a page
 * session refetched in ~600 ms in every measured run, and later ones often do
 * not, with or without a settling delay between them — so it is not a race. The
 * mutation itself always commits and is always audited; only the rendered
 * value lags until the next navigation or reload. Gating the controls on the
 * refetch via `useTransition` was tried and rejected: its pending flag did not
 * clear within 10s, leaving the control permanently disabled, which is worse
 * than a stale value. Dev and CI are unaffected. Full measurements and the
 * recommended next step are in the risk register.
 */
export function useRefreshOnSuccess(states: readonly (Result<unknown> | null | undefined)[]): void {
  const router = useRouter()
  const seen = useRef<readonly unknown[]>([])

  useEffect(() => {
    const previous = seen.current

    // Identity, not value: a completed Server Action always produces a NEW
    // result object, which is the only reliable "this action just finished"
    // signal available here.
    const justSucceeded = states.some(
      (state, index) => state?.ok === true && state !== previous[index],
    )
    seen.current = states

    if (justSucceeded) {
      router.refresh()
    }
  }, [states, router])
}
