import { Card, LoadingState } from '@/components/ui'

export default function PlatformLoading() {
  return (
    <Card padding="none">
      <LoadingState label="Loading the platform console…" />
    </Card>
  )
}
