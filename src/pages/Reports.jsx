import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchTransactionsInRange } from '../services/transactions'
import { getCategoryBreakdown } from '../lib/ledger'
import { formatMoney } from '../lib/money'
import { monthOf, todayLocalDate } from '../lib/dates'

export function Reports() {
  const { uid } = useOutletContext()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState(6)

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    const to = todayLocalDate()
    const fromDate = new Date()
    fromDate.setMonth(fromDate.getMonth() - months)
    const from = fromDate.toISOString().slice(0, 10)
    // Reports covers a long range — a one-time fetch avoids paying for a
    // live listener across potentially years of history.
    fetchTransactionsInRange(uid, from, to).then((data) => {
      setTransactions(data)
      setLoading(false)
    })
  }, [uid, months])

  const breakdown = getCategoryBreakdown(transactions)

  const trend = Object.values(
    transactions.reduce((acc, t) => {
      const m = monthOf(t.localDate)
      if (!acc[m]) acc[m] = { month: m, income: 0, expense: 0 }
      if (t.type === 'income') acc[m].income += t.amount / 100
      if (t.type === 'expense') acc[m].expense += t.amount / 100
      return acc
    }, {})
  ).sort((a, b) => (a.month < b.month ? -1 : 1))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl">Reports</h1>
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="border border-[var(--color-hairline)] rounded px-2 py-1 text-sm bg-white">
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </select>
      </div>

      {loading && <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>}

      {!loading && (
        <>
          <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4">
            <h2 className="text-sm text-[var(--color-ink-soft)] mb-3">Income vs. expense by month</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trend}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatMoney(v * 100)} />
                <Bar dataKey="income" fill="var(--color-income)" />
                <Bar dataKey="expense" fill="var(--color-expense)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h2 className="text-sm text-[var(--color-ink-soft)] mb-2">Top categories</h2>
            <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg divide-y divide-[var(--color-hairline)]">
              {breakdown.slice(0, 10).map((b) => (
                <div key={b.category} className="flex justify-between px-4 py-2 text-sm">
                  <span>{b.category}</span>
                  <span className="tabular">{formatMoney(b.amount)}</span>
                </div>
              ))}
              {breakdown.length === 0 && <p className="p-4 text-sm text-[var(--color-ink-soft)]">No spending in this period.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
