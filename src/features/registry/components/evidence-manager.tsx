'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useId, useRef, useState } from 'react'

import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'
import type { Result } from '@/lib/errors'

import {
  finalizeEvidenceAction,
  prepareEvidenceUploadAction,
  removeEvidenceAction,
  submitApplicationAction,
} from '../actions/evidence'
import {
  EVIDENCE_FILE_EXTENSIONS,
  evidenceKindLabel,
  evidenceMimeLabel,
  formatEvidenceSize,
  screenEvidenceFile,
  type EvidenceRejection,
} from '../constants'
import type { EvidenceItem, EvidenceKind, EvidenceReadiness } from '../types/registry'

/**
 * Resident evidence upload and submission (Slice 2F).
 *
 * The browser uploads DIRECTLY to the private bucket using a one-object
 * signed ticket the server issued: the bytes never pass through the Next
 * server, and the browser never holds a service-role credential or learns any
 * path but its own. Nothing is persisted client-side — no file is written to
 * localStorage or IndexedDB; a failed upload is simply retried from the
 * picker.
 *
 * The server verifies the object independently before anything counts, so the
 * status shown here is a report of what the database confirmed, never a claim
 * the client made about itself.
 */

const REJECTION_COPY: Record<EvidenceRejection, string> = {
  empty: 'That file is empty. Choose a different one.',
  'too-large': 'That file is larger than 10 MB. Choose a smaller one.',
  'unsupported-type': 'Use a JPEG, PNG, WebP or PDF file.',
}

type UploadPhase =
  | { readonly status: 'idle' }
  | { readonly status: 'uploading'; readonly kind: EvidenceKind }
  | { readonly status: 'failed'; readonly message: string }

