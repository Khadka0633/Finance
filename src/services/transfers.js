import {
  collection,
  doc,
  writeBatch,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { todayLocalDate } from '../lib/dates'

const txnsRef = (uid) => collection(db, 'users', uid, 'transactions')

/**
 * A transfer moves money between two of the user's own accounts. It is
 * NOT income or expense (net worth is unchanged), so it's modeled as a
 * linked PAIR of transaction docs (transfer_out / transfer_in) sharing a
 * transferId, rather than one doc — this keeps income/expense reports
 * from being polluted by money just moving between your own accounts.
 *
 * writeBatch (not runTransaction) is used deliberately: batched writes
 * queue safely offline, while runTransaction requires a live round trip
 * and would silently fail/hang without a connection.
 */
export async function addTransfer(uid, { fromAccountId, toAccountId, amount, note, localDate }) {
  if (fromAccountId === toAccountId) {
    throw new Error('Cannot transfer to the same account.')
  }
  const transferId = crypto.randomUUID()
  const date = localDate ?? todayLocalDate()
  const batch = writeBatch(db)

  const outRef = doc(txnsRef(uid))
  batch.set(outRef, {
    accountId: fromAccountId,
    type: 'transfer_out',
    amount,
    linkedAccountId: toAccountId,
    transferId,
    localDate: date,
    note: note ?? '',
    updatedAt: serverTimestamp(),
  })

  const inRef = doc(txnsRef(uid))
  batch.set(inRef, {
    accountId: toAccountId,
    type: 'transfer_in',
    amount,
    linkedAccountId: fromAccountId,
    transferId,
    localDate: date,
    note: note ?? '',
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
  return transferId
}

/** Fetches both legs of a transfer pair by their shared transferId */
async function getTransferPair(uid, transferId) {
  const q = query(txnsRef(uid), where('transferId', '==', transferId))
  const snap = await getDocs(q)
  return snap.docs
}

/** Updates amount/date/note on both legs of a transfer together */
export async function updateTransfer(uid, transferId, { amount, note, localDate }) {
  const docs = await getTransferPair(uid, transferId)
  const batch = writeBatch(db)
  for (const d of docs) {
    batch.update(d.ref, {
      ...(amount !== undefined ? { amount } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(localDate !== undefined ? { localDate } : {}),
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

/**
 * Changing WHICH accounts a transfer involves is modeled as delete + create,
 * simpler and safer than trying to "move" one leg of an existing pair.
 */
export async function changeTransferAccounts(uid, transferId, newFromAccountId, newToAccountId) {
  const docs = await getTransferPair(uid, transferId)
  if (docs.length === 0) throw new Error('Transfer not found.')
  const existing = docs[0].data()
  await deleteTransfer(uid, transferId)
  return addTransfer(uid, {
    fromAccountId: newFromAccountId,
    toAccountId: newToAccountId,
    amount: existing.amount,
    note: existing.note,
    localDate: existing.localDate,
  })
}

/**
 * Deletes both legs together — never just one, since a lone transfer_out
 * with no matching transfer_in would silently corrupt an account's
 * derived balance. Returns the deleted docs so the caller can offer Undo.
 */
export async function deleteTransfer(uid, transferId) {
  const docs = await getTransferPair(uid, transferId)
  const deleted = docs.map((d) => ({ id: d.id, ...d.data() }))
  const batch = writeBatch(db)
  for (const d of docs) batch.delete(d.ref)
  await batch.commit()
  return deleted
}

/** Recreates both legs of a deleted transfer (for Undo) */
export async function restoreTransfer(uid, deletedPair) {
  const batch = writeBatch(db)
  for (const { id, ...data } of deletedPair) {
    batch.set(doc(txnsRef(uid), id), data)
  }
  await batch.commit()
}
