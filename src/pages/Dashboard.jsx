import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useAccounts, useMonthTransactions, useAllTransactions } from '../hooks/useLedgerData'
import { fetchTransactionsInRange } from '../services/transactions'
import { currentMonth, formatMonthLabel, formatMonthShort, shiftMonth } from '../lib/dates'
import { getTotalBalance, getIncomeExpenseTotals, getCategoryBreakdown, getAllAccountBalances } from '../lib/ledger'
import { formatMoney, formatCompactAmount } from '../lib/money'

const COLORS = ['#A64B2A', '#C79A3B', '#2E5339', '#4A5A70', '#1B2A41', '#8C8F86']
const RADIAN = Math.PI / 180
const MIN_LABEL_PERCENT = 0.05 // hide leader-line labels for slices under 5% of total

/** Date range covered by a given anchor month + granularity */
function periodRange(anchorMonth, granularity) {
  const [y, m] = anchorMonth.split('-').map(Number)
  const lastDayOfAnchor = new Date(y, m, 0).getDate()
  if (granularity === 'year') {
    const year = anchorMonth.slice(0, 4)
    return { from: `${year}-01-01`, to: `${year}-12-31` }
  }
  if (granularity === '6m') {
    const start = shiftMonth(anchorMonth, -5)
    return { from: `${start}-01`, to: `${anchorMonth}-${String(lastDayOfAnchor).padStart(2, '0')}` }
  }
  return { from: `${anchorMonth}-01`, to: `${anchorMonth}-${String(lastDayOfAnchor).padStart(2, '0')}` }
}

/** Display label for the currently selected period */
function periodLabel(anchorMonth, granularity) {
  if (granularity === 'year') return anchorMonth.slice(0, 4)
  if (granularity === '6m') return `${formatMonthShort(shiftMonth(anchorMonth, -5))} – ${formatMonthLabel(anchorMonth)}`
  return formatMonthLabel(anchorMonth)
}

function renderCategoryLabel({ cx, cy, midAngle, outerRadius, percent, name }) {
  if (percent < MIN_LABEL_PERCENT) return null
  const x = cx + (outerRadius + 20) * Math.cos(-midAngle * RADIAN)
  const y = cy + (outerRadius + 20) * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="var(--color-ink-soft)" fontSize={11} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {name} ({Math.round(percent * 100)}%)
    </text>
  )
}

function renderCategoryLabelLine({ cx, cy, midAngle, outerRadius, percent }) {
  if (percent < MIN_LABEL_PERCENT) return null
  const x1 = cx + outerRadius * Math.cos(-midAngle * RADIAN)
  const y1 = cy + outerRadius * Math.sin(-midAngle * RADIAN)
  const x2 = cx + (outerRadius + 14) * Math.cos(-midAngle * RADIAN)
  const y2 = cy + (outerRadius + 14) * Math.sin(-midAngle * RADIAN)
  return <path d={`M${x1},${y1}L${x2},${y2}`} stroke="var(--color-ink-soft)" fill="none" />
}

