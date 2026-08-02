import 'server-only'

import { PERMISSIONS, requirePermission, requirePlatformPermission } from '@/features/identity'

import {
  fetchPlatformAuditEvents,
  fetchTenantAuditEvents,
  type AuditQueryRow,
} from '../repositories/audit-repository'
import type { AuditEventRow } from '../types/audit'

const DEFAULT_LIMIT = 50

function toRow(row: AuditQueryRow): AuditEventRow {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    actorUserId: row.actor_user_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    outcome: row.outcome,
    source: row.source,
    metadata: row.metadata,
  }
}

export async function listTenantAuditEvents(barangayId: string): Promise<readonly AuditEventRow[]> {
  await requirePermission(barangayId, PERMISSIONS.auditRead)
  const rows = await fetchTenantAuditEvents(barangayId, DEFAULT_LIMIT)
  return rows.map(toRow)
}

export async function listPlatformAuditEvents(): Promise<readonly AuditEventRow[]> {
  await requirePlatformPermission(PERMISSIONS.platformAuditRead)
  const rows = await fetchPlatformAuditEvents(DEFAULT_LIMIT)
  return rows.map(toRow)
}
