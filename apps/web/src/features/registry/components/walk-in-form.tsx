'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'
import type { Result } from '@/lib/errors'

import { createWalkInAction, type WalkInOutcome } from '../actions/walk-in'
import { RESIDENCY_BASES } from '../constants'
import type { ResidencyBasisKey } from '../types/registry'

const BASIS_ORDER: readonly ResidencyBasisKey[] = [
  'property_owner',
  'renter',
  'household_member',
  'caretaker',
  'informal_resident',
  'other',
]

/**
 * Walk-in resident creation (ADR-0006 points 5, 7, 16).
 *
 * A walk-in person needs no account. Duplicate candidates surface as a
 * WARNING that must be acknowledged before the record is created — they are
 * never merged, and nothing on this screen resolves a duplicate (that is
 * subpart 2E, behind `registry.resolve_duplicates`).
 */
export function WalkInForm({ barangayId }: { barangayId: string }) {
  const [state, formAction, isPending] = useActionState<Result<WalkInOutcome> | null, FormData>(
    createWalkInAction,
    null,
  )
  const [basis, setBasis] = useState<ResidencyBasisKey>('property_owner')

  /**
   * The typed values are held in state rather than left to the DOM.
   *
   * React resets an uncontrolled form once its action resolves, and the
   * duplicate-candidate response is a resolution like any other — so leaving
   * these uncontrolled wiped every field at exactly the moment the warning
   * appeared, leaving "Create anyway" to submit an empty form. Staff would
   * have had to retype the whole record to get past a warning that is only
   * ever advisory (ADR-0006 points 9–11).
   */
  const [values, setValues] = useState<Readonly<Record<string, string>>>({})
  const update = (field: string, value: string) =>
    setValues((previous) => ({ ...previous, [field]: value }))

  useRefreshOnSuccess([state])

  const fieldErrors = state && !state.ok ? (state.error.fieldErrors ?? {}) : {}
  const generalError =
    state && !state.ok && Object.keys(fieldErrors).length === 0 ? state.error.message : null
  const errorFor = (field: string) => fieldErrors[field]?.[0]

  const outcome = state?.ok === true ? state.data : null
  const duplicates = outcome?.status === 'duplicates' ? outcome.candidates : null
  const created = outcome?.status === 'created' ? outcome.personId : null

  if (created) {
    return (
      <div role="status" className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-bold">Resident recorded</h2>
        <p className="mt-2 text-neutral-700">
          The walk-in resident is now in the registry. They have no online account — link one later
          from the registry if they create one.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/staff/registry/${created}`}
            className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white"
          >
            Open the record
          </Link>
          <Link
            href="/staff/registry"
            className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium hover:bg-neutral-100"
          >
            Back to the registry
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="barangayId" value={barangayId} />

      {generalError === null ? null : (
        <p
          role="alert"
          className="border-danger-100 text-danger-700 rounded-md border bg-white px-3 py-2 text-sm"
        >
          {generalError}
        </p>
      )}

      {duplicates ? (
        <section
          role="alert"
          aria-labelledby="duplicate-heading"
          className="border-warning-100 rounded-lg border bg-white p-6"
        >
          <h2 id="duplicate-heading" className="text-lg font-bold">
            Possible existing records
          </h2>
          <p className="mt-2 text-neutral-700">
            These residents look similar. A matching name and birthdate is a hint, not proof of
            identity — check with the person in front of you before continuing.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {duplicates.map((candidate) => (
              <li
                key={candidate.personId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 px-4 py-3"
              >
                <span className="font-medium text-neutral-900">
                  {candidate.firstName} {candidate.lastName}
                </span>
                <span className="text-sm text-neutral-500">
                  {candidate.sameBirthdate ? 'same birthdate · ' : ''}
                  {candidate.hasAccount ? 'has an account' : 'no account'}
                </span>
              </li>
            ))}
          </ul>
          <label className="mt-4 flex items-start gap-2">
            <input
              type="checkbox"
              name="acknowledgeDuplicates"
              value="yes"
              required
              className="mt-1 h-5 w-5"
            />
            <span className="text-neutral-700">
              I checked these records and this is a different person. Create a new record.
            </span>
          </label>
          <p className="mt-2 text-sm text-neutral-500">
            Nothing is merged here. If this IS the same person, cancel and open their existing
            record instead.
          </p>
        </section>
      ) : null}

      <fieldset className="rounded-lg border border-neutral-200 bg-white p-6">
        <legend className="px-1 text-lg font-bold">Resident’s name</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Field
            id="firstName"
            label="First name"
            required
            error={errorFor('firstName')}
            value={values.firstName ?? ''}
            onChange={(next) => update('firstName', next)}
          />
          <Field
            id="middleName"
            label="Middle name (optional)"
            value={values.middleName ?? ''}
            onChange={(next) => update('middleName', next)}
          />
          <Field
            id="lastName"
            label="Last name"
            required
            error={errorFor('lastName')}
            value={values.lastName ?? ''}
            onChange={(next) => update('lastName', next)}
          />
          <Field
            id="suffix"
            label="Suffix (optional)"
            value={values.suffix ?? ''}
            onChange={(next) => update('suffix', next)}
          />
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-neutral-200 bg-white p-6">
        <legend className="px-1 text-lg font-bold">Contact and residence</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Field
            id="birthdate"
            label="Date of birth (optional)"
            type="date"
            error={errorFor('birthdate')}
            value={values.birthdate ?? ''}
            onChange={(next) => update('birthdate', next)}
          />
          <Field
            id="contactPhone"
            label="Mobile number (optional)"
            type="tel"
            value={values.contactPhone ?? ''}
            onChange={(next) => update('contactPhone', next)}
          />
        </div>
        <div className="mt-4">
          <Field
            id="addressLine"
            label="House number and street (optional)"
            value={values.addressLine ?? ''}
            onChange={(next) => update('addressLine', next)}
          />
        </div>

        <div className="mt-4 flex flex-col gap-1">
          <label htmlFor="residencyBasis" className="text-sm font-medium text-neutral-900">
            How do they live at this address?
          </label>
          <select
            id="residencyBasis"
            name="residencyBasis"
            required
            value={basis}
            onChange={(event) => setBasis(event.target.value as ResidencyBasisKey)}
            className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2"
          >
            {BASIS_ORDER.map((key) => (
              <option key={key} value={key}>
                {RESIDENCY_BASES[key].label}
              </option>
            ))}
          </select>
        </div>

        {RESIDENCY_BASES[basis].requiresExplanation ? (
          <div className="mt-4 flex flex-col gap-1">
            <label htmlFor="residencyExplanation" className="text-sm font-medium text-neutral-900">
              Explain the arrangement
            </label>
            <textarea
              id="residencyExplanation"
              name="residencyExplanation"
              required
              rows={3}
              maxLength={500}
              value={values.residencyExplanation ?? ''}
              onChange={(event) => update('residencyExplanation', event.target.value)}
              {...(errorFor('residencyExplanation') ? { 'aria-invalid': true } : {})}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2"
            />
            {errorFor('residencyExplanation') ? (
              <p role="alert" className="text-danger-700 text-sm">
                {errorFor('residencyExplanation')}
              </p>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <fieldset className="rounded-lg border border-neutral-200 bg-white p-6">
        <legend className="px-1 text-lg font-bold">Why are you recording this?</legend>
        <div className="mt-2 flex flex-col gap-1">
          <label htmlFor="reason" className="text-sm font-medium text-neutral-900">
            Reason
          </label>
          <textarea
            id="reason"
            name="reason"
            required
            rows={2}
            maxLength={500}
            aria-describedby="reason-hint"
            value={values.reason ?? ''}
            onChange={(event) => update('reason', event.target.value)}
            {...(errorFor('reason') ? { 'aria-invalid': true } : {})}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2"
          />
          <p id="reason-hint" className="text-sm text-neutral-500">
            Recorded in the audit trail with your name, for example “registered at the counter, no
            email address”.
          </p>
          {errorFor('reason') ? (
            <p role="alert" className="text-danger-700 text-sm">
              {errorFor('reason')}
            </p>
          ) : null}
        </div>
      </fieldset>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {isPending ? 'Saving…' : duplicates ? 'Create anyway' : 'Create resident record'}
        </button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  required = false,
  type = 'text',
  error,
  value,
  onChange,
}: {
  id: string
  label: string
  required?: boolean
  type?: string
  error?: string | undefined
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-neutral-900">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...(error ? { 'aria-invalid': true } : {})}
        className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2"
      />
      {error ? (
        <p role="alert" className="text-danger-700 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
