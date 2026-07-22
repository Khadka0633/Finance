import { describe, it, expect } from 'vitest'
import { toLocalDateString, monthOf, formatMonthLabel, formatDateLabel, isFutureDate } from './dates'

describe('toLocalDateString', () => {
  it('formats a date as YYYY-MM-DD using local fields', () => {
    const d = new Date(2026, 6, 22) // July 22, 2026 (month is 0-indexed)
    expect(toLocalDateString(d)).toBe('2026-07-22')
  })
  it('pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5) // Jan 5, 2026
    expect(toLocalDateString(d)).toBe('2026-01-05')
  })
})

describe('monthOf', () => {
  it('extracts YYYY-MM from a local date string', () => {
    expect(monthOf('2026-07-22')).toBe('2026-07')
  })
  it('handles missing input', () => {
    expect(monthOf(undefined)).toBe('')
  })
})

describe('formatMonthLabel', () => {
  it('formats YYYY-MM as a readable month/year label', () => {
    expect(formatMonthLabel('2026-07')).toBe('July 2026')
  })
})

describe('formatDateLabel', () => {
  it('formats a local date string as a readable label', () => {
    expect(formatDateLabel('2026-07-22')).toBe('Jul 22, 2026')
  })
  it('handles empty input', () => {
    expect(formatDateLabel('')).toBe('')
  })
})

describe('isFutureDate', () => {
  it('returns true for a date after today', () => {
    expect(isFutureDate('2099-01-01')).toBe(true)
  })
  it('returns false for a date before today', () => {
    expect(isFutureDate('2000-01-01')).toBe(false)
  })
})
