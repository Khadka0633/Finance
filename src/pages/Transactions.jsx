import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAccounts, useMonthTransactions } from '../hooks/useLedgerData'
import { currentMonth, formatDateLabel, formatMonthLabel, monthOf } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { deleteTransaction, restoreTransaction } from '../services/transactions'
import { deleteTransfer, restoreTransfer } from '../services/transfers'
import { TransactionForm } from '../components/TransactionForm'

export function Transactions() {
  const { uid } = useOutletContext()
  const [month, setMonth] = useState(currentMonth())
  const accounts = useAccounts(uid)
  const { transactions } = useMonthTransactions(uid, month)
  const [accountFilter, setAccountFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState(null)

  const activeAccounts = accounts.filter((a) => !a.archived)

  // Collapse transfer pairs into one row for display
  const displayRows = useMemo(() => {
    const seen = new Set()
    const rows = []
    for (const t of transactions) {
      if (t.type === 'transfer_out' || t.type === 'transfer_in') {
        if (seen.has(t.transferId)) continue
        seen.add(t.transferId)
        const other = transactions.find((x) => x.transferId === t.transferId && x.id !== t.id)
        const out = t.type === 'transfer_out' ? t : other
        const inn = t.type === 'transfer_in' ? t : other
        rows.push({
          id: t.transferId,
          isTransfer: true,
          transferId: t.transferId,
          amount: t.amount,
          localDate: t.localDate,
          note: t.note,
          fromAccountId: out?.accountId,
          toAccountId: inn?.accountId,
          fromName: accounts.find((a) => a.id === out?.accountId)?.name ?? '—',
          toName: accounts.find((a) => a.id === inn?.accountId)?.name ?? '—',
        })
      } else if (accountFilter === 'all' || t.accountId === accountFilter) {
        rows.push({ ...t, isTransfer: false })
      }
    }
    return rows.sort((a, b) => (a.localDate < b.localDate ? 1 : -1))
  }, [transactions, accounts, accountFilter])

  async function handleDelete(row) {
    if (row.isTransfer) {
      const deleted = await deleteTransfer(uid, row.transferId)
      setToast({ message: 'Transfer deleted', undo: () => restoreTransfer(uid, deleted) })
    } else {
      const deleted = await deleteTransaction(uid, row.id)
      setToast({ message: 'Transaction deleted', undo: () => restoreTransaction(uid, deleted) })
    }
    setTimeout(() => setToast(null), 5000)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl">Transactions</h1>
          <p className="text-sm text-[var(--color-ink-soft)]">{formatMonthLabel(month)}</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn-primary rounded px-4 py-2 text-sm">
          + Add
        </button>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-[var(--color-hairline)] rounded px-2 py-1 text-sm bg-white"
        />
        <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="border border-[var(--color-hairline)] rounded px-2 py-1 text-sm bg-white">
          <option value="all">All accounts</option>
          {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg divide-y divide-[var(--color-hairline)]">
        {displayRows.length === 0 && (
          <p className="p-4 text-sm text-[var(--color-ink-soft)]">No transactions for this period.</p>
        )}
        {displayRows.map((row) => (
          <div key={row.id} className="flex justify-between items-center px-4 py-3 group">
            <div className="min-w-0">
              <p className="text-sm">
                {row.isTransfer ? `Transfer: ${row.fromName} → ${row.toName}` : (row.category || (row.type === 'income' ? 'Income' : 'Expense'))}
              </p>
              <p className="text-xs text-[var(--color-ink-soft)] truncate">
                {formatDateLabel(row.localDate)}{row.note ? ` · ${row.note}` : ''}
                {row._pending && ' · pending sync'}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`tabular text-sm ${row.isTransfer ? 'text-[var(--color-budget)]' : row.type === 'income' ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                {row.isTransfer ? '' : row.type === 'income' ? '+' : '-'}{formatMoney(row.amount, { withSymbol: false })}
              </span>
              <div className="flex gap-2 text-xs sm:hidden sm:group-hover:flex">
                <button
                  onClick={() => {
                    setEditing(
                      row.isTransfer
                        ? { ...row, type: 'transfer_out', transferId: row.transferId, accountId: row.fromAccountId, linkedAccountId: row.toAccountId }
                        : row
                    )
                    setShowForm(true)
                  }}
                  className="underline"
                >
                  Edit
                </button>
                <button onClick={() => handleDelete(row)} className="underline text-[var(--color-expense)]">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <TransactionForm
          uid={uid}
          accounts={activeAccounts}
          existing={editing}
          onClose={(savedDate) => {
            setShowForm(false)
            if (savedDate && monthOf(savedDate) !== month) {
              setMonth(monthOf(savedDate))
            }
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[var(--color-ink)] text-[var(--color-paper)] rounded px-4 py-2 text-sm flex items-center gap-3 z-50">
          <span>{toast.message}</span>
          <button
            onClick={() => { toast.undo(); setToast(null) }}
            className="underline font-medium"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
