'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useId, useState } from 'react'

import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'
import type { Result } from '@/lib/errors'

import { createRequestAction, saveAnswersAction, type RequestActionData } from '../actions/requests'
import { answerFieldName } from '../schemas/documents.schema'
import type { RequirementField } from '../types/documents'

/**
 * Resident request composition (Slice 3B).
 *
 * The form is DATA-DRIVEN: every control comes from the document type's own
 * requirements, so adding a question to a catalog entry needs no code. The
 * kinds are deliberately few (`text`, `textarea`, `number`, `date`, `boolean`,
 * `select`) — these are plain form controls, not a form builder.
 *
 * Values are held in React state rather than left to the DOM: React resets an
 * uncontrolled form when its action resolves, and a validation failure is a
 * resolution like any other. Leaving them uncontrolled wiped every answer at
 * exactly the moment the errors appeared — the same defect Slice 2C found in
 * the walk-in form.
 */

type AnswerValues = Readonly<Record<string, string>>

export function RequestForm({
  barangayId,
  documentTypeId,
  documentTypeName,
  requirements,
}: {
  barangayId: string
  documentTypeId: string
  documentTypeName: string
  requirements: readonly RequirementField[]
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<Result<RequestActionData> | null, FormData>(
    createRequestAction,
    null,
  )
  const [purpose, setPurpose] = useState('')
  const [values, setValues] = useState<AnswerValues>({})
  const purposeId = useId()

  // The draft now exists and has its own page — the request detail is where
  // the resident reviews it and decides to submit.
  useEffect(() => {
    if (state?.ok === true) {
      router.push(`/requests/${state.data.requestId}`)
    }
  }, [state, router])

  const fieldErrors = state && !state.ok ? (state.error.fieldErrors ?? {}) : {}
  const generalError =
    state && !state.ok && Object.keys(fieldErrors).length === 0 ? state.error.message : null

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="barangayId" value={barangayId} />
      <input type="hidden" name="documentTypeId" value={documentTypeId} />

      <FormError message={generalError} />

      <fieldset className="rounded-lg border border-neutral-200 bg-white p-6">
        <legend className="px-1 text-lg font-bold">Why do you need this document?</legend>
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
            aria-describedby={`${purposeId}-hint`}
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            {...(fieldErrors.purpose ? { 'aria-invalid': true } : {})}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2"
          />
          <p id={`${purposeId}-hint`} className="text-sm text-neutral-500">
            For example “for a job application”. The barangay reads this when they process your
            request for {documentTypeName}.
          </p>
          <FieldError messages={fieldErrors.purpose} />
        </div>
      </fieldset>

      <RequirementFields
        requirements={requirements}
        values={values}
        fieldErrors={fieldErrors}
        onChange={(key, value) => setValues((previous) => ({ ...previous, [key]: value }))}
      />

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save my request'}
        </button>
        <p className="mt-2 text-sm text-neutral-500">
          This saves a draft. Nothing reaches the barangay until you submit it on the next screen.
        </p>
      </div>
    </form>
  )
}

/**
 * Answer editing for a draft that already exists.
 *
 * Separate from creation because the request itself is fixed by then: the
 * purpose is what staff will read and `document_requests_guard` freezes it
 * once the request leaves draft, so offering to edit it here would promise
 * something the database refuses.
 */
export function AnswerForm({
  barangayId,
  requestId,
  requirements,
  initialAnswers,
}: {
  barangayId: string
  requestId: string
  requirements: readonly RequirementField[]
  initialAnswers: AnswerValues
}) {
  const [state, formAction, isPending] = useActionState<Result<RequestActionData> | null, FormData>(
    saveAnswersAction,
    null,
  )
  const [values, setValues] = useState<AnswerValues>(initialAnswers)

  useRefreshOnSuccess([state])

  const fieldErrors = state && !state.ok ? (state.error.fieldErrors ?? {}) : {}
  const generalError =
    state && !state.ok && Object.keys(fieldErrors).length === 0 ? state.error.message : null

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="barangayId" value={barangayId} />
      <input type="hidden" name="requestId" value={requestId} />

      <FormError message={generalError} />

      <RequirementFields
        requirements={requirements}
        values={values}
        fieldErrors={fieldErrors}
        onChange={(key, value) => setValues((previous) => ({ ...previous, [key]: value }))}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100 disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save answers'}
        </button>
        {state?.ok === true ? (
          <span role="status" className="text-success-700 text-sm font-medium">
            Answers saved.
          </span>
        ) : null}
      </div>
    </form>
  )
}

