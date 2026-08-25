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
    <div className="space-y-4">
      <ol className="relative space-y-4">
        {steps.map((step, idx) => {
          const copy = STEP_COPY[step.state]
          const isDone = step.status === 'done'
          const isCurrent = step.status === 'current'
          const isLast = idx === steps.length - 1

          return (
            <li key={step.state} className="relative flex items-start gap-3">
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={`absolute top-6 left-2.5 -ml-px h-[calc(100%-0.5rem)] w-0.5 ${
                    isDone ? 'bg-brand-600' : 'bg-neutral-200'
                  }`}
                />
              )}
              <div
                aria-hidden="true"
                className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs transition-colors ${
                  isDone
                    ? 'bg-brand-600 text-white'
                    : isCurrent
                      ? 'bg-brand-50 border-brand-600 text-brand-700 border-2'
                      : 'border border-neutral-300 bg-neutral-100 text-neutral-400'
                }`}
              >
                {isDone ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                ) : isCurrent ? (
                  <span className="bg-brand-600 h-2 w-2 rounded-full" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span
                    className={
                      step.status === 'upcoming'
                        ? 'text-sm font-medium text-neutral-500'
                        : 'text-sm font-semibold text-neutral-900'
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
                    <span className="text-dense text-neutral-500">{formatMoment(step.at)}</span>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {current ? (
        <div className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">
          <p>{STEP_COPY[current.state].waiting}</p>
        </div>
      ) : null}
    </div>
  )
}

function formatMoment(value: string): string {
  return new Date(value).toLocaleString('en-PH', { hour12: false })
}
