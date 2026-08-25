import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import { getAuthorizationContext } from '@/features/identity'
import {
  EvidenceManager,
  ResubmissionForm,
  VerificationStatusPanel,
  evidenceReadiness,
  getOwnRegistryState,
  isEditable,
  listOwnEvidence,
} from '@/features/registry'
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
  // Slice 2F: documents are managed while the application is editable
  // (draft or info_requested) — the same rule the database enforces.
  const evidence = registry.application_id ? await listOwnEvidence(registry.application_id) : []
  const editable = isEditable(state)

  return (
    <div className="space-y-6">
      <PageHeader
        title="My registration"
        description="View your verification status and manage supporting identity and residency documents."
      />

      <VerificationStatusPanel
        state={state}
        barangayName={registry.barangay_name}
        infoRequestNote={registry.info_request_note}
        decisionReason={registry.decision_reason}
      />

      {/* The one resident action in this state (Slice 2D): resubmit after
          providing what was asked. Ownership is enforced in the database. */}
      {state === 'info_requested' && registry.application_id ? (
        <ResubmissionForm applicationId={registry.application_id} />
      ) : null}

      {state === 'rejected' ? (
        <section aria-labelledby="next-steps-heading">
          <Card>
            <CardHeader id="next-steps-heading" as="h2" title="What you can do next" />
            <CardBody>
              <p className="text-neutral-700">
                This decision is final for this application. If your situation has changed or you
                believe something was missed, visit the barangay office — staff can start a new
                registration with you.
              </p>
            </CardBody>
          </Card>
        </section>
      ) : null}

      {/* Slice 2F: real upload, removal and submission. Replaces the 2B
          placeholder that told residents to bring documents to the office. */}
      {registry.application_id ? (
        <EvidenceManager
          applicationId={registry.application_id}
          items={evidence}
          editable={editable}
          readiness={evidenceReadiness(evidence)}
        />
      ) : null}

      <div className="pt-2">
        <Link
          href="/dashboard"
          className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2"
        >
          &larr; Back to my dashboard
        </Link>
      </div>
    </div>
  )
}
