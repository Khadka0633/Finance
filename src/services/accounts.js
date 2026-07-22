import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  limit,
  getDocs,
  orderBy,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const accountsRef = (uid) => collection(db, 'users', uid, 'accounts')
const transactionsRef = (uid) => collection(db, 'users', uid, 'transactions')

/** Live subscription to all accounts (archived and active) */
export function subscribeAccounts(uid, callback) {
  const q = query(accountsRef(uid), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function addAccount(uid, { name, type, archived = false }) {
  return addDoc(accountsRef(uid), {
    name,
    type, // 'cash' | 'bank' | 'card'
    archived,
    createdAt: new Date().toISOString(),
  })
}

export async function updateAccount(uid, accountId, data) {
  return updateDoc(doc(db, 'users', uid, 'accounts', accountId), data)
}

export async function archiveAccount(uid, accountId) {
  return updateAccount(uid, accountId, { archived: true })
}

export async function unarchiveAccount(uid, accountId) {
  return updateAccount(uid, accountId, { archived: false })
}

/**
 * Deletes an account only if no transactions reference it.
 * Throws a descriptive error if the account has history — caller should
 * offer archiveAccount() instead. This check-then-act is safe here because
 * it's a UX guard, not a security boundary (rules don't need to enforce it).
 */
export async function deleteAccount(uid, accountId) {
  const q = query(transactionsRef(uid), where('accountId', '==', accountId), limit(1))
  const existing = await getDocs(q)
  if (!existing.empty) {
    throw new Error('This account has transactions. Archive it instead of deleting.')
  }
  return deleteDoc(doc(db, 'users', uid, 'accounts', accountId))
}
