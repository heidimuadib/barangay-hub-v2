import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAuthorizationContext } from '@/features/identity'
import { VerificationStatusPanel, getOwnRegistryState } from '@/features/registry'
import type { VerificationState } from '@/features/registry'

export const metadata: Metadata = {
  title: 'My registration',
  robots: { index: false, follow: false },
}

export default async function VerificationPage() {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  const registry = await getOwnRegistryState()
  if (!registry) {
    redirect('/onboarding')
  }

  const state = (registry.state ?? 'draft') as VerificationState

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">My registration</h1>

      <VerificationStatusPanel
        state={state}
        barangayName={registry.barangay_name}
        infoRequestNote={registry.info_request_note}
        decisionReason={registry.decision_reason}
      />

      <section
        aria-labelledby="documents-heading"
        className="rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 id="documents-heading" className="text-lg font-bold">
          Your documents
        </h2>
        <p className="mt-2 text-neutral-700">
          {registry.evidence_count === 0
            ? 'You have not added any documents yet.'
            : `${registry.evidence_count} document${registry.evidence_count === 1 ? '' : 's'} attached to your registration.`}
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          Uploading proof of identity and residency is being finished and will appear here. Until
          then, bring your documents to the barangay office and staff can complete your registration
          with you.
        </p>
      </section>

      <p className="text-sm text-neutral-500">
        <Link href="/dashboard" className="text-brand-700 underline">
          Back to my dashboard
        </Link>
      </p>
    </div>
  )
}
