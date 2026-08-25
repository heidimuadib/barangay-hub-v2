import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Alert, PageHeader } from '@/components/ui'
import { getAuthorizationContext } from '@/features/identity'
import { OnboardingForm, getBarangayDirectory, getOwnRegistryState } from '@/features/registry'

export const metadata: Metadata = {
  title: 'Complete your registration',
  robots: { index: false, follow: false },
}

/**
 * Resident onboarding (Slice 2B). Reached after the account is confirmed;
 * creates the person record in the shared registry and opens a draft
 * verification application.
 */
export default async function OnboardingPage() {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  // Onboarding runs exactly once per account per barangay; a resident who
  // already has a record belongs on the status page.
  const existing = await getOwnRegistryState()
  if (existing) {
    redirect('/verification')
  }

  const barangays = await getBarangayDirectory()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Complete your registration"
        description="Tell us who you are and where you live. Your barangay reviews these details before you are registered as a resident — creating an account on its own does not register you."
      />

      {barangays.length === 0 ? (
        <Alert tone="warning" title="Registrations not currently available" live="none">
          No barangay is accepting registrations online yet. Please visit your barangay office.
        </Alert>
      ) : (
        <OnboardingForm barangays={barangays} />
      )}
    </div>
  )
}
