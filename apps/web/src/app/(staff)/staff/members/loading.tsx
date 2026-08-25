import { Card, SkeletonRows } from '@/components/ui'

export default function MembersLoading() {
  return (
    <Card padding="none">
      <SkeletonRows label="Loading members…" rows={4} />
    </Card>
  )
}
