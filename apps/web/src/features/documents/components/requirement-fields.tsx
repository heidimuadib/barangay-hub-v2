'use client'

import { useId } from 'react'

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
    <fieldset className="rounded-lg border border-neutral-200 bg-white p-6">
      <legend className="px-1 text-lg font-bold">{legend}</legend>
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

export function FieldError({
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

export function FormError({ message }: { message: string | null }) {
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
