'use client'

import { useState } from 'react'

import { requestEvidenceUrlAction } from '../actions/request-evidence'
import { formatRequestEvidenceSize, requestEvidenceMimeLabel } from '../constants'
import type { RequestEvidenceItem } from '../types/documents'

/**
 * Staff view of a request's supporting documents (Slice 3D).
 *
 * Metadata is rendered; the FILE is not. A signed read URL is minted only when
 * a reviewer presses View, because a URL embedded at render time would be a
 * live bearer credential sitting in the HTML of a page that may be open,
 * screenshotted, or left on a shared counter machine.
 *
 * The list itself is gated on `requests.evidence.read`. When the caller lacks
 * it the page passes `null` rather than an empty array — "no documents" and
 * "not yours to see" are different facts and must not be conflated.
 */
export function RequestEvidenceViewer({
  barangayId,
  items,
}: {
  barangayId: string
  items: readonly RequestEvidenceItem[] | null
}) {
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  if (items === null) {
    return (
      <p className="text-neutral-700">
        Your role can see this request but not its supporting documents.
      </p>
    )
  }

  if (items.length === 0) {
    return <p className="text-neutral-700">No supporting documents were attached.</p>
  }

  async function open(evidenceId: string) {
    setBusyId(evidenceId)
    setError(null)
    const result = await requestEvidenceUrlAction({ evidenceId, barangayId })
    setBusyId(null)

    if (!result.ok) {
      setError(result.error.message)
      return
    }
    // Opened in a new tab rather than navigated to: the credential leaves with
    // that tab instead of becoming this page's referrer.
    window.open(result.data.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col gap-3">
      {error === null ? null : (
        <p
          role="alert"
          className="border-danger-100 text-danger-700 rounded-md border bg-white px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.evidenceId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 px-4 py-3"
          >
            <span className="text-neutral-900">
              {requestEvidenceMimeLabel(item.mimeType)}
              <span className="ml-2 text-sm text-neutral-500">
                {item.uploadedAt === null
                  ? 'never finished uploading'
                  : formatRequestEvidenceSize(item.sizeBytes ?? item.declaredSizeBytes)}
              </span>
            </span>
            {item.uploadedAt === null ? null : (
              <button
                type="button"
                onClick={() => void open(item.evidenceId)}
                disabled={busyId === item.evidenceId}
                className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-60"
              >
                {busyId === item.evidenceId ? 'Opening…' : 'View'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
