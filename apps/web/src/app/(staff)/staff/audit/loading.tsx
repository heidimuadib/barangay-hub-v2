import { Card, SkeletonRows } from '@/components/ui'

export default function AuditLoading() {
  return (
    <Card padding="none">
      <SkeletonRows label="Loading audit events…" />
    </Card>
  )
}
