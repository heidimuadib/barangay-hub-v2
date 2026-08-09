/**
 * Display formatting (UI-B).
 *
 * The counterpart of `normalize.ts`: that module cleans values on the way INTO
 * the database and is deliberately conservative about it. This one only changes
 * how a stored value is shown, and never what is stored.
 */

/**
 * Turns a role key into something a person reads — `barangay_administrator`
 * becomes "Barangay administrator".
 *
 * Roles are snake_case identifiers in the database, and the shells used to
 * print them raw: the staff sidebar showed "San Isidro (Test) ·
 * barangay_administrator", which is 22 characters of identifier in a 16rem
 * column and truncated to "· b…". Only the first word is capitalised, sentence
 * case rather than Title Case, so "Barangay administrator" does not read as a
 * proper noun.
 *
 * Presentation only. The role key itself is never rewritten, and nothing
 * authorizes on this string.
 */
export function formatRoleLabel(role: string): string {
  const words = role.replace(/[_-]+/g, ' ').trim()
  if (words.length === 0) {
    return role
  }
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The same, for the role list a membership carries. */
export function formatRoleList(roles: readonly string[]): string {
  return roles.map(formatRoleLabel).join(', ')
}
