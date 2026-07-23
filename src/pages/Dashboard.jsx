import { useOutletContext, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { useAccounts, useMonthTransactions } from '../hooks/useLedgerData'
import { currentMonth, formatMonthLabel } from '../lib/dates'
import { getTotalBalance, getIncomeExpenseTotals, getCategoryBreakdown, getAllAccountBalances } from '../lib/ledger'
import { formatMoney } from '../lib/money'

const COLORS = ['#A64B2A', '#C79A3B', '#2E5339', '#4A5A70', '#1B2A41', '#8C8F86']
const RADIAN = Math.PI / 180
const MIN_LABEL_PERCENT = 0.05 // hide leader-line labels for slices under 5% of total

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
  const month = currentMonth()
  const accounts = useAccounts(uid)
  const { transactions, loading } = useMonthTransactions(uid, month)

  const totalBalance = getTotalBalance(accounts, transactions)
  const { income, expense } = getIncomeExpenseTotals(transactions)
  const breakdown = getCategoryBreakdown(transactions)
  const accountBalances = getAllAccountBalances(accounts, transactions)

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

      {!loading && breakdown.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4">
            <h2 className="text-sm text-[var(--color-ink-soft)] mb-3">Spending by category</h2>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={breakdown}
                  dataKey="amount"
                  nameKey="category"
                  innerRadius={50}
                  outerRadius={75}
                  label={renderCategoryLabel}
                  labelLine={renderCategoryLabelLine}
                >
                  {breakdown.map((entry, i) => (
                    <Cell key={entry.category} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4">
            <h2 className="text-sm text-[var(--color-ink-soft)] mb-3">Account balances</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={accounts.map((a) => ({
                  name: shortAccountName(a.name),
                  fullName: a.name,
                  balance: (accountBalances.get(a.id) ?? 0) / 100,
                }))}
                margin={{ bottom: 20 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatMoney(v * 100)} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''} />
                <Bar dataKey="balance" fill="var(--color-ink)" />
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
