import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import tseslint from 'typescript-eslint'

const rootDir = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: rootDir })

/**
 * Modules permitted to import the Supabase service-role client.
 * Source of truth: Phase 4 §25.6 / Phase 6 §25.6 (eight named system operations).
 * Adding an entry requires an ADR.
 */
const SERVICE_ROLE_ALLOWLIST = [
  'src/services/audit/**',
  'src/services/outbox/**',
  'src/features/certificates/services/generation-worker.ts',
  'src/features/certificates/services/artifact-writer.ts',
  'src/features/certificates/services/public-verification.ts',
  'src/features/documents/services/public-tracking.ts',
  'src/features/platform/services/provision-tenant.ts',
  'src/features/platform/services/establish-grant.ts',
  'src/app/api/cron/**',
]

/** Locations where raw SQL is permitted (Phase 6 §15.4 prohibition 6). */
const SQL_ALLOWLIST = ['src/features/*/repositories/**', 'scripts/**', 'supabase/**']

const restrictedImportRule = [
  'error',
  {
    paths: [
      {
        name: '@/lib/supabase/service-role',
        message:
          'The service-role client bypasses RLS. It may only be imported from the modules listed in eslint.config.mjs (Phase 6 §25.6). Adding one requires an ADR.',
      },
    ],
    patterns: [
      {
        group: ['@/features/*/services/*', '@/features/*/repositories/*', '@/features/*/rules/*'],
        message:
          'Cross-feature imports must go through the feature public barrel: `@/features/<name>` (Phase 6 §16.2).',
      },
    ],
  },
]

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'supabase/.temp/**',
      'supabase/.branches/**',
      'next-env.d.ts',
      '.husky/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...compat.extends('next/core-web-vitals'),

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: rootDir,
      },
    },
  },

  // Type-aware rules cannot run on plain JS/MJS (not in the TS project).
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // ── Architectural boundaries (Phase 6 §16.1) ───────────────────────────────
  // Dependency direction:
  //   app → features → services → lib → utils        (never upward)
  //   domain code must not import React or anything from app/
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*.{ts,tsx}'],
      // Every element declares `mode: 'full'`. The plugin's default is 'folder',
      // which matches the pattern against the containing FOLDER — so a file
      // sitting directly in `src/types/` never matches `src/types/**/*` and is
      // classified as unknown. 'full' matches the whole path and behaves the way
      // these patterns read.
      'boundaries/elements': [
        { type: 'middleware', pattern: 'src/middleware.ts', mode: 'full' },
        { type: 'instrumentation', pattern: 'src/instrumentation.ts', mode: 'full' },
        {
          type: 'feature-index',
          pattern: 'src/features/*/index.ts',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-const',
          pattern: 'src/features/*/constants.ts',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-action',
          pattern: 'src/features/*/actions/**/*',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-service',
          pattern: 'src/features/*/services/**/*',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-repository',
          pattern: 'src/features/*/repositories/**/*',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-rule',
          pattern: 'src/features/*/rules/**/*',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-schema',
          pattern: 'src/features/*/schemas/**/*',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-component',
          pattern: 'src/features/*/components/**/*',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-hook',
          pattern: 'src/features/*/hooks/**/*',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-query',
          pattern: 'src/features/*/queries/**/*',
          mode: 'full',
          capture: ['feature'],
        },
        {
          type: 'feature-type',
          pattern: 'src/features/*/types/**/*',
          mode: 'full',
          capture: ['feature'],
        },
        { type: 'app', pattern: 'src/app/**/*', mode: 'full' },
        { type: 'shared-component', pattern: 'src/components/**/*', mode: 'full' },
        { type: 'hook', pattern: 'src/hooks/**/*', mode: 'full' },
        { type: 'service', pattern: 'src/services/**/*', mode: 'full' },
        { type: 'lib', pattern: 'src/lib/**/*', mode: 'full' },
        { type: 'util', pattern: 'src/utils/**/*', mode: 'full' },
        { type: 'type', pattern: 'src/types/**/*', mode: 'full' },
        { type: 'style', pattern: 'src/styles/**/*', mode: 'full' },
        { type: 'email', pattern: 'src/emails/**/*', mode: 'full' },
      ],
    },
    rules: {
      'boundaries/no-unknown': 'error',
      'boundaries/no-unknown-files': 'off',
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message: '${file.type} is not allowed to import ${dependency.type} (Phase 6 §16.1).',
          rules: [
            {
              from: ['app', 'middleware', 'instrumentation'],
              allow: [
                'feature-index',
                'feature-action',
                'feature-component',
                'feature-const',
                'feature-type',
                'shared-component',
                'hook',
                'lib',
                'service',
                'type',
                'util',
                'style',
                'app',
              ],
            },
            {
              from: ['feature-index'],
              allow: [
                ['feature-action', { feature: '${from.feature}' }],
                ['feature-service', { feature: '${from.feature}' }],
                ['feature-schema', { feature: '${from.feature}' }],
                ['feature-type', { feature: '${from.feature}' }],
                ['feature-const', { feature: '${from.feature}' }],
                ['feature-component', { feature: '${from.feature}' }],
                'type',
              ],
            },
            {
              from: ['feature-action'],
              allow: [
                ['feature-service', { feature: '${from.feature}' }],
                ['feature-schema', { feature: '${from.feature}' }],
                ['feature-rule', { feature: '${from.feature}' }],
                ['feature-type', { feature: '${from.feature}' }],
                ['feature-const', { feature: '${from.feature}' }],
                'feature-index',
                'lib',
                'service',
                'type',
                'util',
              ],
            },
            {
              from: ['feature-service'],
              allow: [
                ['feature-repository', { feature: '${from.feature}' }],
                ['feature-rule', { feature: '${from.feature}' }],
                ['feature-schema', { feature: '${from.feature}' }],
                ['feature-type', { feature: '${from.feature}' }],
                ['feature-const', { feature: '${from.feature}' }],
                'feature-index',
                'lib',
                'service',
                'type',
                'util',
              ],
            },
            {
              from: ['feature-repository'],
              allow: [
                ['feature-type', { feature: '${from.feature}' }],
                ['feature-const', { feature: '${from.feature}' }],
                'lib',
                'type',
                'util',
              ],
            },
            {
              // Pure functions only — no I/O, no framework.
              from: ['feature-rule'],
              allow: [
                ['feature-type', { feature: '${from.feature}' }],
                ['feature-const', { feature: '${from.feature}' }],
                'type',
                'util',
              ],
            },
            {
              from: ['feature-schema'],
              allow: [
                ['feature-const', { feature: '${from.feature}' }],
                ['feature-type', { feature: '${from.feature}' }],
                'lib',
                'type',
                'util',
              ],
            },
            {
              from: ['feature-component', 'feature-hook', 'feature-query'],
              allow: [
                ['feature-action', { feature: '${from.feature}' }],
                ['feature-schema', { feature: '${from.feature}' }],
                ['feature-type', { feature: '${from.feature}' }],
                ['feature-const', { feature: '${from.feature}' }],
                ['feature-component', { feature: '${from.feature}' }],
                ['feature-hook', { feature: '${from.feature}' }],
                ['feature-query', { feature: '${from.feature}' }],
                'feature-index',
                'shared-component',
                'hook',
                'lib',
                'type',
                'util',
                'style',
              ],
            },
            {
              from: ['shared-component'],
              allow: ['shared-component', 'hook', 'lib', 'type', 'util', 'style'],
            },
            { from: ['hook'], allow: ['hook', 'lib', 'type', 'util'] },
            { from: ['service'], allow: ['service', 'lib', 'type', 'util', 'email'] },
            { from: ['lib'], allow: ['lib', 'type', 'util'] },
            { from: ['util'], allow: ['util', 'type'] },
            { from: ['type'], allow: ['type'] },
            { from: ['email'], allow: ['lib', 'type', 'util', 'style'] },
            { from: ['style'], allow: ['style'] },
          ],
        },
      ],
    },
  },

  // ── Project rules (Phase 6 §17) ────────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      // No allow-list: every level is banned. src/lib/logger/logger.ts is the
      // single exempted module (see the override below).
      'no-console': 'error',
      'no-restricted-imports': restrictedImportRule,
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'TemplateLiteral > TemplateElement[value.raw=/\\b(SELECT|INSERT INTO|UPDATE\\s+\\w+\\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\\b/i]',
          message:
            'Raw SQL is only permitted in repositories, scripts and supabase/ (Phase 6 §15.4). Use a repository function.',
        },
      ],
    },
  },

  // Service-role allow-list (Phase 6 §25.6).
  {
    files: SERVICE_ROLE_ALLOWLIST,
    rules: { 'no-restricted-imports': 'off' },
  },

  // Raw-SQL allow-list.
  {
    files: SQL_ALLOWLIST,
    rules: { 'no-restricted-syntax': 'off' },
  },

  // The logger is the only module permitted to write to stdout directly.
  {
    files: ['src/lib/logger/logger.ts'],
    rules: { 'no-console': 'off' },
  },

  // Generated by `pnpm types:gen`. It must remain a known boundaries element so
  // that modules importing it are not flagged as importing an unknown element —
  // which is why it is not in the global ignore list — but its style is the
  // Supabase generator's, not ours.
  {
    files: ['src/types/database.types.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
    },
  },

  // Build/tooling scripts run outside the app runtime.
  {
    files: ['scripts/**/*.mjs', '*.config.{ts,mjs,js}', 'eslint.config.mjs'],
    rules: {
      'no-console': 'off',
      'no-restricted-imports': 'off',
      'boundaries/no-unknown': 'off',
      // Framework config hooks (e.g. Next's `headers()`) are typed as async by
      // the framework whether or not the body awaits anything.
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Tests may reach across boundaries to arrange fixtures.
  {
    files: ['tests/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    rules: {
      'boundaries/element-types': 'off',
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
)