/** sha-256 of the bytes, for the tamper-evidence record (D2-03). */
async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function EvidencePicker({
  applicationId,
  kind,
  onUploaded,
}: {
  applicationId: string
  kind: EvidenceKind
  onUploaded: () => void
}) {
  const [phase, setPhase] = useState<UploadPhase>({ status: 'idle' })
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputId = useId()

  const busy = phase.status === 'uploading'

  async function upload(file: File) {
    const rejection = screenEvidenceFile(file)
    if (rejection) {
      setPhase({ status: 'failed', message: REJECTION_COPY[rejection] })
      return
    }

    setPhase({ status: 'uploading', kind })
    try {
      // 1. Reserve the metadata row and get a ticket for exactly one object.
      const prepared = await prepareEvidenceUploadAction({
        applicationId,
        kind,
        mimeType: file.type,
        declaredSizeBytes: file.size,
      })
      if (!prepared.ok) {
        setPhase({ status: 'failed', message: prepared.error.message })
        return
      }

      // 2. Upload straight to the private bucket with that ticket.
      //    A plain fetch on purpose: pulling supabase-js into the browser
      //    would inline the environment schema — and therefore the NAMES of
      //    every server secret — into the client bundle, which the
      //    `check:bundle-secrets` gate rightly refuses.
      const uploaded = await fetch(prepared.data.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      })
      if (!uploaded.ok) {
        // The metadata row stays PENDING: it counts for nothing, and the
        // resident can retry or remove it.
        setPhase({ status: 'failed', message: 'The upload did not finish. Please try again.' })
        return
      }

      // 3. Ask the server to verify the object and finalize. Only this makes
      //    the document count toward submission.
      const finalized = await finalizeEvidenceAction({
        evidenceId: prepared.data.evidenceId,
        contentHash: await sha256Hex(file),
      })
      if (!finalized.ok) {
        setPhase({ status: 'failed', message: finalized.error.message })
        return
      }

      setPhase({ status: 'idle' })
      if (inputRef.current) inputRef.current.value = ''
      onUploaded()
    } catch {
      setPhase({ status: 'failed', message: 'The upload did not finish. Please try again.' })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-900">
        Add {evidenceKindLabel(kind).toLowerCase()}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={EVIDENCE_FILE_EXTENSIONS}
        disabled={busy}
        aria-describedby={`${inputId}-hint`}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
        className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 disabled:opacity-60"
      />
      <p id={`${inputId}-hint`} className="text-sm text-neutral-500">
        JPEG, PNG, WebP or PDF, up to 10 MB. Use a photo or scan of a real document you already have
        — nothing is shared outside your barangay office.
      </p>

      {/* Progress and failure are announced, not just coloured. */}
      {busy ? (
        <p role="status" className="text-sm text-neutral-700">
          Uploading…
        </p>
      ) : null}
      {phase.status === 'failed' ? (
        <div role="alert" className="flex flex-col gap-2">
          <p className="text-danger-700 text-sm">{phase.message}</p>
          <button
            type="button"
            onClick={() => {
              setPhase({ status: 'idle' })
              inputRef.current?.click()
            }}
            className="min-h-11 self-start rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100"
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  )
}

function EvidenceRow({
  item,
  editable,
  onRemoved,
}: {
  item: EvidenceItem
  editable: boolean
  onRemoved: () => void
}) {
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finalized = item.uploadedAt !== null

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="flex flex-col">
        <span className="font-medium text-neutral-900">{evidenceKindLabel(item.kind)}</span>
        <span className="text-sm text-neutral-500">
          {evidenceMimeLabel(item.mimeType)}
          {finalized && item.sizeBytes !== null
            ? ` · ${formatEvidenceSize(item.sizeBytes)}`
            : ''} ·{' '}
          {finalized ? (
            <span className="text-success-700">added</span>
          ) : (
            <span className="text-warning-700">not finished</span>
          )}
        </span>
        {error ? (
          <span role="alert" className="text-danger-700 text-sm">
            {error}
          </span>
        ) : null}
      </div>

      {editable ? (
        <button
          type="button"
          disabled={removing}
          onClick={() => {
            void (async () => {
              setRemoving(true)
              setError(null)
              const result = await removeEvidenceAction({ evidenceId: item.evidenceId })
              setRemoving(false)
              if (!result.ok) {
                setError(result.error.message)
                return
              }
              onRemoved()
            })()
          }}
          className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100 disabled:opacity-60"
        >
          {removing ? 'Removing…' : 'Remove'}
        </button>
      ) : null}
    </li>
  )
}

export function EvidenceManager({
  applicationId,
  items,
  editable,
  readiness,
}: {
  applicationId: string
  items: readonly EvidenceItem[]
  editable: boolean
  readiness: EvidenceReadiness
}) {
  const [submitState, submitAction, submitPending] = useActionState<
    Result<{ state: 'submitted' }> | null,
    FormData
  >(submitApplicationAction, null)

  useRefreshOnSuccess([submitState])

  // A completed upload or removal changes server state; refetch so the list
  // and readiness summary report what the database actually holds rather than
  // what the browser believes.
  const router = useRouter()
  const refresh = () => router.refresh()

  const submitError = submitState && !submitState.ok ? submitState.error.message : null

  return (
    <section
      aria-labelledby="evidence-heading"
      className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6"
    >
      <div>
        <h2 id="evidence-heading" className="text-lg font-bold">
          Your documents
        </h2>
        <p className="mt-1 text-neutral-700">
          Your barangay needs one document that shows who you are, and one that shows you live in
          the barangay.
        </p>
      </div>

      {items.length > 0 ? (
        <ul aria-label="Documents you added" className="flex flex-col divide-y divide-neutral-100">
          {items.map((item) => (
            <EvidenceRow
              key={item.evidenceId}
              item={item}
              editable={editable}
              onRemoved={refresh}
            />
          ))}
        </ul>
      ) : (
        <p className="text-neutral-700">You have not added any documents yet.</p>
      )}

      {editable ? (
        <div className="flex flex-col gap-4">
          <EvidencePicker applicationId={applicationId} kind="identity" onUploaded={refresh} />
          <EvidencePicker applicationId={applicationId} kind="residency" onUploaded={refresh} />
        </div>
      ) : null}

      {/* Readiness in words and symbols — never colour alone. */}
      <div className="border-t border-neutral-100 pt-4">
        <h3 className="text-sm font-medium text-neutral-900">Before you send this</h3>
        <ul className="mt-2 flex flex-col gap-1 text-neutral-700">
          <li>
            {readiness.hasIdentity ? '✓' : '•'} Identity evidence —{' '}
            {readiness.hasIdentity ? 'added' : 'still needed'}
          </li>
          <li>
            {readiness.hasResidency ? '✓' : '•'} Proof of residency —{' '}
            {readiness.hasResidency ? 'added' : 'still needed'}
          </li>
          {readiness.pendingCount > 0 ? (
            <li role="status">
              • {readiness.pendingCount} document
              {readiness.pendingCount === 1 ? '' : 's'} did not finish uploading and will not be
              sent. Remove or replace {readiness.pendingCount === 1 ? 'it' : 'them'}.
            </li>
          ) : null}
        </ul>
      </div>

      {editable ? (
        <form action={submitAction} className="flex flex-col gap-2">
          <input type="hidden" name="applicationId" value={applicationId} />
          {submitError ? (
            <p role="alert" className="text-danger-700 text-sm">
              {submitError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitPending || !readiness.canSubmit}
            className="bg-brand-700 hover:bg-brand-800 min-h-11 self-start rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {submitPending ? 'Sending…' : 'Send for verification'}
          </button>
          {!readiness.canSubmit ? (
            <p className="text-sm text-neutral-500">
              Add both documents above before you can send your registration.
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  )
}
