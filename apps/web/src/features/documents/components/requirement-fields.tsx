'use client'

import { useId } from 'react'

import { Alert, Card, FormField, Input, Select, Textarea } from '@/components/ui'

import { answerFieldName } from '../schemas/documents.schema'
import type { RequirementField } from '../types/documents'

/**
 * The data-driven answer controls, shared by the resident form and the counter
 * form (Slices 3B/3C).
 *
 * Shared deliberately rather than duplicated: the roadmap's rule is one domain
 * service for both channels, and a second copy of these controls is how the
 * two paths start diverging — a select rendered one way for residents and
 * another for staff is a bug nobody notices until a barangay adds a
 * requirement kind.
 *
 * Every control comes from the document type's own requirements, so adding a
 * question to a catalog entry needs no code. The kinds are deliberately few:
 * these are plain form controls, not a form builder.
 */

export type AnswerValues = Readonly<Record<string, string>>

export function RequirementFieldset({
  requirements,
  values,
  fieldErrors,
  onChange,
  legend = 'What the barangay asks for',
}: {
  requirements: readonly RequirementField[]
  values: AnswerValues
  fieldErrors: Readonly<Record<string, string[]>>
  onChange: (key: string, value: string) => void
  legend?: string
}) {
  if (requirements.length === 0) return null

  return (
    <Card>
      <fieldset className="space-y-4">
        <legend className="text-base font-bold text-neutral-900">{legend}</legend>
        <div className="space-y-4">
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
    </Card>
  )
}

export function RequirementControl({
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
  const error = messages?.[0]

  return (
    <FormField
      id={id}
      label={requirement.label}
      description={requirement.helpText}
      error={error}
      required={requirement.isRequired}
    >
      {(field) => {
        const name = answerFieldName(requirement.key)

        if (requirement.inputKind === 'textarea') {
          return (
            <Textarea
              {...field}
              name={name}
              rows={3}
              maxLength={1000}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          )
        }

        if (requirement.inputKind === 'select') {
          return (
            <Select
              {...field}
              name={name}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="">Choose one…</option>
              {requirement.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          )
        }

        if (requirement.inputKind === 'boolean') {
          return (
            <Select
              {...field}
              name={name}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="">Choose one…</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          )
        }

        return (
          <Input
            {...field}
            name={name}
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
        )
      }}
    </FormField>
  )
}

export function FieldError({
  messages,
  id,
}: {
  messages?: string[] | undefined
  id?: string | undefined
}) {
  if (!messages || messages.length === 0) return null
  return (
    <p {...(id ? { id } : {})} role="alert" className="text-dense text-danger-700 font-medium">
      {messages[0]}
    </p>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (message === null) return null
  return (
    <Alert tone="danger" live="alert">
      {message}
    </Alert>
  )
}
