import { useEffect, useState } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, LabelList } from 'recharts'
import { useAccounts, useMonthTransactions, useAllTransactions } from '../hooks/useLedgerData'
import { fetchTransactionsInRange } from '../services/transactions'
import { currentMonth, formatMonthLabel, formatMonthShort, shiftMonth } from '../lib/dates'
import { getTotalBalance, getIncomeExpenseTotals, getCategoryBreakdown, getAllAccountBalances } from '../lib/ledger'
import { formatMoney, formatCompactAmount } from '../lib/money'

const COLORS = ['#A64B2A', '#C79A3B', '#2E5339', '#4A5A70', '#1B2A41', '#8C8F86']
const RADIAN = Math.PI / 180
const MIN_LABEL_PERCENT = 0.05 // hide leader-line labels for slices under 5% of total

// Geometry for the account-balances bar chart, shared between the JSX props
// and the label-positioning math below so they can't drift out of sync.
const BALANCE_CHART_HEIGHT = 300
const BALANCE_MARGIN_TOP = 24
const BALANCE_MARGIN_BOTTOM = 20
const BALANCE_XAXIS_HEIGHT = 60

/** Rounds a positive number up to a "nice" axis bound (1/2/5/10 × 10^n) */
function niceCeil(n) {
  if (n <= 0) return 0
  const exp = Math.floor(Math.log10(n))
  const base = 10 ** exp
  const norm = n / base
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return niceNorm * base
}

function renderBalanceLabel(props, domainMin, domainMax) {
  const { x, width, value } = props
  const range = domainMax - domainMin
  if (range <= 0) return null
  const plotAreaHeight = BALANCE_CHART_HEIGHT - BALANCE_MARGIN_TOP - BALANCE_MARGIN_BOTTOM - BALANCE_XAXIS_HEIGHT
  const topY = BALANCE_MARGIN_TOP
  // Pixel y-coordinate of the value-0 gridline, computed directly from the
  // domain rather than trusting the bar's own y/height (which tracks the
  // bottom of a large negative bar, not its top, and would otherwise drift
  // the label down toward the x-axis for big negative values).
  const zeroY = topY + (domainMax / range) * plotAreaHeight
  const cx = x + width / 2
  // Positive labels stay pinned to a fixed row near the top so they line up
  // across bars. Negative labels sit just below the zero line — the top
  // edge of every negative bar — in red, overlapping into the bar so it's
  // obvious which bar they belong to no matter how tall that bar is.
  const labelY = value < 0 ? zeroY + 12 : topY + 12
  return (
    <text
      x={cx}
      y={labelY}
      textAnchor="middle"
      fontSize={10}
      fill={value < 0 ? 'var(--color-expense)' : 'var(--color-ink)'}
    >
      {formatCompactAmount(value)}
    </text>
  )
}

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

function shortAccountName(name) {
  if (!name) return ''
  return name.length > 9 ? `${name.slice(0, 8)}…` : name
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

  const balanceChartData = accounts.map((a) => ({
    name: shortAccountName(a.name),
    fullName: a.name,
    balance: (accountBalances.get(a.id) ?? 0) / 100,
  }))
  const chartBalanceValues = balanceChartData.map((d) => d.balance)
  const maxBalance = Math.max(0, ...chartBalanceValues)
  const minBalance = Math.min(0, ...chartBalanceValues)
  const hasBalanceRange = maxBalance > 0 || minBalance < 0
  const balanceDomainMax = hasBalanceRange ? niceCeil(maxBalance) : 100
  const balanceDomainMin = hasBalanceRange ? -niceCeil(-minBalance) : -100

  const recent = [...transactions]
    .filter((t) => t.type === 'income' || t.type === 'expense')
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl mb-1">{periodLabel(anchorMonth, granularity)}</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">Dashboard</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-4">
        <div className="bg-[var(--color-ink)] rounded-lg p-6">
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
        <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4">
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
          {loading ? (
            <p className="text-sm text-[var(--color-ink-soft)] py-16 text-center">Loading…</p>
          ) : activeBreakdown.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-soft)] py-16 text-center">
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

        {balanceChartData.length > 0 && (
          <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4">
            <h2 className="text-sm text-[var(--color-ink-soft)] mb-3">Account balances</h2>
            <ResponsiveContainer width="100%" height={BALANCE_CHART_HEIGHT}>
              <BarChart
                data={balanceChartData}
                margin={{ top: BALANCE_MARGIN_TOP, bottom: BALANCE_MARGIN_BOTTOM }}
                accessibilityLayer={false}
              >
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={BALANCE_XAXIS_HEIGHT} />
                <YAxis tick={{ fontSize: 12 }} domain={[balanceDomainMin, balanceDomainMax]} />
                <Bar dataKey="balance" fill="var(--color-ink)">
                  <LabelList dataKey="balance" content={(p) => renderBalanceLabel(p, balanceDomainMin, balanceDomainMax)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm text-[var(--color-ink-soft)] mb-2">Recent transactions</h2>
        <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg divide-y divide-[var(--color-hairline)]">
          {recent.length === 0 && (
            <div className="flex flex-col items-center text-center px-6 py-10">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-soft)" strokeWidth="1.5" className="mb-3">
                <path d="M6 2h9l3 3v17l-3-2-2 2-2-2-2 2-2-2-1 2V2Z" />
                <path d="M8 8h8M8 12h8M8 16h5" />
              </svg>
              <p className="text-sm mb-1">No transactions in this period</p>
              <p className="text-sm text-[var(--color-ink-soft)] mb-4">Add your first entry to see it here.</p>
              <Link to="/transactions" className="btn-primary text-sm px-4 py-2 rounded-md">
                + Add transaction
              </Link>
            </div>
          )}
          {recent.map((t) => (
            <div key={t.id} className="flex justify-between items-center px-4 py-3">
              <div>
                <p className="text-sm">{t.category || (t.type === 'income' ? 'Income' : 'Expense')}</p>
                <p className="text-xs text-[var(--color-ink-soft)]">{t.note}</p>
              </div>
              <span className={`tabular text-sm ${t.type === 'income' ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount, { withSymbol: false })}
              </span>
            </div>
          ))}
        </div>
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
      <p className={`figure text-2xl tabular ${color}`}>{formatMoney(value)}</p>
    </div>
  )
}