export function Dashboard() {
  const { uid } = useOutletContext()
  const [pieView, setPieView] = useState('expense')
  const [granularity, setGranularity] = useState('month') // 'month' | '6m' | 'year'
  const [anchorMonth, setAnchorMonth] = useState(currentMonth())
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const accounts = useAccounts(uid)

  const { transactions: monthTransactions, loading: monthLoading } = useMonthTransactions(uid, anchorMonth)
  const [rangeTransactions, setRangeTransactions] = useState([])
  const [rangeLoading, setRangeLoading] = useState(true)
  useEffect(() => {
    if (granularity === 'month' || !uid) return
    let cancelled = false
    setRangeLoading(true)
    const { from, to } = periodRange(anchorMonth, granularity)
    fetchTransactionsInRange(uid, from, to).then((data) => {
      if (!cancelled) {
        setRangeTransactions(data)
        setRangeLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [uid, anchorMonth, granularity])

  const transactions = granularity === 'month' ? monthTransactions : rangeTransactions
  const loading = granularity === 'month' ? monthLoading : rangeLoading

  const { transactions: allTransactions } = useAllTransactions(uid)

  function stepPeriod(direction) {
    const unit = granularity === 'year' ? 12 : granularity === '6m' ? 6 : 1
    setAnchorMonth((prev) => shiftMonth(prev, direction * unit))
  }

  const totalBalance = getTotalBalance(accounts, allTransactions)
  const { income, expense } = getIncomeExpenseTotals(allTransactions)
  const breakdown = getCategoryBreakdown(transactions, 'expense')
  const incomeBreakdown = getCategoryBreakdown(transactions, 'income')
  const activeBreakdown = pieView === 'income' ? incomeBreakdown : breakdown
  const periodTotals = getIncomeExpenseTotals(transactions)
  const periodActiveAmount = pieView === 'income' ? periodTotals.income : periodTotals.expense
  const accountBalances = getAllAccountBalances(accounts, allTransactions)

  // Sorted highest to lowest so the eye reads "who's up, who's down" at a
  // glance. Kept in raw cents (not divided) so formatMoney below matches
  // every other currency display in the app, decimals included.
  const balanceListData = accounts
    .map((a) => ({ name: a.name, cents: accountBalances.get(a.id) ?? 0 }))
    .sort((a, b) => b.cents - a.cents)
  const maxAbsBalanceCents = Math.max(1, ...balanceListData.map((d) => Math.abs(d.cents)))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl mb-1">{periodLabel(anchorMonth, granularity)}</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">Dashboard</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr] gap-4">
        <div className="col-span-2 sm:col-span-1 bg-[var(--color-ink)] rounded-lg p-6">
          <p className="text-xs text-[#B7C0CC] mb-2">Total balance</p>
          <p className="figure tabular text-4xl text-[var(--color-paper)]">{formatMoney(totalBalance)}</p>
          <div className="mt-3 h-0.5 w-16 bg-[var(--color-budget)]" />
          <p className="text-[11px] text-[#8592A3] mt-3">
            Across {accounts.length} account{accounts.length === 1 ? '' : 's'}
          </p>
        </div>
        <SummaryCard label="Income" sublabel="All time" value={income} tone="income" />
        <SummaryCard label="Expenses" sublabel="All time" value={expense} tone="expense" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4 flex flex-col">
          <div className="flex justify-between items-center gap-2 sm:mb-3 flex-nowrap">
            <div className="flex text-xs rounded-md border border-[var(--color-hairline)] overflow-hidden shrink-0">
              <button
                onClick={() => setPieView('expense')}
                className={`px-2 py-1 ${pieView === 'expense' ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : ''}`}
              >
                Expense
              </button>
              <button
                onClick={() => setPieView('income')}
                className={`px-2 py-1 ${pieView === 'income' ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : ''}`}
              >
                Income
              </button>
            </div>
            <p className={`hidden sm:block flex-1 text-center text-sm font-medium tabular truncate px-1 ${pieView === 'income' ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
              {formatMoney(periodActiveAmount)}
            </p>
            <div className="relative shrink-0">
              <div className="flex items-center border border-[var(--color-hairline)] rounded bg-white text-xs">
                <button
                  type="button"
                  onClick={() => stepPeriod(-1)}
                  aria-label="Previous period"
                  className="px-4 py-2.5 text-base leading-none hover:bg-[var(--color-paper-raised)]"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setShowPeriodMenu((v) => !v)}
                  className="px-1.5 py-1 min-w-[92px] text-center border-x border-[var(--color-hairline)] whitespace-nowrap"
                >
                  {periodLabel(anchorMonth, granularity)}
                </button>
                <button
                  type="button"
                  onClick={() => stepPeriod(1)}
                  aria-label="Next period"
                  className="px-4 py-2.5 text-base leading-none hover:bg-[var(--color-paper-raised)]"
                >
                  ›
                </button>
              </div>
              {showPeriodMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowPeriodMenu(false)} />
                  <div className="absolute z-20 top-full right-0 mt-1 bg-white border border-[var(--color-hairline)] rounded shadow-md text-xs overflow-hidden min-w-[110px]">
                    {[
                      { key: 'month', label: 'Monthly' },
                      { key: '6m', label: '6 month' },
                      { key: 'year', label: 'Annually' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setGranularity(opt.key)
                          setShowPeriodMenu(false)
                        }}
                        className={`block w-full text-left px-3 py-1.5 hover:bg-[var(--color-paper-raised)] ${
                          granularity === opt.key ? 'bg-[var(--color-paper-raised)] font-medium' : ''
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <p className={`sm:hidden text-sm font-medium tabular mb-3 mt-1 ${pieView === 'income' ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
            Rs. {formatCompactAmount(periodActiveAmount / 100)}
          </p>
          <div className="flex-1 flex flex-col justify-center">
            {loading ? (
              <p className="text-sm text-[var(--color-ink-soft)] text-center">Loading…</p>
            ) : activeBreakdown.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)] text-center">
                No {pieView === 'income' ? 'income' : 'spending'} in this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={activeBreakdown}
                    dataKey="amount"
                    nameKey="category"
                    innerRadius={50}
                    outerRadius={75}
                    label={renderCategoryLabel}
                    labelLine={renderCategoryLabelLine}
                  >
                    {activeBreakdown.map((entry, i) => (
                      <Cell key={entry.category} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {balanceListData.length > 0 && (
          <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4">
            <h2 className="text-sm text-[var(--color-ink-soft)] mb-3">Account balances</h2>
            <div className="divide-y divide-[var(--color-hairline)]">
              {balanceListData.map((d) => {
                const pct = Math.round((Math.abs(d.cents) / maxAbsBalanceCents) * 100)
                const isNegative = d.cents < 0
                return (
                  <div key={d.name} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-24 shrink-0 truncate text-[var(--color-ink-soft)]">{d.name}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-[var(--color-hairline)]/30">
                      <div
                        className={`h-full rounded-full ${isNegative ? 'bg-[var(--color-expense)]' : 'bg-[var(--color-income)]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-right tabular whitespace-nowrap">
                      Rs. {isNegative ? '-' : ''}{formatCompactAmount(Math.abs(d.cents) / 100)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, sublabel, value, tone }) {
  const color =
    tone === 'income' ? 'text-[var(--color-income)]' : tone === 'expense' ? 'text-[var(--color-expense)]' : 'text-[var(--color-ink)]'
  return (
    <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4">
      <div className="flex justify-between items-baseline mb-1">
        <p className="text-xs text-[var(--color-ink-soft)]">{label}</p>
        {sublabel && <p className="text-[10px] text-[var(--color-ink-soft)]">{sublabel}</p>}
      </div>
      <p className={`figure text-sm sm:text-2xl tabular whitespace-nowrap ${color}`}>{formatMoney(value)}</p>
    </div>
  )
}
