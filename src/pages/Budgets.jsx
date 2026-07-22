import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useBudgets, useMonthTransactions } from '../hooks/useLedgerData'
import { currentMonth } from '../lib/dates'
import { getBudgetStatus } from '../lib/ledger'
import { formatMoney, parseMoneyInput, isValidAmount } from '../lib/money'
import { addBudget, deleteBudget } from '../services/budgets'

const CATEGORIES = ['Food', 'Transport', 'Rent', 'Utilities', 'Shopping', 'Health', 'Entertainment', 'Other']

const TIER_COLOR = {
  ok: 'bg-[var(--color-income)]',
  warning: 'bg-[var(--color-budget)]',
  over: 'bg-[var(--color-expense)]',
}

export function Budgets() {
  const { uid } = useOutletContext()
  const month = currentMonth()
  const budgets = useBudgets(uid)
  const { transactions } = useMonthTransactions(uid, month)
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl">Budgets</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary rounded px-4 py-2 text-sm">
          + Add budget
        </button>
      </div>

      <div className="space-y-3">
        {budgets.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">No budgets set yet.</p>}
        {budgets.map((b) => {
          const status = getBudgetStatus(b, transactions, month)
          const pct = Math.min(status.percent * 100, 100)
          return (
            <div key={b.id} className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span>{b.category}</span>
                <div className="flex items-center gap-3">
                  <span className="tabular text-sm">{formatMoney(status.spent)} / {formatMoney(b.monthlyLimit)}</span>
                  <button onClick={() => deleteBudget(uid, b.id)} className="text-xs underline text-[var(--color-expense)]">Delete</button>
                </div>
              </div>
              <div className="h-2 rounded-full bg-[var(--color-hairline)] overflow-hidden">
                <div className={`h-full ${TIER_COLOR[status.tier]}`} style={{ width: `${pct}%` }} />
              </div>
              {status.tier === 'over' && (
                <p className="text-xs text-[var(--color-expense)] mt-1">Over budget by {formatMoney(Math.abs(status.remaining))}</p>
              )}
            </div>
          )
        })}
      </div>

      {showForm && <BudgetForm uid={uid} existing={budgets.map((b) => b.category)} onClose={() => setShowForm(false)} />}
    </div>
  )
}

function BudgetForm({ uid, existing, onClose }) {
  const available = CATEGORIES.filter((c) => !existing.includes(c))
  const [category, setCategory] = useState(available[0] ?? CATEGORIES[0])
  const [limitInput, setLimitInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const monthlyLimit = parseMoneyInput(limitInput)
    if (!isValidAmount(monthlyLimit)) {
      setError('Please enter a limit greater than zero.')
      return
    }
    setBusy(true)
    try {
      await addBudget(uid, { category, monthlyLimit })
      onClose()
    } catch {
      setError('Could not save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center px-4 z-50" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-[var(--color-paper-raised)] rounded-lg p-6 w-full max-w-sm space-y-3">
        <h2 className="text-lg mb-2">New budget</h2>
        {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="text"
          inputMode="decimal"
          placeholder="Monthly limit"
          value={limitInput}
          onChange={(e) => setLimitInput(e.target.value)}
          className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white tabular"
        />
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-[var(--color-hairline)] rounded py-2">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1 rounded py-2 disabled:opacity-50">Save</button>
        </div>
      </form>
    </div>
  )
}
