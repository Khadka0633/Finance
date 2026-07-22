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
  const header = ['date', 'type', 'category', 'accountId', 'amount_cents', 'note']
  const rows = transactions.map((t) =>
    [t.localDate, t.type, t.category ?? '', t.accountId, t.amount, (t.note ?? '').replace(/,/g, ';')].join(',')
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
    downloadFile(`ledger-export-${stamp}.json`, JSON.stringify(transactions, null, 2), 'application/json')
  }
}
