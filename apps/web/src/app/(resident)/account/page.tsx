import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Card, PageHeader } from '@/components/ui'
import { ProfileForm, getAuthorizationContext } from '@/features/identity'

export const metadata: Metadata = {
  title: 'My account',
  robots: { index: false, follow: false },
}

export default async function AccountPage() {
  const context = await getAuthorizationContext()
  if (!context) {
    redirect('/sign-in')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My account" />
      <Card>
        <ProfileForm initialDisplayName={context.displayName} />
      </Card>
      <p className="text-dense text-neutral-500">
        Email address and password changes are handled by your barangay office in this release.
      </p>
    </div>
  )
}
