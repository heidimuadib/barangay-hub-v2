'use client'

import { useActionState, useState } from 'react'

import { Alert, Button, Card, FormField, Input, Select, Textarea } from '@/components/ui'
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
    <form action={formAction} noValidate className="space-y-6">
      {generalError === null ? null : (
        <Alert tone="danger" live="alert">
          {generalError}
        </Alert>
      )}

      <Card>
        <fieldset className="space-y-4">
          <legend className="text-base font-bold text-neutral-900">Your barangay</legend>
          <FormField
            id="barangayId"
            label="Which barangay do you live in?"
            error={errorFor('barangayId')}
            required
          >
            {(field) => (
              <Select {...field} name="barangayId" defaultValue={barangays[0]?.id ?? ''}>
                {barangays.map((barangay) => (
                  <option key={barangay.id} value={barangay.id}>
                    {barangay.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </fieldset>
      </Card>

      <Card>
        <fieldset className="space-y-4">
          <legend className="text-base font-bold text-neutral-900">Your name</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="firstName" label="First name" error={errorFor('firstName')} required>
              {(field) => <Input {...field} name="firstName" autoComplete="given-name" />}
            </FormField>

            <FormField id="middleName" label="Middle name (optional)">
              {(field) => <Input {...field} name="middleName" autoComplete="additional-name" />}
            </FormField>

            <FormField id="lastName" label="Last name" error={errorFor('lastName')} required>
              {(field) => <Input {...field} name="lastName" autoComplete="family-name" />}
            </FormField>

            <FormField id="suffix" label="Suffix (optional)">
              {(field) => <Input {...field} name="suffix" autoComplete="honorific-suffix" />}
            </FormField>
          </div>
        </fieldset>
      </Card>

      <Card>
        <fieldset className="space-y-4">
          <legend className="text-base font-bold text-neutral-900">Contact and residence</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="birthdate"
              label="Date of birth (optional)"
              error={errorFor('birthdate')}
            >
              {(field) => <Input {...field} name="birthdate" type="date" />}
            </FormField>

            <FormField id="contactPhone" label="Mobile number (optional)">
              {(field) => (
                <Input
                  {...field}
                  name="contactPhone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="09XX XXX XXXX"
                />
              )}
            </FormField>
          </div>

          <FormField id="addressLine" label="House number and street (optional)">
            {(field) => (
              <Input
                {...field}
                name="addressLine"
                autoComplete="street-address"
                placeholder="House / Unit / Block / Street"
              />
            )}
          </FormField>

          <FormField id="residencyBasis" label="How do you live at this address?" required>
            {(field) => (
              <Select
                {...field}
                name="residencyBasis"
                value={basis}
                onChange={(event) => setBasis(event.target.value as ResidencyBasisKey)}
              >
                {BASIS_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {RESIDENCY_BASES[key].label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          {explanationRequired ? (
            <FormField
              id="residencyExplanation"
              label="Please explain your arrangement"
              error={errorFor('residencyExplanation')}
              required
            >
              {(field) => (
                <Textarea {...field} name="residencyExplanation" rows={3} maxLength={500} />
              )}
            </FormField>
          ) : null}
        </fieldset>
      </Card>

      <div className="pt-2">
        <Button type="submit" variant="primary" size="md" disabled={isPending} className="min-h-11">
          {isPending ? 'Saving…' : 'Save and continue'}
        </Button>
        <p className="text-dense mt-2 text-neutral-500">
          Saving your details does not verify you yet — a barangay reviewer checks them and may ask
          for more information.
        </p>
      </div>
    </form>
  )
}
