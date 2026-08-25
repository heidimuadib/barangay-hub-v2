import { PublicShell } from '@/components/shell'

/**
 * Public shell (UI-B, closing the US-UI-002 placeholder for this group).
 *
 * The skip link, the header, the container and the footer all live in
 * `PublicShell` — this file only chooses it. Portal *content* is UI-E.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>
}
