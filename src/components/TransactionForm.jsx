import { useEffect, useMemo, useState } from 'react'
import { parseMoneyInput, isValidAmount } from '../lib/money'
import { todayLocalDate, isFutureDate } from '../lib/dates'
import { addTransaction, updateTransaction } from '../services/transactions'
import { addTransfer, updateTransfer } from '../services/transfers'
import { fetchCustomCategories, addCustomCategory } from '../services/categories'

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Rent', 'Utilities', 'Shopping', 'Health', 'Entertainment', 'Other']
const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Gift', 'Other']

export function TransactionForm({ uid, accounts, existing, onClose }) {
  const isTransfer = existing?.type === 'transfer_out' || existing?.type === 'transfer_in'
  const [kind, setKind] = useState(isTransfer ? 'transfer' : (existing?.type ?? 'expense'))
  const [customCategories, setCustomCategories] = useState({ expense: [], income: [] })
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const categoryOptions = useMemo(() => {
    const base = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    const custom = (kind === 'income' ? customCategories.income : customCategories.expense).filter((c) => !base.includes(c))
    const withoutOther = base.filter((c) => c !== 'Other')
    return [...withoutOther, ...custom, 'Other']
  }, [kind, customCategories])
  const [amountInput, setAmountInput] = useState(existing ? String(existing.amount / 100) : '')
  const [category, setCategory] = useState(existing?.category ?? categoryOptions[0])
  const [accountId, setAccountId] = useState(existing?.accountId ?? accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(existing?.linkedAccountId ?? accounts[1]?.id ?? accounts[0]?.id ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [date, setDate] = useState(existing?.localDate ?? todayLocalDate())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchCustomCategories(uid).then((result) => {
      if (!cancelled) setCustomCategories(result)
    })
    return () => { cancelled = true }
  }, [uid])

  async function handleAddCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    setCategory(name)
    setCustomCategories((prev) => {
      const key = kind === 'income' ? 'income' : 'expense'
      return prev[key].includes(name) ? prev : { ...prev, [key]: [...prev[key], name] }
    })
    setAddingCategory(false)
    setNewCategoryName('')
    try {
      await addCustomCategory(uid, kind, name)
    } catch {
      // Best-effort: this transaction still saves fine even if persisting
      // the category name for next time fails.
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const amount = parseMoneyInput(amountInput)
    if (addingCategory) {
      setError('Finish adding the new category first, or cancel it.')
      return
    }
    if (!isValidAmount(amount)) {
      setError('Please enter a valid amount greater than zero.')
      return
    }
    if (isFutureDate(date)) {
      setError('Date cannot be in the future.')
      return
    }
    if (kind === 'transfer' && accountId === toAccountId) {
      setError('Choose two different accounts for a transfer.')
      return
    }

    setBusy(true)
    try {
      if (kind === 'transfer') {
        if (existing?.transferId) {
          await updateTransfer(uid, existing.transferId, { amount, note, localDate: date })
        } else {
          await addTransfer(uid, { fromAccountId: accountId, toAccountId, amount, note, localDate: date })
        }
      } else if (existing) {
        await updateTransaction(uid, existing.id, { amount, type: kind, accountId, category, note, localDate: date })
      } else {
        await addTransaction(uid, { amount, type: kind, accountId, category, note, localDate: date })
      }
      onClose(date)
    } catch (err) {
      setError('Could not save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center px-4 z-50" onClick={() => onClose()}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-paper-raised)] rounded-lg p-6 w-full max-w-sm space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg mb-2">{existing ? 'Edit' : 'New'} transaction</h2>
        {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}

        <div className="flex gap-2 text-sm">
          {['expense', 'income', 'transfer'].map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => {
                setKind(k)
                if (k !== 'transfer') {
                  const opts = k === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
                  if (!opts.includes(category)) setCategory(opts[0])
                }
              }}
              className={`flex-1 rounded py-1.5 border ${kind === k ? 'btn-primary border-transparent' : 'border-[var(--color-hairline)]'}`}
            >
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>

        <input
          type="text"
          inputMode="decimal"
          placeholder="Amount"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white tabular"
        />

        {kind !== 'transfer' && (
          <>
            <select
              value={addingCategory ? '__new__' : category}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setAddingCategory(true)
                } else {
                  setCategory(e.target.value)
                }
              }}
              className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white"
            >
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">+ Add new category</option>
            </select>

            {addingCategory && (
              <div className="flex gap-2">
                <input
                  autoFocus
                  placeholder="New category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 border border-[var(--color-hairline)] rounded px-3 py-2 bg-white"
                />
                <button type="button" onClick={handleAddCategory} className="btn-primary rounded px-3 text-sm">Add</button>
                <button
                  type="button"
                  onClick={() => { setAddingCategory(false); setNewCategoryName('') }}
                  className="border border-[var(--color-hairline)] rounded px-3 text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}

        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white">
          {accounts.map((a) => <option key={a.id} value={a.id}>{kind === 'transfer' ? `From: ${a.name}` : a.name}</option>)}
        </select>

        {kind === 'transfer' && (
          <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white">
            {accounts.map((a) => <option key={a.id} value={a.id}>{`To: ${a.name}`}</option>)}
          </select>
        )}

        <input
          type="date"
          value={date}
          max={todayLocalDate()}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white"
        />

        <input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white"
        />

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={() => onClose()} className="flex-1 border border-[var(--color-hairline)] rounded py-2">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1 rounded py-2 disabled:opacity-50">Save</button>
        </div>
      </form>
    </div>
  )
}
