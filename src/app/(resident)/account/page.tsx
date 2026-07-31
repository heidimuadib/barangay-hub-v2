import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

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
      <h1 className="text-xl font-bold">My account</h1>
      <ProfileForm initialDisplayName={context.displayName} />
      <p className="text-sm text-neutral-500">
        Email address and password changes are handled by your barangay office in this release.
      </p>
    </div>
  )
}
