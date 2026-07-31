export interface AuditEventRow {
  readonly id: number
  readonly occurredAt: string
  readonly actorUserId: string | null
  readonly action: string
  readonly targetType: string
  readonly targetId: string | null
  readonly outcome: string
  readonly source: string
  readonly metadata: unknown
}
