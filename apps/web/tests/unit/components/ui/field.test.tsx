import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Fieldset, FormField, Input, Select, Textarea } from '@/components/ui'

/**
 * UI-A — the form-control labelling contract.
 *
 * The e2e accessibility suite asserts on every route that no control is
 * unlabelled. That is an end-to-end check on a property produced here, so these
 * are the deterministic version: they fail in milliseconds and name the cause,
 * rather than failing in a browser as "1 control is unlabelled" on whichever
 * route happened to render it.
 */

describe('FormField — labelling', () => {
  it('associates the label with the control it wraps', () => {
    render(
      <FormField id="purpose" label="Purpose">
        {(field) => <Input {...field} name="purpose" />}
      </FormField>,
    )

    // Found BY ITS LABEL — the same query the e2e suite and the existing form
    // tests use, so passing here means passing there.
    expect(screen.getByLabelText('Purpose')).toBeInstanceOf(HTMLInputElement)
  })

  it('works the same for a select and a textarea', () => {
    render(
      <>
        <FormField id="basis" label="Residency basis">
          {(field) => (
            <Select {...field} name="basis">
              <option value="owner">Property owner</option>
            </Select>
          )}
        </FormField>
        <FormField id="notes" label="Notes">
          {(field) => <Textarea {...field} name="notes" />}
        </FormField>
      </>,
    )

    expect(screen.getByLabelText('Residency basis')).toBeInstanceOf(HTMLSelectElement)
    expect(screen.getByLabelText('Notes')).toBeInstanceOf(HTMLTextAreaElement)
  })

  it('spells out "required" instead of relying on an asterisk', () => {
    render(
      <FormField id="purpose" label="Purpose" required>
        {(field) => <Input {...field} />}
      </FormField>,
    )

    expect(screen.getByText('(required)')).toBeInTheDocument()
    expect(screen.getByLabelText(/purpose/i)).toBeRequired()
  })
})

describe('FormField — description and error wiring', () => {
  it('links a description to the control', () => {
    render(
      <FormField id="years" label="Years of residency" description="Whole years, as a number.">
        {(field) => <Input {...field} />}
      </FormField>,
    )

    const control = screen.getByLabelText(/years of residency/i)
    expect(control).toHaveAccessibleDescription('Whole years, as a number.')
  })

  it('marks the control invalid and announces the message', () => {
    render(
      <FormField id="purpose" label="Purpose" error="Tell us what the document is for.">
        {(field) => <Input {...field} />}
      </FormField>,
    )

    const control = screen.getByLabelText('Purpose')
    expect(control).toHaveAttribute('aria-invalid', 'true')
    expect(control).toHaveAccessibleDescription('Tell us what the document is for.')
    // `role="alert"` so a message that appears after submit is spoken, rather
    // than sitting silently under a field the user has already left.
    expect(screen.getByRole('alert')).toHaveTextContent('Tell us what the document is for.')
  })

  it('keeps BOTH the description and the error reachable', () => {
    // The regression this guards: wiring `aria-describedby` to the error alone,
    // which silently drops the format hint exactly when the user needs it.
    render(
      <FormField
        id="years"
        label="Years of residency"
        description="Whole years, as a number."
        error="Enter a number."
      >
        {(field) => <Input {...field} />}
      </FormField>,
    )

    const control = screen.getByLabelText(/years of residency/i)
    expect(control).toHaveAccessibleDescription('Whole years, as a number. Enter a number.')
  })

  it('leaves a valid control unmarked', () => {
    render(
      <FormField id="purpose" label="Purpose">
        {(field) => <Input {...field} />}
      </FormField>,
    )

    const control = screen.getByLabelText('Purpose')
    expect(control).not.toHaveAttribute('aria-invalid')
    expect(control).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Fieldset', () => {
  it('exposes a group named by its legend', () => {
    // `/staff/registry/new` is asserted end-to-end to expose a group named
    // "resident's name", so this shape is load-bearing rather than decorative.
    render(
      <Fieldset legend="Resident’s name">
        <FormField id="first" label="First name">
          {(field) => <Input {...field} />}
        </FormField>
      </Fieldset>,
    )

    const group = screen.getByRole('group', { name: /resident’s name/i })
    expect(group).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toBeInTheDocument()
  })
})

describe('Input — the 44px floor', () => {
  it('carries the minimum touch height', () => {
    render(
      <FormField id="purpose" label="Purpose">
        {(field) => <Input {...field} />}
      </FormField>,
    )
    // jsdom computes no layout, so the class is the assertable proxy. The pixel
    // measurement itself is the e2e suite's job.
    expect(screen.getByLabelText('Purpose').className).toContain('min-h-11')
  })
})
