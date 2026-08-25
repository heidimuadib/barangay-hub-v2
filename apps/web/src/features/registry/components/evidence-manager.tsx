'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useId, useRef, useState } from 'react'

import { Alert, Badge, Button, Card, CardBody, CardHeader } from '@/components/ui'
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
      const uploaded = await fetch(prepared.data.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      })
      if (!uploaded.ok) {
        setPhase({ status: 'failed', message: 'The upload did not finish. Please try again.' })
        return
      }

      // 3. Ask the server to verify the object and finalize.
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
    <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-4 transition-colors hover:border-neutral-400">
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold text-neutral-900">
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
          className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-neutral-700 hover:file:bg-neutral-200 disabled:opacity-60"
        />
        <p id={`${inputId}-hint`} className="text-dense text-neutral-500">
          JPEG, PNG, WebP or PDF, up to 10 MB. Use a photo or scan of a real document you already
          have — nothing is shared outside your barangay office.
        </p>

        {/* Progress and failure are announced, not just coloured. */}
        {busy ? (
          <p role="status" className="text-dense text-brand-700 font-medium">
            Uploading…
          </p>
        ) : null}
        {phase.status === 'failed' ? (
          <div className="mt-2 space-y-2">
            <Alert tone="danger" live="alert">
              {phase.message}
            </Alert>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setPhase({ status: 'idle' })
                inputRef.current?.click()
              }}
            >
              Try again
            </Button>
          </div>
        ) : null}
      </div>
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
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-neutral-900">{evidenceKindLabel(item.kind)}</span>
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <span>{evidenceMimeLabel(item.mimeType)}</span>
          {finalized && item.sizeBytes !== null ? (
            <span>&bull; {formatEvidenceSize(item.sizeBytes)}</span>
          ) : null}
          <span>&bull;</span>
          {finalized ? (
            <Badge tone="success">added</Badge>
          ) : (
            <Badge tone="warning">not finished</Badge>
          )}
        </div>
        {error ? (
          <span role="alert" className="text-dense text-danger-700 font-medium">
            {error}
          </span>
        ) : null}
      </div>

      {editable ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
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
        >
          {removing ? 'Removing…' : 'Remove'}
        </Button>
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

  const router = useRouter()
  const refresh = () => router.refresh()

  const submitError = submitState && !submitState.ok ? submitState.error.message : null

  return (
    <Card>
      <CardHeader
        id="evidence-heading"
        as="h2"
        title="Your documents"
        description="Your barangay needs one document that shows who you are, and one that shows you live in the barangay."
      />
      <CardBody className="space-y-6">
        {items.length > 0 ? (
          <ul
            aria-label="Documents you added"
            className="divide-y divide-neutral-200 rounded-md border border-neutral-200 px-4"
          >
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
          <p className="text-neutral-600">You have not added any documents yet.</p>
        )}

        {editable ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <EvidencePicker applicationId={applicationId} kind="identity" onUploaded={refresh} />
            <EvidencePicker applicationId={applicationId} kind="residency" onUploaded={refresh} />
          </div>
        ) : null}

        {/* Readiness in words and symbols — never colour alone. */}
        <div className="border-t border-neutral-200 pt-4">
          <h3 className="text-sm font-semibold text-neutral-900">Before you send this</h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            <li className="flex items-center gap-2">
              <span
                className={
                  readiness.hasIdentity ? 'text-success-700 font-bold' : 'text-neutral-400'
                }
              >
                {readiness.hasIdentity ? '✓' : '•'}
              </span>
              <span>
                Identity evidence —{' '}
                <strong className="font-medium">
                  {readiness.hasIdentity ? 'added' : 'still needed'}
                </strong>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span
                className={
                  readiness.hasResidency ? 'text-success-700 font-bold' : 'text-neutral-400'
                }
              >
                {readiness.hasResidency ? '✓' : '•'}
              </span>
              <span>
                Proof of residency —{' '}
                <strong className="font-medium">
                  {readiness.hasResidency ? 'added' : 'still needed'}
                </strong>
              </span>
            </li>
            {readiness.pendingCount > 0 ? (
              <li role="status" className="text-warning-700">
                • {readiness.pendingCount} document
                {readiness.pendingCount === 1 ? '' : 's'} did not finish uploading and will not be
                sent. Remove or replace {readiness.pendingCount === 1 ? 'it' : 'them'}.
              </li>
            ) : null}
          </ul>
        </div>

        {editable ? (
          <form action={submitAction} className="space-y-3 border-t border-neutral-200 pt-4">
            <input type="hidden" name="applicationId" value={applicationId} />
            {submitError ? (
              <Alert tone="danger" live="alert">
                {submitError}
              </Alert>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={submitPending || !readiness.canSubmit}
              >
                {submitPending ? 'Sending…' : 'Send for verification'}
              </Button>
              {!readiness.canSubmit ? (
                <p className="text-dense text-neutral-500">
                  Add both documents above before you can send your registration.
                </p>
              ) : null}
            </div>
          </form>
        ) : null}
      </CardBody>
    </Card>
  )
}
