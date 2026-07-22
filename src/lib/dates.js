// Firestore timestamps are UTC-based, which misgroups transactions made
// near midnight for users outside UTC. Every transaction also stores a
// localDate string ("YYYY-MM-DD") computed on the user's device — that's
// what all month/day grouping logic should read, never the UTC timestamp.

/** Today's date in the user's local timezone as "YYYY-MM-DD" */
export function todayLocalDate() {
  return toLocalDateString(new Date())
}

/** Convert a JS Date to "YYYY-MM-DD" using local (not UTC) fields */
export function toLocalDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Extract "YYYY-MM" from a "YYYY-MM-DD" local date string */
export function monthOf(localDate) {
  return localDate?.slice(0, 7) ?? ''
}

/** Current month as "YYYY-MM" */
export function currentMonth() {
  return monthOf(todayLocalDate())
}

/** Human label for a "YYYY-MM" string, e.g. "2026-07" -> "July 2026" */
export function formatMonthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** Human label for a "YYYY-MM-DD" string, e.g. "Jul 22, 2026" */
export function formatDateLabel(localDate) {
  if (!localDate) return ''
  const [y, m, d] = localDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Is this local date string in the future compared to today? */
export function isFutureDate(localDate) {
  return localDate > todayLocalDate()
}
