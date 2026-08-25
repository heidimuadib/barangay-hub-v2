import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Alert, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
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
    <div className="space-y-6">
      <PageHeader
        title="My account"
        description="Manage your account profile and view identity settings."
      />

      <Card>
        <CardHeader
          as="h2"
          title="Profile information"
          description="Update how your name appears to barangay staff and on request records."
        />
        <CardBody>
          <ProfileForm initialDisplayName={context.displayName} />
        </CardBody>
      </Card>

      <Alert tone="info" title="Account settings" live="none">
        Email address, password, and credential changes are managed through your local barangay
        office.
      </Alert>
    </div>
  )
}
