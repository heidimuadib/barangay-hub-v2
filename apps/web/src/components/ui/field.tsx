import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

import { cn } from '@/utils/cn'

/**
 * Form controls and their labelling (UI-A).
 *
 * The e2e accessibility suite asserts, on every route it visits, that no
 * `input`, `select` or `textarea` lacks an accessible name. That has held so far
 * because each form wired `htmlFor`/`id` by hand. This makes the wiring
 * structural instead of habitual.
 *
 * `FormField` takes a function as its child rather than a plain element. The
 * alternative — accepting an element and rewriting its props with
 * `cloneElement` — silently does nothing when the child is a fragment or a
 * wrapper, and the failure mode is an unlabelled control that looks fine. Here
 * the control cannot be rendered at all without receiving the wiring:
 *
 *   <FormField id="purpose" label="Purpose" error={errors.purpose}>
 *     {(field) => <Textarea {...field} name="purpose" />}
 *   </FormField>
 *
 * No `useId`: an explicit id keeps these usable from Server Components, and the
 * ids double as the handles Playwright and Testing Library already select by.
 */

const CONTROL_BASE = [
  'w-full min-h-11 rounded-control border border-neutral-300 bg-white',
  'px-3 py-2 text-body-staff text-neutral-900',
  'placeholder:text-neutral-500',
  // The visible focus ring comes from the global `:focus-visible` rule, which is
  // never overridden. This only deepens the border so the field reads as active
  // even where the ring is clipped by an overflow container.
  'focus:border-brand-700',
  'aria-[invalid=true]:border-danger-700',
  'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500',
].join(' ')

export type FieldWiring = {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': true | undefined
  required: boolean | undefined
}

export type FormFieldProps = {
  id: string
  label: ReactNode
  children: (field: FieldWiring) => ReactNode
  /** Guidance shown before the control — format hints, why it is asked for. */
  description?: ReactNode
  /** A validation message. Its presence is what marks the field invalid. */
  error?: ReactNode
  required?: boolean
  className?: string
}

export function FormField({
  id,
  label,
  children,
  description,
  error,
  required,
  className,
}: FormFieldProps) {
  const descriptionId = description === undefined ? undefined : `${id}-description`
  const errorId = error === undefined ? undefined : `${id}-error`
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-body-staff font-medium text-neutral-900">
        {label}
        {/* Spelled out rather than a bare asterisk: an asterisk is a convention
            a reader has to already know, and screen readers skip it. */}
        {required === true ? (
          <span className="ml-1 font-normal text-neutral-500">(required)</span>
        ) : null}
      </label>

      {description === undefined ? null : (
        <p id={descriptionId} className="text-dense text-neutral-500">
          {description}
        </p>
      )}

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error === undefined ? undefined : true,
        required,
      })}

      {error === undefined ? null : (
        // `role="alert"` so a message that appears after a failed submit is
        // announced, rather than sitting silently below a field the user has
        // already tabbed past.
        <p id={errorId} role="alert" className="text-dense text-danger-700 font-medium">
          {error}
        </p>
      )}
    </div>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL_BASE, className)} {...rest} />
}

/**
 * A native `select`, deliberately. Its platform appearance is left alone: on a
 * phone the OS picker is better than anything reproduced in a div, and the
 * keyboard behaviour is already correct.
 */
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL_BASE, 'pr-2', className)} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({
  className,
  rows,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows ?? 4} className={cn(CONTROL_BASE, 'min-h-24', className)} {...rest} />
}

/**
 * A group of related controls under a shared legend — a resident's name parts, an
 * address. `/staff/registry/new` is asserted by the e2e suite to expose a group
 * named "resident's name", so this pattern is load-bearing rather than cosmetic.
 */
export function Fieldset({
  legend,
  children,
  description,
  className,
}: {
  legend: ReactNode
  children: ReactNode
  description?: ReactNode
  className?: string
}) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="text-body-staff font-semibold text-neutral-900">{legend}</legend>
      {description === undefined ? null : (
        <p className="text-dense mt-1 text-neutral-500">{description}</p>
      )}
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </fieldset>
  )
}
