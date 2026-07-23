import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { fetchTransactionsInRange } from '../services/transactions'
import { getCategoryBreakdown } from '../lib/ledger'
import { formatMoney } from '../lib/money'
import { monthOf, currentMonth, todayLocalDate, formatMonthLabel } from '../lib/dates'

export function Reports() {
  const { uid } = useOutletContext()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState(6)
  const [viewMode, setViewMode] = useState('range') // 'range' | 'month'
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [selectedCategory, setSelectedCategory] = useState(null)

  useEffect(() => {
    if (!uid) return
    setLoading(true)

    if (viewMode === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number)
      const from = `${selectedMonth}-01`
      const lastDay = new Date(y, m, 0).getDate() // day 0 of next month = last day of this one
      const to = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`
      fetchTransactionsInRange(uid, from, to).then((data) => {
        setTransactions(data)
        setLoading(false)
      })
      return
    }

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
  }, [uid, months, viewMode, selectedMonth])

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

  // Every month in the selected range, even ones with no spending in this
  // category, so the line doesn't just skip gaps and mislead the shape.
  function lastNMonths(n) {
    const result = []
    const now = new Date()
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return result
  }

  // Every day in a given "YYYY-MM" month, for the single-month day-by-day view.
  function daysInMonth(yyyyMm) {
    const [y, m] = yyyyMm.split('-').map(Number)
    const count = new Date(y, m, 0).getDate()
    return Array.from({ length: count }, (_, i) => `${yyyyMm}-${String(i + 1).padStart(2, '0')}`)
  }

  const categoryTrend = selectedCategory
    ? (() => {
        if (viewMode === 'month') {
          const sums = {}
          for (const t of transactions) {
            if (t.type !== 'expense' || t.category !== selectedCategory) continue
            sums[t.localDate] = (sums[t.localDate] ?? 0) + t.amount / 100
          }
          return daysInMonth(selectedMonth).map((d) => ({ label: d.slice(8), amount: sums[d] ?? 0 }))
        }
        const sums = {}
        for (const t of transactions) {
          if (t.type !== 'expense' || t.category !== selectedCategory) continue
          const m = monthOf(t.localDate)
          sums[m] = (sums[m] ?? 0) + t.amount / 100
        }
        return lastNMonths(months).map((m) => ({ label: m, amount: sums[m] ?? 0 }))
      })()
    : []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl">Reports</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex text-xs border border-[var(--color-hairline)] rounded overflow-hidden">
            <button
              onClick={() => setViewMode('range')}
              className={`px-3 py-1.5 ${viewMode === 'range' ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'bg-white'}`}
            >
              Range
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 ${viewMode === 'month' ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'bg-white'}`}
            >
              Single month
            </button>
          </div>

          {viewMode === 'range' ? (
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="border border-[var(--color-hairline)] rounded px-2 py-1 text-sm bg-white">
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          ) : (
            <input
              type="month"
              value={selectedMonth}
              max={currentMonth()}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-[var(--color-hairline)] rounded px-2 py-1 text-sm bg-white"
            />
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>}

      {!loading && (
        <>
          <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4">
            <h2 className="text-sm text-[var(--color-ink-soft)] mb-3">
              {viewMode === 'month' ? `Income vs. expense — ${formatMonthLabel(selectedMonth)}` : 'Income vs. expense by month'}
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trend} margin={{ top: 20 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Bar dataKey="income" fill="var(--color-income)">
                  <LabelList dataKey="income" position="top" formatter={(v) => formatMoney(v * 100, { withSymbol: false })} style={{ fontSize: 11, fill: 'var(--color-income)' }} />
                </Bar>
                <Bar dataKey="expense" fill="var(--color-expense)">
                  <LabelList dataKey="expense" position="top" formatter={(v) => formatMoney(v * 100, { withSymbol: false })} style={{ fontSize: 11, fill: 'var(--color-expense)' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h2 className="text-sm text-[var(--color-ink-soft)] mb-2">Top categories</h2>
            <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg divide-y divide-[var(--color-hairline)]">
              {breakdown.slice(0, 10).map((b) => (
                <button
                  key={b.category}
                  onClick={() => setSelectedCategory(selectedCategory === b.category ? null : b.category)}
                  className={`w-full flex justify-between px-4 py-2 text-sm text-left ${selectedCategory === b.category ? 'bg-[var(--color-hairline)]/40' : ''}`}
                >
                  <span>{b.category}</span>
                  <span className="tabular">{formatMoney(b.amount)}</span>
                </button>
              ))}
              {breakdown.length === 0 && <p className="p-4 text-sm text-[var(--color-ink-soft)]">No spending in this period.</p>}
            </div>
          </div>

          {selectedCategory && (
            <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm text-[var(--color-ink-soft)]">
                  {selectedCategory} — {viewMode === 'month' ? `daily trend, ${formatMonthLabel(selectedMonth)}` : 'monthly trend'}
                </h2>
                <button onClick={() => setSelectedCategory(null)} className="text-xs underline text-[var(--color-ink-soft)]">Close</button>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={categoryTrend}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatMoney(v * 100)} />
                  <Line type="monotone" dataKey="amount" stroke="var(--color-expense)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
