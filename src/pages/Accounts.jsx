import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAccounts, useMonthTransactions } from '../hooks/useLedgerData'
import { currentMonth } from '../lib/dates'
import { getAllAccountBalances } from '../lib/ledger'
import { formatMoney } from '../lib/money'
import { addAccount, unarchiveAccount, deleteAccount, updateAccount } from '../services/accounts'

const TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'card', label: 'Card' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'loan', label: 'Loan' },
]

export function Accounts() {
  const { uid } = useOutletContext()
  const accounts = useAccounts(uid)
  const { transactions } = useMonthTransactions(uid, currentMonth())
  const balances = getAllAccountBalances(accounts, transactions)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const active = accounts.filter((a) => !a.archived)
  const archived = accounts.filter((a) => a.archived)

  async function handleDelete(account) {
    try {
      await deleteAccount(uid, account.id)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl">Accounts</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary rounded px-4 py-2 text-sm">
          + Add account
        </button>
      </div>

      {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}

      {TYPES.map((t) => {
        const group = active.filter((a) => a.type === t.value)
        if (group.length === 0) return null
        const groupTotal = group.reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0)
        return (
          <div key={t.value}>
            <div className="flex items-baseline gap-3 mb-2">
              <h2 className="text-sm text-[var(--color-ink-soft)] uppercase tracking-wide">{t.label}</h2>
              <span className={`text-xs tabular ${groupTotal >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                {formatMoney(groupTotal)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {group.map((a) => (
                <div key={a.id} className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4 flex justify-between items-start">
                  <div>
                    <p className="text-lg">{a.name}</p>
                    <p className={`tabular text-xl mt-1 ${(balances.get(a.id) ?? 0) >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                      {formatMoney(balances.get(a.id) ?? 0)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <button onClick={() => setEditing(a)} className="underline text-[var(--color-ink-soft)]">Edit</button>
                    <button onClick={() => handleDelete(a)} className="underline text-[var(--color-expense)]">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {archived.length > 0 && (
        <div>
          <h2 className="text-sm text-[var(--color-ink-soft)] mb-2">Archived</h2>
          <div className="space-y-2">
            {archived.map((a) => (
              <div key={a.id} className="flex justify-between items-center px-4 py-2 bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded opacity-60">
                <span>{a.name}</span>
                <button onClick={() => unarchiveAccount(uid, a.id)} className="text-xs underline">Restore</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && <AccountForm uid={uid} onClose={() => setShowForm(false)} />}
      {editing && <AccountForm uid={uid} existing={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function AccountForm({ uid, existing, onClose }) {
  const [name, setName] = useState(existing?.name ?? '')
  const [type, setType] = useState(existing?.type ?? 'cash')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a name.')
      return
    }
    setBusy(true)
    try {
      if (existing) {
        await updateAccount(uid, existing.id, { name: name.trim(), type })
      } else {
        await addAccount(uid, { name: name.trim(), type })
      }
      onClose()
    } catch {
      setError('Could not save the account. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center px-4 z-50" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-paper-raised)] rounded-lg p-6 w-full max-w-sm space-y-3"
      >
        <h2 className="text-lg mb-2">{existing ? 'Edit account' : 'New account'}</h2>
        {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
        <input
          autoFocus
          placeholder="Account name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white"
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white">
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-[var(--color-hairline)] rounded py-2">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1 rounded py-2 disabled:opacity-50">Save</button>
        </div>
      </form>
    </div>
  )
}
