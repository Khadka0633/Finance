import { describe, it, expect } from 'vitest'
import { formatMoney, parseMoneyInput, sumCents, isValidAmount } from './money'

describe('formatMoney', () => {
  it('formats cents as dollars with two decimals', () => {
    expect(formatMoney(1050)).toBe('Rs. 10.50')
  })
  it('formats zero correctly', () => {
    expect(formatMoney(0)).toBe('Rs. 0.00')
  })
  it('formats negative amounts with a leading minus', () => {
    expect(formatMoney(-500)).toBe('Rs. -5.00')
  })
  it('adds thousands separators', () => {
    expect(formatMoney(123456789)).toBe('Rs. 1,234,567.89')
  })
  it('omits the symbol when requested', () => {
    expect(formatMoney(1050, { withSymbol: false })).toBe('10.50')
  })
  it('handles non-finite input gracefully', () => {
    expect(formatMoney(NaN)).toBe('Rs. 0.00')
    expect(formatMoney(undefined)).toBe('Rs. 0.00')
  })
})

describe('parseMoneyInput', () => {
  it('parses a plain decimal string into cents', () => {
    expect(parseMoneyInput('10.50')).toBe(1050)
  })
  it('parses a whole number string', () => {
    expect(parseMoneyInput('10')).toBe(1000)
  })
  it('strips thousands separators', () => {
    expect(parseMoneyInput('1,234.56')).toBe(123456)
  })
  it('returns null for empty input', () => {
    expect(parseMoneyInput('')).toBeNull()
  })
  it('returns null for non-numeric input', () => {
    expect(parseMoneyInput('abc')).toBeNull()
  })
  it('rounds fractional cents correctly (avoids float drift)', () => {
    // 0.1 + 0.2 !== 0.3 in raw float math; this must round cleanly
    expect(parseMoneyInput('0.1')).toBe(10)
    expect(parseMoneyInput('19.99')).toBe(1999)
  })
})

describe('sumCents', () => {
  it('sums an array of integer cents exactly', () => {
    // classic float trap: 10 + 20 in "dollars" as floats can drift; cents must not
    expect(sumCents([1050, 2075, 300])).toBe(3425)
  })
  it('returns 0 for an empty array', () => {
    expect(sumCents([])).toBe(0)
  })
  it('ignores non-finite entries defensively', () => {
    expect(sumCents([100, NaN, 200])).toBe(300)
  })
})

describe('isValidAmount', () => {
  it('accepts positive integers', () => {
    expect(isValidAmount(100)).toBe(true)
  })
  it('rejects zero', () => {
    expect(isValidAmount(0)).toBe(false)
  })
  it('rejects negative numbers', () => {
    expect(isValidAmount(-50)).toBe(false)
  })
  it('rejects non-integers', () => {
    expect(isValidAmount(10.5)).toBe(false)
  })
})
