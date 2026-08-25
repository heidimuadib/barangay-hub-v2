import Link from 'next/link'
import type { ReactNode } from 'react'

import { BrandLockup } from '@/components/shell/brand-lockup'

/**
 * Modern tenant-neutral auth shell (UI-C).
 *
 * Deliberately minimal and tenant-neutral: no barangay switcher, no
 * announcements, no tenant branding that creates enumeration risk
 * (Phase 5 §11.1).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50 text-neutral-900">
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>

      <header className="border-b border-neutral-200 bg-white py-4 shadow-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="focus-visible:outline-brand-700 inline-flex min-h-11 items-center rounded-md focus-visible:outline-2"
          >
            <BrandLockup />
          </Link>
          <span className="text-dense text-neutral-500">Citizen Services Portal</span>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-[28rem] flex-1 flex-col justify-center px-4 py-10 sm:px-6"
      >
        {children}
      </main>

      <footer className="border-t border-neutral-200 bg-white py-4 text-center text-xs text-neutral-500">
        <p>Barangay Hub &bull; Secure resident authentication and registration</p>
      </footer>
    </div>
  )
}
