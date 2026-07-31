import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

/**
 * Unit and component test configuration (Phase 6 §20.1).
 *
 * Playwright owns end-to-end tests and pgTAP owns database tests; both are
 * excluded here so that a single `pnpm test` never silently skips or duplicates
 * them.
 *
 * Coverage thresholds are intentionally scoped to the modules that exist in
 * Slice 0a. They are raised per slice as domain code lands — a global threshold
 * set now would either be meaningless or would block the first feature commit.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // See tests/stubs/server-only.ts for why this alias exists and why it
      // does not weaken the production guard.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],

    /**
     * Applied to `process.env` before any module is imported.
     *
     * It has to happen here rather than in a setup-file hook: `env.server.ts`
     * validates at module load, and static imports are evaluated before
     * `beforeAll` runs, so a hook would be too late.
     *
     * Every value is syntactically valid but obviously fake. No real key of any
     * kind — local, integration or otherwise — belongs in a committed file.
     * `APP_ENV=test` also forces every environment branch onto its
     * non-production path.
     */
    env: {
      APP_ENV: 'test',
      LOG_LEVEL: 'error',
      NEXT_PUBLIC_APP_ENV: 'test',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key-not-a-real-credential-000000',
    },

    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**', 'supabase/**'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      // Raised per slice as domain code lands (Slice 1 adds the pure
      // authorization rules and schemas — the layers that must be exhaustively
      // testable without a database).
      include: [
        'src/lib/**/*.ts',
        'src/utils/**/*.ts',
        'src/hooks/**/*.ts',
        'src/features/*/rules/**/*.ts',
        'src/features/*/schemas/**/*.ts',
      ],
      exclude: ['src/lib/**/index.ts', 'src/lib/config/env.server.ts', 'src/**/*.test.ts'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
})
