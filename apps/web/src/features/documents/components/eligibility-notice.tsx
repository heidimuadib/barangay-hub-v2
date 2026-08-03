import Link from 'next/link'

import type { RequestEligibility } from '@/features/documents'

/**
 * Why this resident cannot request a document yet, and what to do about it.
 *
 * The refusal is stated as a step in their registration rather than as an
 * authorization failure, because that is what it is: the request surface is
 * open to every member, and only CREATING one needs standing. Each branch
 * names the next action, so nobody is left at a disabled button wondering
 * whether the barangay is broken.
 *
 * The same condition is enforced by `create_own_request` (RESIDENT_NOT_VERIFIED)
 * and by the action; this panel only explains it.
 */

const COPY: Record<
  Exclude<RequestEligibility, 'eligible'>,
  { heading: string; body: string; cta: string }
> = {
  not_registered: {
    heading: 'Register as a resident first',
    body: 'Your barangay confirms who you are before you can request documents. Registering takes a few minutes.',
    cta: 'Start my registration',
  },
  registration_incomplete: {
    heading: 'Finish your registration',
    body: 'You have started registering but have not sent it to the barangay yet. Add your documents and submit it.',
    cta: 'Go to my registration',
  },
  awaiting_decision: {
    heading: 'Your registration is still being checked',
    body: 'The barangay has your registration. Once they confirm it, you can request documents here. Nothing is needed from you right now.',
    cta: 'View my registration',
  },
  information_needed: {
    heading: 'The barangay needs more information',
    body: 'Your registration is waiting on something from you. Send it, and you will be able to request documents once it is approved.',
    cta: 'See what they asked for',
  },
  not_approved: {
    heading: 'Your registration was not approved',
    body: 'You cannot request documents until your registration is approved. Contact the barangay office if you think this is a mistake.',
    cta: 'View my registration',
  },
}

export function EligibilityNotice({
  eligibility,
  nextRoute,
}: {
  eligibility: Exclude<RequestEligibility, 'eligible'>
  nextRoute: string | null
}) {
  const copy = COPY[eligibility]

  return (
    <section
      role="note"
      aria-labelledby="eligibility-heading"
      className="border-warning-100 rounded-lg border bg-white p-6"
    >
      <h2 id="eligibility-heading" className="text-lg font-bold">
        {copy.heading}
      </h2>
      <p className="mt-2 text-neutral-700">{copy.body}</p>
      {nextRoute ? (
        <Link
          href={nextRoute}
          className="bg-brand-700 hover:bg-brand-800 mt-4 inline-flex min-h-11 items-center rounded-md px-4 py-2 font-medium text-white"
        >
          {copy.cta}
        </Link>
      ) : null}
    </section>
  )
}
