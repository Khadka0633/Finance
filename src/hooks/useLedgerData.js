import { useEffect, useState } from 'react'
import { subscribeAccounts } from '../services/accounts'
import { subscribeBudgets } from '../services/budgets'
import { subscribeTransactionsForMonth } from '../services/transactions'

export function useAccounts(uid) {
  const [accounts, setAccounts] = useState([])
  useEffect(() => {
    if (!uid) return
    return subscribeAccounts(uid, setAccounts)
  }, [uid])
  return accounts
}

export function useBudgets(uid) {
  const [budgets, setBudgets] = useState([])
  useEffect(() => {
    if (!uid) return
    return subscribeBudgets(uid, setBudgets)
  }, [uid])
  return budgets
}

export function useMonthTransactions(uid, yyyyMm) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!uid || !yyyyMm) return
    setLoading(true)
    const unsub = subscribeTransactionsForMonth(uid, yyyyMm, (txns) => {
      setTransactions(txns)
      setLoading(false)
    })
    return unsub
  }, [uid, yyyyMm])
  return { transactions, loading }
}
