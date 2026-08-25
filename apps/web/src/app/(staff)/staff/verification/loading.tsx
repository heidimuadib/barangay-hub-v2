import { Card, SkeletonRows } from '@/components/ui'

export default function VerificationQueueLoading() {
  return (
    <Card padding="none">
      <SkeletonRows label="Loading the verification queue…" />
    </Card>
  )
}
