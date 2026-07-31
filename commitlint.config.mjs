/**
 * Conventional Commits (Phase 6 §18.1).
 * Scope should name the module: feat(documents): ...
 * The body should reference the story ID: US-DOC-002.
 */
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'db', 'docs', 'test', 'refactor', 'perf', 'ci', 'build', 'revert'],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'header-max-length': [2, 'always', 100],
  },
}

export default config
