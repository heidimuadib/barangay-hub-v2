import type { TimelineStep } from '@/features/documents'

import type { DocumentRequestState } from '../types/documents'

/**
 * The status timeline on the resident's request detail (Slice 3B).
 *
 * Computed on the SERVER from the same ordered progression the transition map
 * is built on, so this cannot draw a step the database would refuse.
 *
 * It stops at "ready to collect". Issuing the document — serials, the printed
 * certificate, the QR — is Slice 4, and drawing a greyed-out "collected" step
 * would promise a stage that does not exist yet to someone deciding whether to
 * travel to the barangay hall.
 */

const STEP_COPY: Record<DocumentRequestState, { label: string; waiting: string }> = {
  draft: {
    label: 'Saved as a draft',
    waiting: 'Only you can see this. Submit it when you are ready.',
  },
  submitted: {
    label: 'Sent to the barangay',
    waiting: 'Your request is with the barangay. Nothing is needed from you.',
  },
  in_review: {
    label: 'Being processed',
    waiting: 'Someone at the barangay is working on your request.',
  },
  ready_for_issue: {
    label: 'Ready to collect',
    waiting: 'The barangay will tell you when you can collect it.',
  },
}

export function RequestProgress({ steps }: { steps: readonly TimelineStep[] }) {
  const current = steps.find((step) => step.status === 'current')

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {steps.map((step) => {
          const copy = STEP_COPY[step.state]
          return (
            <li key={step.state} className="flex flex-wrap items-baseline gap-2">
              <span
                aria-hidden="true"
                className={
                  step.status === 'upcoming'
                    ? 'inline-block h-2 w-2 rounded-full bg-neutral-300'
                    : 'bg-brand-700 inline-block h-2 w-2 rounded-full'
                }
              />
              <span
                className={
                  step.status === 'upcoming' ? 'text-neutral-500' : 'font-medium text-neutral-900'
                }
              >
                {copy.label}
              </span>
              {/* The screen-reader reading of the marker above, which is
                  otherwise the only thing distinguishing the states. */}
              <span className="sr-only">
                {step.status === 'done'
                  ? 'completed'
                  : step.status === 'current'
                    ? 'current step'
                    : 'not started'}
              </span>
              {step.at ? (
                <span className="text-sm text-neutral-500">{formatMoment(step.at)}</span>
              ) : null}
            </li>
          )
        })}
      </ol>

      {current ? <p className="text-neutral-700">{STEP_COPY[current.state].waiting}</p> : null}
    </div>
  )
}

function formatMoment(value: string): string {
  return new Date(value).toLocaleString('en-PH', { hour12: false })
}