// ── Shared controls ─────────────────────────────────────────────────────────

function RequirementFields({
  requirements,
  values,
  fieldErrors,
  onChange,
}: {
  requirements: readonly RequirementField[]
  values: AnswerValues
  fieldErrors: Readonly<Record<string, string[]>>
  onChange: (key: string, value: string) => void
}) {
  if (requirements.length === 0) return null

  return (
    <fieldset className="rounded-lg border border-neutral-200 bg-white p-6">
      <legend className="px-1 text-lg font-bold">What the barangay asks for</legend>
      <div className="mt-2 flex flex-col gap-4">
        {requirements.map((requirement) => (
          <RequirementControl
            key={requirement.requirementId}
            requirement={requirement}
            value={values[requirement.key] ?? ''}
            messages={fieldErrors[answerFieldName(requirement.key)]}
            onChange={(next) => onChange(requirement.key, next)}
          />
        ))}
      </div>
    </fieldset>
  )
}

function RequirementControl({
  requirement,
  value,
  messages,
  onChange,
}: {
  requirement: RequirementField
  value: string
  messages: string[] | undefined
  onChange: (next: string) => void
}) {
  const id = useId()
  const hintId = requirement.helpText ? `${id}-hint` : undefined
  const errorId = messages ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ')

  const shared = {
    id,
    name: answerFieldName(requirement.key),
    required: requirement.isRequired,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(messages ? { 'aria-invalid': true as const } : {}),
    className: 'min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2',
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-neutral-900">
        {requirement.label}
        <span className="ml-2 font-normal text-neutral-500">
          {requirement.isRequired ? 'Required' : 'Optional'}
        </span>
      </label>

      {requirement.inputKind === 'textarea' ? (
        <textarea
          {...shared}
          rows={3}
          maxLength={1000}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2"
        />
      ) : requirement.inputKind === 'select' ? (
        <select {...shared} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose one…</option>
          {requirement.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : requirement.inputKind === 'boolean' ? (
        // A select rather than a checkbox: an unchecked box posts nothing,
        // which is indistinguishable from "not answered" — and "no" is a real
        // answer that a required question must be able to receive.
        <select {...shared} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose one…</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : (
        <input
          {...shared}
          type={
            requirement.inputKind === 'number'
              ? 'number'
              : requirement.inputKind === 'date'
                ? 'date'
                : 'text'
          }
          {...(requirement.inputKind === 'number'
            ? { step: 'any', inputMode: 'decimal' as const }
            : {})}
          maxLength={1000}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {requirement.helpText ? (
        <p id={hintId} className="text-sm text-neutral-500">
          {requirement.helpText}
        </p>
      ) : null}
      <FieldError messages={messages} id={errorId} />
    </div>
  )
}

function FieldError({
  messages,
  id,
}: {
  messages?: string[] | undefined
  id?: string | undefined
}) {
  if (!messages || messages.length === 0) return null
  return (
    <p {...(id ? { id } : {})} role="alert" className="text-danger-700 text-sm">
      {messages[0]}
    </p>
  )
}

function FormError({ message }: { message: string | null }) {
  if (message === null) return null
  return (
    <p
      role="alert"
      className="border-danger-100 text-danger-700 rounded-md border bg-white px-3 py-2 text-sm"
    >
      {message}
    </p>
  )
}
