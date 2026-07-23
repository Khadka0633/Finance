import { describe, it, expect } from 'vitest'
import {
  getAccountBalance,
  getAllAccountBalances,
  getTotalBalance,
  getIncomeExpenseTotals,
  getIncomeExpenseByAccountIds,
  getCategoryBreakdown,
  getSpentByCategory,
  getBudgetStatus,
  withRunningBalance,
} from './ledger'

const txns = [
  { id: 't1', accountId: 'cash', type: 'income', amount: 10000, category: 'Salary', localDate: '2026-07-01' },
  { id: 't2', accountId: 'cash', type: 'expense', amount: 2000, category: 'Food', localDate: '2026-07-05' },
  { id: 't3', accountId: 'cash', type: 'expense', amount: 1500, category: 'Food', localDate: '2026-07-10' },
  // transfer: cash -> bank, 3000
  { id: 't4', accountId: 'cash', type: 'transfer_out', amount: 3000, linkedAccountId: 'bank', transferId: 'x1', localDate: '2026-07-12' },
  { id: 't5', accountId: 'bank', type: 'transfer_in', amount: 3000, linkedAccountId: 'cash', transferId: 'x1', localDate: '2026-07-12' },
]

describe('getAccountBalance', () => {
  it('computes balance from income, expenses, and transfers for one account', () => {
    // cash: +10000 - 2000 - 1500 - 3000 = 3500
    expect(getAccountBalance('cash', txns)).toBe(3500)
  })
  it('reflects an incoming transfer for the destination account', () => {
    expect(getAccountBalance('bank', txns)).toBe(3000)
  })
  it('returns 0 for an account with no transactions', () => {
    expect(getAccountBalance('empty', txns)).toBe(0)
  })
})

describe('getAllAccountBalances', () => {
  it('computes balances for all accounts in one pass', () => {
    const accounts = [{ id: 'cash' }, { id: 'bank' }]
    const balances = getAllAccountBalances(accounts, txns)
    expect(balances.get('cash')).toBe(3500)
    expect(balances.get('bank')).toBe(3000)
  })
})

describe('getTotalBalance', () => {
  it('sums balances across all accounts', () => {
    const accounts = [{ id: 'cash' }, { id: 'bank' }]
    // total net worth: transfers cancel out, only income/expense matter
    // 10000 - 2000 - 1500 = 6500
    expect(getTotalBalance(accounts, txns)).toBe(6500)
  })
})

describe('getIncomeExpenseTotals', () => {
  it('sums income and expense, excluding transfers', () => {
    const { income, expense, net } = getIncomeExpenseTotals(txns)
    expect(income).toBe(10000)
    expect(expense).toBe(3500)
    expect(net).toBe(6500)
  })
  it('transfers do not pollute income/expense totals', () => {
    const onlyTransfers = txns.filter((t) => t.type.startsWith('transfer'))
    const { income, expense } = getIncomeExpenseTotals(onlyTransfers)
    expect(income).toBe(0)
    expect(expense).toBe(0)
  })
})

describe('getIncomeExpenseByAccountIds', () => {
  it('restricts income/expense totals to the given account IDs, including transfers out', () => {
    // cash: income 10000; expense 2000 + 1500 + 3000 (transfer out) = 6500
    const { income, expense, net } = getIncomeExpenseByAccountIds(txns, ['cash'])
    expect(income).toBe(10000)
    expect(expense).toBe(6500)
    expect(net).toBe(3500)
  })
  it('counts a transfer in as income for the receiving account', () => {
    const { income, expense } = getIncomeExpenseByAccountIds(txns, ['bank'])
    expect(income).toBe(3000)
    expect(expense).toBe(0)
  })
  it('returns zeros when no transactions match the given IDs', () => {
    const { income, expense } = getIncomeExpenseByAccountIds(txns, ['wallet'])
    expect(income).toBe(0)
    expect(expense).toBe(0)
  })
  it('sums across multiple account IDs', () => {
    const extra = [...txns, { id: 't6', accountId: 'bank', type: 'income', amount: 500, category: 'Interest', localDate: '2026-07-15' }]
    // cash income 10000 + bank transfer-in 3000 + bank income 500 = 13500
    const { income } = getIncomeExpenseByAccountIds(extra, ['cash', 'bank'])
    expect(income).toBe(13500)
  })
})

describe('getCategoryBreakdown', () => {
  it('groups expenses by category, sorted descending by amount', () => {
    const breakdown = getCategoryBreakdown(txns)
    expect(breakdown).toEqual([{ category: 'Food', amount: 3500 }])
  })
  it('excludes income and transfers', () => {
    const breakdown = getCategoryBreakdown(txns)
    expect(breakdown.find((b) => b.category === 'Salary')).toBeUndefined()
  })
})

describe('getSpentByCategory', () => {
  it('sums expense amounts for a category within a given month', () => {
    expect(getSpentByCategory(txns, 'Food', '2026-07')).toBe(3500)
  })
  it('returns 0 for a month with no matching spend', () => {
    expect(getSpentByCategory(txns, 'Food', '2026-08')).toBe(0)
  })
})

describe('getBudgetStatus', () => {
  it('flags "ok" when well under budget', () => {
    const status = getBudgetStatus({ category: 'Food', monthlyLimit: 10000 }, txns, '2026-07')
    expect(status.spent).toBe(3500)
    expect(status.tier).toBe('ok')
  })
  it('flags "warning" past 80% of budget', () => {
    const status = getBudgetStatus({ category: 'Food', monthlyLimit: 4000 }, txns, '2026-07')
    expect(status.tier).toBe('warning')
  })
  it('flags "over" when spend exceeds the limit', () => {
    const status = getBudgetStatus({ category: 'Food', monthlyLimit: 1000 }, txns, '2026-07')
    expect(status.tier).toBe('over')
    expect(status.remaining).toBeLessThan(0)
  })
})

describe('withRunningBalance', () => {
  it('accumulates a running balance in chronological order for one account', () => {
    const result = withRunningBalance(txns, 'cash')
    expect(result.map((t) => t.runningBalance)).toEqual([10000, 8000, 6500, 3500])
  })
  it('only includes transactions for the specified account', () => {
    const result = withRunningBalance(txns, 'bank')
    expect(result).toHaveLength(1)
    expect(result[0].runningBalance).toBe(3000)
  })
})