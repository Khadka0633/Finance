// Pure derivation functions over transaction arrays. Balances are NEVER
// stored as a mutable field — they're always computed from transaction
// history, which keeps them offline-safe (no runTransaction() needed)
// and immune to drift.

/** Sum of all transactions affecting a given account, signed correctly */
export function getAccountBalance(accountId, transactions) {
  let sum = 0
  for (const txn of transactions) {
    if (txn.accountId !== accountId) continue
    if (txn.type === 'income' || txn.type === 'transfer_in') sum += txn.amount
    else if (txn.type === 'expense' || txn.type === 'transfer_out') sum -= txn.amount
  }
  return sum
}

/** Balance for every account at once, in a single pass */
export function getAllAccountBalances(accounts, transactions) {
  const byAccount = new Map(accounts.map((a) => [a.id, 0]))
  for (const txn of transactions) {
    if (!byAccount.has(txn.accountId)) continue
    const delta =
      txn.type === 'income' || txn.type === 'transfer_in'
        ? txn.amount
        : txn.type === 'expense' || txn.type === 'transfer_out'
          ? -txn.amount
          : 0
    byAccount.set(txn.accountId, byAccount.get(txn.accountId) + delta)
  }
  return byAccount
}

/** Total balance across all accounts */
export function getTotalBalance(accounts, transactions) {
  const balances = getAllAccountBalances(accounts, transactions)
  let total = 0
  for (const v of balances.values()) total += v
  return total
}

/** Income and expense totals for a set of transactions (transfers excluded) */
export function getIncomeExpenseTotals(transactions) {
  let income = 0
  let expense = 0
  for (const txn of transactions) {
    if (txn.type === 'income') income += txn.amount
    else if (txn.type === 'expense') expense += txn.amount
  }
  return { income, expense, net: income - expense }
}

/** Group expense transactions by category, summing amounts (transfers excluded) */
export function getCategoryBreakdown(transactions) {
  const map = new Map()
  for (const txn of transactions) {
    if (txn.type !== 'expense') continue
    map.set(txn.category, (map.get(txn.category) ?? 0) + txn.amount)
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}

/** How much has been spent in a category during a given "YYYY-MM" month */
export function getSpentByCategory(transactions, category, yyyyMm) {
  let sum = 0
  for (const txn of transactions) {
    if (txn.type !== 'expense') continue
    if (txn.category !== category) continue
    if (!txn.localDate?.startsWith(yyyyMm)) continue
    sum += txn.amount
  }
  return sum
}

/** Budget status: spent, remaining, percent used, and a color tier */
export function getBudgetStatus(budget, transactions, yyyyMm) {
  const spent = getSpentByCategory(transactions, budget.category, yyyyMm)
  const percent = budget.monthlyLimit > 0 ? spent / budget.monthlyLimit : 0
  const tier = percent > 1 ? 'over' : percent > 0.8 ? 'warning' : 'ok'
  return { spent, remaining: budget.monthlyLimit - spent, percent, tier }
}

/**
 * Running balance for a ledger-style list. Expects transactions sorted
 * OLDEST FIRST for correct accumulation; returns them annotated with
 * runningBalance, still oldest-first (caller reverses for display if needed).
 * Only includes transactions for the given accountId (running balance is
 * per-account, since combining accounts would mix currencies/contexts).
 */
export function withRunningBalance(transactions, accountId) {
  let running = 0
  const result = []
  for (const txn of transactions) {
    if (txn.accountId !== accountId) continue
    if (txn.type === 'income' || txn.type === 'transfer_in') running += txn.amount
    else if (txn.type === 'expense' || txn.type === 'transfer_out') running -= txn.amount
    result.push({ ...txn, runningBalance: running })
  }
  return result
}
