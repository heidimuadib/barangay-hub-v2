import type { AuditEventRow } from '../types/audit'

/**
 * Read-only audit listing. Metadata is rendered as compact JSON — by
 * construction it contains status values, role keys, field names and hashes,
 * never personal values.
 */
export function AuditTable({ events }: { events: readonly AuditEventRow[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-700">
        No audit events recorded yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="text-dense w-full text-left">
        <caption className="sr-only-focusable">Audit events, most recent first</caption>
        <thead>
          <tr className="border-b border-neutral-200 text-sm text-neutral-500">
            <th scope="col" className="px-4 py-3 font-medium">
              When
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Action
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Target
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Outcome
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b border-neutral-100 align-top">
              <td className="tabular px-4 py-3 whitespace-nowrap text-neutral-700">
                <time dateTime={event.occurredAt}>
                  {new Date(event.occurredAt).toLocaleString('en-PH', { hour12: false })}
                </time>
              </td>
              <td className="px-4 py-3 font-medium text-neutral-900">{event.action}</td>
              <td className="px-4 py-3 text-neutral-700">
                {event.targetType}
                {event.targetId ? (
                  <span className="tabular block text-sm text-neutral-500">{event.targetId}</span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    event.outcome === 'success'
                      ? 'bg-success-100 text-success-700 inline-block rounded-full px-2 py-0.5 text-sm'
                      : 'bg-danger-100 text-danger-700 inline-block rounded-full px-2 py-0.5 text-sm'
                  }
                >
                  {event.outcome}
                </span>
              </td>
              <td className="px-4 py-3">
                <code className="text-sm break-all text-neutral-500">
                  {JSON.stringify(event.metadata)}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
