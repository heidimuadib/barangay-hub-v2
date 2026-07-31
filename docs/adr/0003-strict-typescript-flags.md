# ADR-0003 — Strict TypeScript flags, including `exactOptionalPropertyTypes`

- **Status:** Accepted, with a defined relaxation path
- **Date:** Phase 6 §17.1
- **Decision owner:** Tech lead

## Decision

`tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`,
`noFallthroughCasesInSwitch`, `noImplicitReturns` and `verbatimModuleSyntax`.

## Rationale

The system's correctness guarantees depend on distinguishing "absent" from
"present but undefined" — a `reasonCode` that is absent is a validation failure,
whereas one that is explicitly `undefined` is a bug that
`exactOptionalPropertyTypes` catches at compile time.

`noUncheckedIndexedAccess` matters because queue and report code indexes arrays
of database rows constantly.

## Known friction

`exactOptionalPropertyTypes` is the strictest of these and interacts awkwardly
with object spreads and some React prop patterns. The idiom used throughout this
codebase is a conditional spread:

```ts
{ ...(correlationId === undefined ? {} : { correlationId }) }
```

## Relaxation path

If the flag proves incompatible with a generated Next.js or third-party type in
a way that cannot be worked around:

1. Do **not** silently disable it.
2. Record the specific incompatibility in this ADR.
3. Scope the relaxation as narrowly as possible — a targeted `// @ts-expect-error`
   with justification is preferred to a global flag change.
4. A global change requires an amendment to this ADR approved by the tech lead.
