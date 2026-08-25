import { Card, SkeletonRows } from '@/components/ui'

export default function DocumentCatalogLoading() {
  return (
    <Card padding="none">
      <SkeletonRows label="Loading the documents your barangay offers…" rows={3} />
    </Card>
  )
}
