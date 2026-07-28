import { useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [accountFilter, setAccountFilter] = useState(searchParams.get('account') ?? 'all')
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState(null)

  function updateAccountFilter(value) {
    setAccountFilter(value)
    setSearchParams(value === 'all' ? {} : { account: value })
  }

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
        if (accountFilter !== 'all' && out?.accountId !== accountFilter && inn?.accountId !== accountFilter) continue
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

  // Group into day buckets (displayRows is already sorted newest-first,
  // so same-date rows land next to each other without re-sorting).
  const dayGroups = useMemo(() => {
    const groups = []
    let current = null
    for (const row of displayRows) {
      if (!current || current.date !== row.localDate) {
        current = { date: row.localDate, rows: [], income: 0, expense: 0 }
        groups.push(current)
      }
      current.rows.push(row)
      if (row.isTransfer) {
        // Transfers don't change the app-wide total, but from a single
        // account's point of view money is genuinely leaving/entering it.
        if (accountFilter !== 'all') {
          if (row.fromAccountId === accountFilter) current.expense += row.amount
          if (row.toAccountId === accountFilter) current.income += row.amount
        }
      } else {
        if (row.type === 'income') current.income += row.amount
        if (row.type === 'expense') current.expense += row.amount
      }
    }
    return groups
  }, [displayRows, accountFilter])

  const monthTotals = useMemo(() => {
    const totals = dayGroups.reduce((acc, g) => ({ income: acc.income + g.income, expense: acc.expense + g.expense }), { income: 0, expense: 0 })
    return { ...totals, net: totals.income - totals.expense }
  }, [dayGroups])

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
      <div>
        <h1 className="text-2xl">Transactions</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">{formatMonthLabel(month)}</p>
        <div className="flex gap-3 text-xs tabular mt-1">
          <span className="text-[var(--color-income)]">+{formatMoney(monthTotals.income, { withSymbol: false })}</span>
          <span className="text-[var(--color-expense)]">-{formatMoney(monthTotals.expense, { withSymbol: false })}</span>
          <span className={monthTotals.net >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}>
            Net {monthTotals.net >= 0 ? '+' : ''}{formatMoney(monthTotals.net, { withSymbol: false })}
          </span>
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-[var(--color-hairline)] rounded px-2 py-1 text-sm bg-white"
        />
        <select value={accountFilter} onChange={(e) => updateAccountFilter(e.target.value)} className="border border-[var(--color-hairline)] rounded px-2 py-1 text-sm bg-white">
          <option value="all">All accounts</option>
          {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="space-y-4">
        {dayGroups.length === 0 && (
          <p className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4 text-sm text-[var(--color-ink-soft)]">
            No transactions for this period.
          </p>
        )}
        {dayGroups.map((group) => (
          <div key={group.date}>
            <div className="flex justify-between items-baseline px-1 mb-1.5">
              <h3 className="text-sm text-[var(--color-ink-soft)]">{formatDateLabel(group.date)}</h3>
              <div className="flex gap-3 text-xs tabular">
                {group.income > 0 && <span className="text-[var(--color-income)]">+{formatMoney(group.income, { withSymbol: false })}</span>}
                {group.expense > 0 && <span className="text-[var(--color-expense)]">-{formatMoney(group.expense, { withSymbol: false })}</span>}
              </div>
            </div>
            <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg divide-y divide-[var(--color-hairline)]">
              {group.rows.map((row) => (
                <div key={row.id} className="flex justify-between items-center px-4 py-3 group">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {row.isTransfer
                        ? `Transfer: ${row.fromName} → ${row.toName}`
                        : (row.category || (row.type === 'income' ? 'Income' : 'Expense'))}
                      {!row.isTransfer && accountFilter === 'all' && (
                        <span className="text-[var(--color-ink-soft)] font-normal">
                          {' · '}{accounts.find((a) => a.id === row.accountId)?.name ?? '—'}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--color-ink-soft)] truncate">
                      {row.note || '\u00A0'}
                      {row._pending && ' · pending sync'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`tabular text-sm ${row.isTransfer ? 'text-[var(--color-ink)]' : row.type === 'income' ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
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
          </div>
        ))}
      </div>

      <button
        onClick={() => { setEditing(null); setShowForm(true) }}
        aria-label="Add transaction"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full btn-primary text-2xl leading-none shadow-lg flex items-center justify-center"
      >
        +
      </button>

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
