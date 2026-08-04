'use client'

import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'

import {
  finalizeRequestEvidenceAction,
  prepareRequestEvidenceAction,
  removeRequestEvidenceAction,
} from '../actions/request-evidence'
import {
  REQUEST_EVIDENCE_FILE_EXTENSIONS,
  formatRequestEvidenceSize,
  requestEvidenceMimeLabel,
  screenRequestEvidenceFile,
  type RequestEvidenceRejection,
} from '../constants'
import type { RequestEvidenceItem } from '../types/documents'

/**
 * Supporting-document upload for a draft request (Slice 3D).
 *
 * The browser uploads DIRECTLY into the private bucket using a one-object
 * signed ticket the server issued: the bytes never pass through the Next
 * server, and the browser never holds a service-role credential or learns any
 * bucket name it could reason about.
 *
 * Three steps, in this order, and the order is the security property:
 *   1. reserve a metadata row → receive a ticket for exactly one object path;
 *   2. PUT the bytes to that URL;
 *   3. ask the server to VERIFY the object exists and finalize.
 *
 * A row that stops after step 1 or 2 is PENDING. It is listed honestly, counts
 * for nothing toward submission, and can be retried or removed — which is why
 * a failed upload never looks like a successful one.
 */

const REJECTION_COPY: Record<RequestEvidenceRejection, string> = {
  empty: 'That file is empty.',
  'too-large': 'That file is larger than 10 MB.',
  'unsupported-type': 'Attach a JPEG, PNG, WebP or PDF.',
}

type UploadPhase =
  | { readonly status: 'idle' }
  | { readonly status: 'uploading' }
  | { readonly status: 'failed'; readonly message: string }

/** sha-256 of the bytes, for the tamper-evidence record (D2-03). */
async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function RequestEvidenceManager({
  requestId,
  items,
  required,
}: {
  requestId: string
  items: readonly RequestEvidenceItem[]
  required: boolean
}) {
  const router = useRouter()
  const [phase, setPhase] = useState<UploadPhase>({ status: 'idle' })
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputId = useId()

  const busy = phase.status === 'uploading'
  const finalized = items.filter((item) => item.uploadedAt !== null)
  const pending = items.length - finalized.length

  async function upload(file: File) {
    const rejection = screenRequestEvidenceFile(file)
    if (rejection) {
      setPhase({ status: 'failed', message: REJECTION_COPY[rejection] })
      return
    }

    setPhase({ status: 'uploading' })
    try {
      // 1. Reserve the row and get a ticket for exactly one object.
      const prepared = await prepareRequestEvidenceAction({
        requestId,
        mimeType: file.type,
        declaredSizeBytes: file.size,
      })
      if (!prepared.ok) {
        setPhase({ status: 'failed', message: prepared.error.message })
        return
      }

      // 2. Straight to Storage. A plain fetch rather than supabase-js, which
      //    would inline the environment schema — and therefore the NAMES of
      //    every server secret — into the client bundle.
      const uploaded = await fetch(prepared.data.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      })
      if (!uploaded.ok) {
        // The row stays PENDING: it counts for nothing and can be retried.
        setPhase({ status: 'failed', message: 'The upload did not finish. Please try again.' })
        return
      }

      // 3. The server verifies the object and finalizes. Only this makes the
      //    document count toward submission.
      const done = await finalizeRequestEvidenceAction({
        evidenceId: prepared.data.evidenceId,
        requestId,
        contentHash: await sha256Hex(file),
      })
      if (!done.ok) {
        setPhase({ status: 'failed', message: done.error.message })
        return
      }

      setPhase({ status: 'idle' })
      if (inputRef.current) inputRef.current.value = ''
      router.refresh()
    } catch {
      setPhase({ status: 'failed', message: 'The upload did not finish. Please try again.' })
    }
  }

  async function remove(evidenceId: string) {
    const removed = await removeRequestEvidenceAction({ evidenceId, requestId })
    if (!removed.ok) {
      setPhase({ status: 'failed', message: removed.error.message })
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-neutral-700">
        {required
          ? 'This document needs at least one supporting file before you can submit it.'
          : 'You may attach a supporting file if the barangay asked for one.'}
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing attached yet.</p>
      ) : (
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
                    ? 'not uploaded — does not count yet'
                    : `added · ${formatRequestEvidenceSize(item.sizeBytes ?? item.declaredSizeBytes)}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void remove(item.evidenceId)}
                className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-100"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {pending > 0 ? (
        <p role="status" className="text-warning-700 text-sm">
          {pending} attachment{pending === 1 ? '' : 's'} did not finish uploading. Remove and try
          again — {pending === 1 ? 'it does' : 'they do'} not count toward submitting.
        </p>
      ) : null}

      {phase.status === 'failed' ? (
        <p
          role="alert"
          className="border-danger-100 text-danger-700 rounded-md border bg-white px-3 py-2 text-sm"
        >
          {phase.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-sm font-medium text-neutral-900">
          Attach a supporting document
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={REQUEST_EVIDENCE_FILE_EXTENSIONS}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
          className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2"
        />
        <p className="text-sm text-neutral-500">
          JPEG, PNG, WebP or PDF, up to 10 MB. Use a real document — never someone else’s.
          {busy ? ' Uploading…' : ''}
        </p>
      </div>
    </div>
  )
}
