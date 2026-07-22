import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fsLimit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { todayLocalDate } from '../lib/dates'

const txnsRef = (uid) => collection(db, 'users', uid, 'transactions')

/**
 * Live subscription to transactions within a month, newest first.
 * Deliberately scoped (not the full history) — an unbounded onSnapshot
 * listener re-reads and re-bills the entire result set on every change,
 * which gets slow and costly as history grows.
 */
export function subscribeTransactionsForMonth(uid, yyyyMm, callback) {
  const q = query(
    txnsRef(uid),
    where('localDate', '>=', `${yyyyMm}-01`),
    where('localDate', '<=', `${yyyyMm}-31`),
    orderBy('localDate', 'desc'),
    fsLimit(500),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data(), _pending: d.metadata.hasPendingWrites })))
  })
}

/**
 * One-time (non-live) fetch across an arbitrary date range, for Reports.
 * Trend charts don't need real-time updates, so this avoids paying for
 * a live listener across a large historical range.
 */
export async function fetchTransactionsInRange(uid, fromLocalDate, toLocalDate) {
  const q = query(
    txnsRef(uid),
    where('localDate', '>=', fromLocalDate),
    where('localDate', '<=', toLocalDate),
    orderBy('localDate', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function addTransaction(uid, { amount, type, accountId, category, note, localDate }) {
  return addDoc(txnsRef(uid), {
    amount, // integer cents
    type, // 'income' | 'expense'
    accountId,
    category: category ?? null,
    note: note ?? '',
    localDate: localDate ?? todayLocalDate(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateTransaction(uid, txnId, data) {
  return updateDoc(doc(db, 'users', uid, 'transactions', txnId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Deletes a transaction and returns the deleted data, so the caller can
 * show an "Undo" toast and recreate the doc if the user clicks it —
 * Firestore has no built-in trash/undo.
 */
export async function deleteTransaction(uid, txnId) {
  const ref = doc(db, 'users', uid, 'transactions', txnId)
  const snap = await getDoc(ref)
  const data = snap.exists() ? { id: snap.id, ...snap.data() } : null
  await deleteDoc(ref)
  return data
}

/** Recreates a deleted transaction from a previously captured snapshot (for Undo) */
export async function restoreTransaction(uid, { id, ...data }) {
  return addDoc(txnsRef(uid), data)
}
