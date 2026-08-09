import { Card, SkeletonRows } from '@/components/ui'

export default function RegistryLoading() {
  return (
    <Card padding="none">
      <SkeletonRows label="Loading the resident registry…" />
    </Card>
  )
}
