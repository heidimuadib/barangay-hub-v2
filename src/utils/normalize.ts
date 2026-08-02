/**
 * Input normalisation for registry writes.
 *
 * Deliberately conservative: names are trimmed and internal whitespace is
 * collapsed, and nothing else. No title-casing, no punctuation stripping —
 * Philippine names legitimately carry particles ("dela Cruz"), hyphens,
 * apostrophes and mixed case, and "tidying" them corrupts the record the
 * barangay is supposed to hold.
 */
export function normalizePersonName(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * Phone normalisation keeps digits and a single leading `+`, discarding the
 * spaces, dashes and parentheses people type. It does NOT rewrite `09…` into
 * `+639…`: that guesses a country and would silently alter a contact number
 * staff may need to dial exactly as given.
 */
export function normalizeContactPhone(value: string): string {
  const trimmed = value.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  return digits.length === 0 ? '' : `${hasPlus ? '+' : ''}${digits}`
}

/**
 * Search-term normalisation, mirroring what `person_search` does in SQL
 * (lower + unaccent). Used to decide whether a term is worth sending, never
 * to build a URL.
 */
export function normalizeSearchTerm(value: string): string {
  return (
    value
      .normalize('NFD')
      // Escaped, not literal: the combining-mark range is invisible in an editor
      // and does not survive a re-encode intact.
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  )
}

/** Two characters is the floor the SQL function also enforces. */
export const MIN_SEARCH_LENGTH = 2

export function isSearchable(value: string): boolean {
  return normalizeSearchTerm(value).length >= MIN_SEARCH_LENGTH
}

/**
 * A birthdate must be a real past date. Ages beyond 130 are refused as data
 * entry errors rather than as a claim about anyone's age.
 */
export function isPlausibleBirthdate(value: string, today = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false
  // Round-trip guards against rolled-over dates such as 2026-02-31.
  if (parsed.toISOString().slice(0, 10) !== value) return false

  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  if (parsed.getTime() > todayUtc.getTime()) return false

  const earliest = Date.UTC(
    todayUtc.getUTCFullYear() - 130,
    todayUtc.getUTCMonth(),
    todayUtc.getUTCDate(),
  )
  return parsed.getTime() >= earliest
}
