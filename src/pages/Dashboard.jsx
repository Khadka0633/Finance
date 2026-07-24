import { useState } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, LabelList } from 'recharts'
import { useAccounts, useMonthTransactions } from '../hooks/useLedgerData'
import { currentMonth, formatMonthLabel } from '../lib/dates'
import { getTotalBalance, getIncomeExpenseTotals, getCategoryBreakdown, getAllAccountBalances } from '../lib/ledger'
import { formatMoney } from '../lib/money'

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

/** Compact number formatting for chart labels: 1500 -> "1.5k", 120 -> "120" */
function formatCompactAmount(value) {
  const abs = Math.abs(value)
  if (abs >= 1000) {
    let s = (value / 1000).toFixed(1)
    if (s.endsWith('.0')) s = s.slice(0, -2)
    return `${s}k`
  }
  return `${Math.round(value)}`
}

function renderBalanceLabel(props, domainMin, domainMax) {
  const { x, width, value } = props
  const range = domainMax - domainMin
  if (range <= 0) return null
  const plotAreaHeight = BALANCE_CHART_HEIGHT - BALANCE_MARGIN_TOP - BALANCE_MARGIN_BOTTOM - BALANCE_XAXIS_HEIGHT
  const topY = BALANCE_MARGIN_TOP
  const bottomY = BALANCE_MARGIN_TOP + plotAreaHeight
  const cx = x + width / 2
  const labelY = value < 0 ? bottomY - 6 : topY + 12
  return (
    <text x={cx} y={labelY} textAnchor="middle" fontSize={10} fill="var(--color-ink)">
      {formatCompactAmount(value)}
    </text>
  )
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
  const month = currentMonth()
  const accounts = useAccounts(uid)
  const { transactions, loading } = useMonthTransactions(uid, month)

  const totalBalance = getTotalBalance(accounts, transactions)
  const { income, expense } = getIncomeExpenseTotals(transactions)
  const breakdown = getCategoryBreakdown(transactions, 'expense')
  const incomeBreakdown = getCategoryBreakdown(transactions, 'income')
  const activeBreakdown = pieView === 'income' ? incomeBreakdown : breakdown
  const accountBalances = getAllAccountBalances(accounts, transactions)

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
        <h1 className="text-2xl mb-1">{formatMonthLabel(month)}</h1>
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
        <SummaryCard label="This Month's Income" value={income} tone="income" />
        <SummaryCard label="This Month's Expenses" value={expense} tone="expense" />
      </div>

      {!loading && (breakdown.length > 0 || incomeBreakdown.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm text-[var(--color-ink-soft)]">
                {pieView === 'income' ? 'Income by category' : 'Spending by category'}
              </h2>
              <div className="flex text-xs rounded-md border border-[var(--color-hairline)] overflow-hidden">
                <button
                  onClick={() => setPieView('expense')}
                  className={`px-2.5 py-1 ${pieView === 'expense' ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : ''}`}
                >
                  Expense
                </button>
                <button
                  onClick={() => setPieView('income')}
                  className={`px-2.5 py-1 ${pieView === 'income' ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : ''}`}
                >
                  Income
                </button>
              </div>
            </div>
            {activeBreakdown.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)] py-16 text-center">
                No {pieView === 'income' ? 'income' : 'spending'} this month.
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
        </div>
      )}

      <div>
        <h2 className="text-sm text-[var(--color-ink-soft)] mb-2">Recent transactions</h2>
        <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg divide-y divide-[var(--color-hairline)]">
          {recent.length === 0 && (
            <div className="flex flex-col items-center text-center px-6 py-10">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-soft)" strokeWidth="1.5" className="mb-3">
                <path d="M6 2h9l3 3v17l-3-2-2 2-2-2-2 2-2-2-1 2V2Z" />
                <path d="M8 8h8M8 12h8M8 16h5" />
              </svg>
              <p className="text-sm mb-1">No transactions this month</p>
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

function SummaryCard({ label, value, tone }) {
  const color =
    tone === 'income' ? 'text-[var(--color-income)]' : tone === 'expense' ? 'text-[var(--color-expense)]' : 'text-[var(--color-ink)]'
  return (
    <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4">
      <p className="text-xs text-[var(--color-ink-soft)] mb-1">{label}</p>
      <p className={`figure text-2xl tabular ${color}`}>{formatMoney(value)}</p>
    </div>
  )
}
