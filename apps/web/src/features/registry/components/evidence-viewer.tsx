'use client'

import { useState } from 'react'

import { requestEvidenceUrlAction } from '../actions/evidence'

/**
 * On-demand evidence access for reviewers (Slice 2F).
 *
 * The signed URL is requested when the reviewer ASKS — never while the page
 * renders, and never prefetched. It is held in memory for the moment it takes
 * to open a tab and is not written to storage, not put in a route parameter,
 * and not logged. The bucket name and object path never reach this component.
 *
 * The control is only rendered for holders of `verification.evidence.read`;
 * the action re-checks that capability and the Storage SELECT policy checks it
 * a third time, so rendering is convenience, not the boundary.
 */
export function EvidenceViewButton({
  barangayId,
  evidenceId,
  label,
}: {
  barangayId: string
  evidenceId: string
  label: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void (async () => {
            setBusy(true)
            setError(null)
            const result = await requestEvidenceUrlAction({ barangayId, evidenceId })
            setBusy(false)
            if (!result.ok) {
              setError(result.error.message)
              return
            }
            // Opened directly; the URL is short-lived and never stored.
            window.open(result.data.url, '_blank', 'noopener,noreferrer')
          })()
        }}
        className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100 disabled:opacity-60"
      >
        {busy ? 'Preparing…' : `View ${label}`}
      </button>
      {error ? (
        <p role="alert" className="text-danger-700 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
