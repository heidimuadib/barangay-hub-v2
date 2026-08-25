'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useId, useState } from 'react'

import { Button, Card, FormField, Textarea } from '@/components/ui'
import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'
import type { Result } from '@/lib/errors'

import { createRequestAction, saveAnswersAction, type RequestActionData } from '../actions/requests'
import type { RequirementField } from '../types/documents'
import { FormError, RequirementFieldset, type AnswerValues } from './requirement-fields'

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
    <form action={formAction} noValidate className="space-y-6">
      <input type="hidden" name="barangayId" value={barangayId} />
      <input type="hidden" name="documentTypeId" value={documentTypeId} />

      <FormError message={generalError} />

      <Card>
        <fieldset className="space-y-4">
          <legend className="text-base font-bold text-neutral-900">
            Why do you need this document?
          </legend>
          <FormField
            id={purposeId}
            label="Purpose"
            description={`For example “for a job application”. The barangay reads this when they process your request for ${documentTypeName}.`}
            error={fieldErrors.purpose?.[0]}
            required
          >
            {(field) => (
              <Textarea
                {...field}
                name="purpose"
                rows={3}
                maxLength={500}
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              />
            )}
          </FormField>
        </fieldset>
      </Card>

      <RequirementFieldset
        requirements={requirements}
        values={values}
        fieldErrors={fieldErrors}
        onChange={(key, value) => setValues((previous) => ({ ...previous, [key]: value }))}
      />

      <div className="pt-2">
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save my request'}
        </Button>
        <p className="text-dense mt-2 text-neutral-500">
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
    <form action={formAction} noValidate className="space-y-6">
      <input type="hidden" name="barangayId" value={barangayId} />
      <input type="hidden" name="requestId" value={requestId} />

      <FormError message={generalError} />

      <RequirementFieldset
        requirements={requirements}
        values={values}
        fieldErrors={fieldErrors}
        onChange={(key, value) => setValues((previous) => ({ ...previous, [key]: value }))}
      />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" variant="secondary" size="md" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save answers'}
        </Button>
        {state?.ok === true ? (
          <span role="status" className="text-dense text-success-700 font-medium">
            Answers saved.
          </span>
        ) : null}
      </div>
    </form>
  )
}
