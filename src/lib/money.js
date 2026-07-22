// All amounts are stored and summed as INTEGER CENTS. Never do arithmetic
// on a formatted (divided) value — only on the raw integer.

/** Format integer cents as a display string, e.g. 1050 -> "10.50" */
export function formatMoney(cents, { withSymbol = true, currency = 'Rs.' } = {}) {
  if (!Number.isFinite(cents)) return withSymbol ? `${currency} 0.00` : '0.00'
  const negative = cents < 0
  const abs = Math.abs(cents)
  const value = (abs / 100).toFixed(2)
  const [whole, frac] = value.split('.')
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const formatted = `${withCommas}.${frac}`
  const signed = negative ? `-${formatted}` : formatted
  return withSymbol ? `${currency} ${signed}` : signed
}

/** Parse a user-typed string like "10.50" or "10" into integer cents */
export function parseMoneyInput(input) {
  if (typeof input !== 'string') input = String(input ?? '')
  const cleaned = input.replace(/,/g, '').trim()
  if (cleaned === '' || Number.isNaN(Number(cleaned))) return null
  const value = Math.round(parseFloat(cleaned) * 100)
  return Number.isFinite(value) ? value : null
}

/** Sum an array of integer-cent amounts safely */
export function sumCents(amounts) {
  return amounts.reduce((total, n) => total + (Number.isFinite(n) ? n : 0), 0)
}

/** Is this a valid positive integer amount in cents? */
export function isValidAmount(cents) {
  return Number.isInteger(cents) && cents > 0
}
