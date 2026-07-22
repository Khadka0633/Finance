import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../lib/firebase'

const userRef = (uid) => doc(db, 'users', uid)

/** One-time fetch of a user's custom categories, split by expense/income. */
export async function fetchCustomCategories(uid) {
  const snap = await getDoc(userRef(uid))
  const data = snap.exists() ? snap.data() : {}
  return {
    expense: data.customExpenseCategories ?? [],
    income: data.customIncomeCategories ?? [],
  }
}

/** Adds a new custom category name for the given transaction kind ('income' | 'expense'). */
export async function addCustomCategory(uid, kind, name) {
  const field = kind === 'income' ? 'customIncomeCategories' : 'customExpenseCategories'
  await setDoc(userRef(uid), { [field]: arrayUnion(name) }, { merge: true })
}
