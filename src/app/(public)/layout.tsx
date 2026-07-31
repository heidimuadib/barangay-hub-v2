/**
 * Public shell placeholder.
 *
 * The real PublicShell — barangay identity, service navigation, accessibility
 * control, language placeholder and footer — is built in Part 1B / US-UI-002.
 * The skip link is present from the start because it must be the first focusable
 * element on every page (Phase 5 §33).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>
      <main id="main" className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </main>
    </>
  )
}
