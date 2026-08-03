import type { RequirementField } from '../types/documents'

/**
 * What the barangay asks for on this document type.
 *
 * Shown before the resident starts, so they can gather what they need in one
 * trip rather than discovering a missing detail halfway through a form on a
 * phone. Optional questions are marked as optional rather than omitted — a
 * resident deciding whether to answer needs to know it is their choice.
 */
export function RequirementList({ requirements }: { requirements: readonly RequirementField[] }) {
  if (requirements.length === 0) {
    return (
      <p className="text-neutral-700">
        This document asks for nothing beyond what the barangay already has on file, and why you
        need it.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {requirements.map((requirement) => (
        <li
          key={requirement.requirementId}
          className="rounded-md border border-neutral-200 px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-neutral-900">{requirement.label}</span>
            <span className="text-sm text-neutral-500">
              {requirement.isRequired ? 'Required' : 'Optional'}
            </span>
          </div>
          {requirement.helpText ? (
            <p className="mt-1 text-sm text-neutral-700">{requirement.helpText}</p>
          ) : null}
          {requirement.options.length > 0 ? (
            <p className="mt-1 text-sm text-neutral-500">
              Choose one: {requirement.options.join(', ')}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
