# ADR-0005 — Slice 1 role catalog and account-provisioning policy

- **Status:** **Proposed** — implemented as the working set for Slice 1;
  role NAMES and the sign-up policy await owner confirmation (`DEC-ROLE-01`,
  `DEC-AUTH-01`). Renames are row updates, not schema changes.
- **Date:** Phase 7, Slice 1
- **Decision owner:** Product owner + Barangay Captain (names, scopes);
  tech lead (mechanics)

## Context

The Phase 1–6 planning artifacts referenced throughout this repository fix the
authorization MECHANICS precisely — `roles`/`permissions`/`role_permissions`
tables (Slice 0a seed note), live database resolution via
`auth_has_permission()` (Phase 4 DB-ADR-03), platform/tenant separation
(Phase 4 §16.4) — but no document in the repository names the final roles.
The legacy application distinguished only `admin`/`user` with an approval
status. Slice 1 cannot ship a permission model without concrete rows, and
inventing names silently is forbidden, hence this proposed ADR.

## Decision (proposed)

### Role catalog

| Key | Scope | Holds | Rationale |
| --- | --- | --- | --- |
| `platform_administrator` | platform | `platform.barangay.read`, `platform.audit.read` | Operates the `(platform)` console. **No tenant data access** (Phase 4 §16.4); support access arrives later as a time-boxed grant. |
| `barangay_administrator` | barangay | `membership.read`, `membership.manage`, `role.assign`, `audit.read` | Full in-tenant administration; maps to the legacy `admin`. |
| `barangay_staff` | barangay | `membership.read` | Counter staff; reads the roster, mutates nothing in Slice 1. Later slices add queue capabilities, not new roles. |
| `resident` | barangay | *(none)* | Self-service only, expressed through self-scoped RLS policies rather than grants over others' data. |

Names align with the shipped route groups (`(platform)`, `(staff)`,
`(resident)`), which are themselves Slice 0a-approved structure. Scopes are
structurally separated: composite FKs pin barangay-scoped assignments to
barangay-scoped roles and platform assignments to platform roles.

### Capability vocabulary

Dotted capability keys (`membership.manage`, `audit.read`, …), constrained by
CHECK; later slices add capabilities to this vocabulary rather than testing
role names in code. Application code never branches on a role key.

### Account provisioning (Slice 1)

**No public sign-up.** Resident self-registration belongs to the resident
registration slice (out of Slice 1 scope), so the sign-up surface is absent
entirely rather than disabled. Accounts exist via:

1. Seed fixtures (local/CI) — synthetic only, guarded by Phase 6 §22.2.
2. `create_membership_by_email()` — a barangay administrator connects an
   EXISTING account to their barangay (invited → active), with uniform
   ineligibility errors so the function is not an account-enumeration oracle.
3. Tenant provisioning (later slice) — the `tenant-provisioning` service-role
   operation creates the first administrator account of a new barangay.

## Consequences

- Later slices extend `permissions`/`role_permissions` by migration; the
  authorization pipeline (`auth_context()` → guards → RLS) never changes shape.
- If the owners rename roles (e.g. to Punong Barangay / Kagawad vocabulary),
  the change is an UPDATE to `roles.name`/`roles.key` plus seed/test updates —
  no policy or code redesign, because nothing branches on role keys.
- Accepting Option 2-style multi-tenancy at scale requires no rework: the
  membership model already supports one account in many barangays.

## Revisit triggers

- Owner ruling on `DEC-ROLE-01` (names/scopes) or `DEC-AUTH-01` (public
  sign-up) — update rows, seeds and this ADR's status.
- The first capability that does not fit the dotted vocabulary.
