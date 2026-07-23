import { fetchTransactionsInRange } from '../services/transactions'

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function toCsv(transactions) {
  const header = ['date', 'type', 'category', 'accountId', 'amount', 'amount_cents', 'note']
  const rows = transactions.map((t) =>
    [t.localDate, t.type, t.category ?? '', t.accountId, (t.amount / 100).toFixed(2), t.amount, (t.note ?? '').replace(/,/g, ';')].join(',')
  )
  return [header.join(','), ...rows].join('\n')
}

export async function exportAllData(uid, format = 'csv') {
  // Firestore's free tier has no automatic backups — this gives the user
  // an on-demand personal backup, and doubles as data portability.
  const transactions = await fetchTransactionsInRange(uid, '0000-01-01', '9999-12-31')
  const stamp = new Date().toISOString().slice(0, 10)
  if (format === 'csv') {
    downloadFile(`ledger-export-${stamp}.csv`, toCsv(transactions), 'text/csv')
  } else {
    // Keep amount_cents as the source of truth (avoids floating-point
    // rounding), but add a plain decimal amount for readability.
    const withDecimal = transactions.map((t) => ({ ...t, amount_cents: t.amount, amount: t.amount / 100 }))
    downloadFile(`ledger-export-${stamp}.json`, JSON.stringify(withDecimal, null, 2), 'application/json')
  }
}
