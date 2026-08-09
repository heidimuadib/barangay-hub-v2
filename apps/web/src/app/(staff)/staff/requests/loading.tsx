import { Card, SkeletonRows } from '@/components/ui'

export default function StaffRequestsLoading() {
  return (
    <Card padding="none">
      <SkeletonRows label="Loading the document request queue…" />
    </Card>
  )
}
