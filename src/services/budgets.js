import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const budgetsRef = (uid) => collection(db, 'users', uid, 'budgets')

export function subscribeBudgets(uid, callback) {
  const q = query(budgetsRef(uid), orderBy('category', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function addBudget(uid, { category, monthlyLimit }) {
  return addDoc(budgetsRef(uid), { category, monthlyLimit })
}

export async function updateBudget(uid, budgetId, data) {
  return updateDoc(doc(db, 'users', uid, 'budgets', budgetId), data)
}

export async function deleteBudget(uid, budgetId) {
  return deleteDoc(doc(db, 'users', uid, 'budgets', budgetId))
}
