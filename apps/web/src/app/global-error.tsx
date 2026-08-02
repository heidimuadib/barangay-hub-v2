'use client'

/**
 * Root error boundary.
 *
 * Replaces the entire document when the root layout itself fails, so it must
 * render its own <html> and <body> and must not depend on anything the root
 * layout provides — including the stylesheet. All styling here is inline for
 * that reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          color: '#111827',
          background: '#f9fafb',
        }}
      >
        <div role="alert" style={{ maxWidth: '34rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Barangay Hub is temporarily unavailable</h1>
          <p style={{ lineHeight: 1.6 }}>
            The service could not start correctly. Please try again in a few minutes. Barangay staff
            can continue serving residents at the counter in the meantime.
          </p>
          <p style={{ lineHeight: 1.6 }}>
            Reference: <code>{error.digest ?? 'unavailable'}</code>
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: '44px',
              padding: '0.5rem 1rem',
              border: 0,
              borderRadius: '6px',
              background: '#0e5d52',
              color: '#ffffff',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
