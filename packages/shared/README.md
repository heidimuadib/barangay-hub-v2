# @barangay-hub/shared

Reserved for code shared between `apps/web` and future non-web consumers —
the Slice 8 outbox dispatcher is the first expected tenant.

**Empty by design.** Nothing in the codebase today has more than one consumer:
every rule, schema, and helper is imported only by the web application, and
moving single-consumer code here would churn imports without changing the
dependency graph. The generated database types are also *not* here — they are
a Supabase artifact and live with the backend
(`backend/supabase/generated/database.types.ts`, consumed as
`@barangay-hub/supabase/types`).

`packages/ui` was **not** created for the same reason, per the refactor
brief's own qualifier ("only if shared UI actually exists"): the design-system
primitives in `apps/web/src/components` have no consumer outside the app.
