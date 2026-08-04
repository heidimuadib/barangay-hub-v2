'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useId, useState } from 'react'

import type { Result } from '@/lib/errors'

import { createWalkInRequestAction, type StaffRequestActionData } from '../actions/staff-requests'
import type { RequirementField } from '../types/documents'
import { FieldError, FormError, RequirementFieldset, type AnswerValues } from './requirement-fields'

/**
 * Filing a document request at the counter (Slice 3C).
 *
 * This is the SAME form the resident fills, plus one field: why staff are
 * filing it for someone else. That reason is the accountability record for an
 * action taken on a resident's behalf — the identical rule Slice 2C applies to
 * walk-in person creation (ADR-0006 point 7).
 *
 * The person is chosen from the registry BEFORE reaching this screen, so this
 * form never searches for people. A second person-picker would drift from the
 * registry's own search, which already handles duplicates and tenant scope.
 */

export function WalkInRequestForm({
  barangayId,
  personId,
  personName,
  documentTypeId,
  documentTypeName,
  requirements,
}: {
  barangayId: string
  personId: string
  personName: string
  documentTypeId: string
  documentTypeName: string
  requirements: readonly RequirementField[]
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<
    Result<StaffRequestActionData> | null,
    FormData
  >(createWalkInRequestAction, null)

  const [values, setValues] = useState<AnswerValues>({})
  const [purpose, setPurpose] = useState('')
  const [reason, setReason] = useState('')
  const purposeId = useId()
  const reasonId = useId()

  // The request is filed AND submitted, so it is already in the queue — the
  // detail page is where staff confirm what they just recorded.
  useEffect(() => {
    if (state?.ok === true) {
      router.push(`/staff/requests/${state.data.requestId}`)
    }
  }, [state, router])

  const fieldErrors = state && !state.ok ? (state.error.fieldErrors ?? {}) : {}
  const generalError =
    state && !state.ok && Object.keys(fieldErrors).length === 0 ? state.error.message : null

  const update = (key: string, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }))

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="barangayId" value={barangayId} />
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="documentTypeId" value={documentTypeId} />

      <FormError message={generalError} />

      <p className="rounded-lg border border-neutral-200 bg-white p-4 text-neutral-700">
        Filing <span className="font-medium">{documentTypeName}</span> for{' '}
        <span className="font-medium">{personName}</span>.
      </p>

      <fieldset className="rounded-lg border border-neutral-200 bg-white p-6">
        <legend className="px-1 text-lg font-bold">What the resident needs it for</legend>
        <div className="mt-2 flex flex-col gap-1">
          <label htmlFor={purposeId} className="text-sm font-medium text-neutral-900">
            Purpose
          </label>
          <textarea
            id={purposeId}
            name="purpose"
            required
            rows={3}
            maxLength={500}
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            {...(fieldErrors.purpose ? { 'aria-invalid': true } : {})}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2"
          />
          <FieldError messages={fieldErrors.purpose} />
        </div>
      </fieldset>

      <RequirementFieldset
        requirements={requirements}
        values={values}
        fieldErrors={fieldErrors}
        onChange={update}
      />

      <fieldset className="rounded-lg border border-neutral-200 bg-white p-6">
        <legend className="px-1 text-lg font-bold">Why are you filing this?</legend>
        <div className="mt-2 flex flex-col gap-1">
          <label htmlFor={reasonId} className="text-sm font-medium text-neutral-900">
            Reason
          </label>
          <textarea
            id={reasonId}
            name="reason"
            required
            rows={2}
            maxLength={500}
            aria-describedby={`${reasonId}-hint`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            {...(fieldErrors.reason ? { 'aria-invalid': true } : {})}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2"
          />
          <p id={`${reasonId}-hint`} className="text-sm text-neutral-500">
            Recorded against your name, for example “requested at the counter, no online account”.
          </p>
          <FieldError messages={fieldErrors.reason} />
        </div>
      </fieldset>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {isPending ? 'Filing…' : 'File and submit the request'}
        </button>
        <p className="mt-2 text-sm text-neutral-500">
          This files the request and sends it straight to the queue, so it is never left as a draft
          nobody can see.
        </p>
      </div>
    </form>
  )
}
