'use client'

import { useActionState, useState } from 'react'

import { useRefreshOnSuccess } from '@/hooks/use-refresh-on-success'
import type { Result } from '@/lib/errors'

import { completeOnboardingAction } from '../actions/onboarding'
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

export function OnboardingForm({
  barangays,
}: {
  barangays: readonly { id: string; name: string }[]
}) {
  const [state, formAction, isPending] = useActionState<
    Result<{ personId: string }> | null,
    FormData
  >(completeOnboardingAction, null)
  const [basis, setBasis] = useState<ResidencyBasisKey>('renter')

  useRefreshOnSuccess([state])

  const fieldErrors = state && !state.ok ? (state.error.fieldErrors ?? {}) : {}
  const generalError =
    state && !state.ok && Object.keys(fieldErrors).length === 0 ? state.error.message : null
  const explanationRequired = RESIDENCY_BASES[basis].requiresExplanation

  const errorFor = (field: string) => fieldErrors[field]?.[0]

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      {generalError === null ? null : (
        <p
          role="alert"
          className="border-danger-100 text-danger-700 rounded-md border bg-white px-3 py-2 text-sm"
        >
          {generalError}
        </p>
      )}

      <fieldset className="rounded-lg border border-neutral-200 bg-white p-6">
        <legend className="px-1 text-lg font-bold">Your barangay</legend>
        <div className="mt-2 flex flex-col gap-1">
          <label htmlFor="barangayId" className="text-sm font-medium text-neutral-900">
            Which barangay do you live in?
          </label>
          <select
            id="barangayId"
            name="barangayId"
            required
            defaultValue={barangays[0]?.id ?? ''}
            className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2"
          >
            {barangays.map((barangay) => (
              <option key={barangay.id} value={barangay.id}>
                {barangay.name}
              </option>
            ))}
          </select>
          {errorFor('barangayId') ? (
            <p role="alert" className="text-danger-700 text-sm">
              {errorFor('barangayId')}
            </p>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-neutral-200 bg-white p-6">
        <legend className="px-1 text-lg font-bold">Your name</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Field
            id="firstName"
            label="First name"
            required
            autoComplete="given-name"
            error={errorFor('firstName')}
          />
          <Field id="middleName" label="Middle name (optional)" autoComplete="additional-name" />
          <Field
            id="lastName"
            label="Last name"
            required
            autoComplete="family-name"
            error={errorFor('lastName')}
          />
          <Field id="suffix" label="Suffix (optional)" autoComplete="honorific-suffix" />
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
          />
          <Field id="contactPhone" label="Mobile number (optional)" type="tel" autoComplete="tel" />
        </div>
        <div className="mt-4">
          <Field
            id="addressLine"
            label="House number and street (optional)"
            autoComplete="street-address"
          />
        </div>

        <div className="mt-4 flex flex-col gap-1">
          <label htmlFor="residencyBasis" className="text-sm font-medium text-neutral-900">
            How do you live at this address?
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

        {explanationRequired ? (
          <div className="mt-4 flex flex-col gap-1">
            <label htmlFor="residencyExplanation" className="text-sm font-medium text-neutral-900">
              Please explain your arrangement
            </label>
            <textarea
              id="residencyExplanation"
              name="residencyExplanation"
              required
              rows={3}
              maxLength={500}
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

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-700 hover:bg-brand-800 min-h-11 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save and continue'}
        </button>
        <p className="mt-3 text-sm text-neutral-500">
          Saving your details does not verify you yet — a barangay reviewer checks them and may ask
          for more information.
        </p>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  required = false,
  type = 'text',
  autoComplete,
  error,
}: {
  id: string
  label: string
  required?: boolean
  type?: string
  autoComplete?: string
  error?: string | undefined
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
        {...(autoComplete === undefined ? {} : { autoComplete })}
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
