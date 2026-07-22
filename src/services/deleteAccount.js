import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { deleteUser } from 'firebase/auth'
import { db, auth } from '../lib/firebase'

const SUBCOLLECTIONS = ['accounts', 'transactions', 'budgets']

/**
 * Fully deletes a user's Firestore data AND their Auth record — not just
 * a "disable login" flag. Users of a finance app reasonably expect
 * "delete my account" to mean their data is actually gone.
 */
export async function deleteMyAccountAndData(uid) {
  for (const sub of SUBCOLLECTIONS) {
    const snap = await getDocs(collection(db, 'users', uid, sub))
    // Batches are capped at 500 writes; chunk defensively for large histories.
    const docs = snap.docs
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db)
      for (const d of docs.slice(i, i + 400)) batch.delete(d.ref)
      await batch.commit()
    }
  }
  const batch = writeBatch(db)
  batch.delete(doc(db, 'users', uid))
  await batch.commit()

  if (auth.currentUser) {
    await deleteUser(auth.currentUser)
  }
}
