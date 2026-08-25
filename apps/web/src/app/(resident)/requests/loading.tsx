import { Card, SkeletonRows } from '@/components/ui'

export default function RequestsLoading() {
  return (
    <Card padding="none">
      <SkeletonRows label="Loading your document requests…" rows={3} />
    </Card>
  )
}
