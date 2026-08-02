import js from '@eslint/js'

/**
 * ROOT lint configuration (ADR-0007).
 *
 * Covers only what belongs to no workspace package: the repo-level scripts,
 * the backend's Node scripts, and root config files. The application has its
 * own full configuration — typed rules, architectural boundaries, the
 * service-role allow-list — at `apps/web/eslint.config.mjs`; the root `lint`
 * script runs both, so nothing that was linted before the workspace split
 * stops being linted after it.
 */
export default [
  {
    ignores: [
      'apps/**',
      'packages/**',
      'backend/supabase/**',
      'node_modules/**',
      'docs/**',
      '.husky/**',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      // These are CLI tools; stdout is their interface.
      'no-console': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
    },
  },
]
