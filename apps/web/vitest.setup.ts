import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * Environment variables are NOT set here — they are set via `test.env` in
 * vitest.config.ts, because modules that validate their configuration at import
 * time are evaluated before any hook in this file runs.
 */
afterEach(() => {
  cleanup()
})
