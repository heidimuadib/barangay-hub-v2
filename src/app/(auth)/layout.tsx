/**
 * Auth shell placeholder.
 *
 * Deliberately minimal: no navigation, no tenant switcher, no announcements.
 * A credential screen shows the barangay identity and nothing else, so that
 * nothing on the page can be used to enumerate tenants or residents
 * (Phase 5 §11.1).
 *
 * The real AuthShell — identity block, locale control, support link — is built
 * in Slice 1 / US-UI-002.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>
      <main
        id="main"
        className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center px-4 py-10"
      >
        {children}
      </main>
    </>
  )
}
