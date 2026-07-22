import { useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { exportAllData } from '../lib/exportData'
import { deleteMyAccountAndData } from '../services/deleteAccount'
import { useAuth } from '../contexts/AuthContext'

export function Settings() {
  const { uid } = useOutletContext()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [confirmText, setConfirmText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleExport(format) {
    await exportAllData(uid, format)
  }

  async function handleDelete() {
    if (confirmText !== 'DELETE') return
    setBusy(true)
    setError('')
    try {
      await deleteMyAccountAndData(uid)
      navigate('/login')
    } catch (err) {
      setError('Could not delete your account. If this was a while since you last signed in, please sign out and back in, then try again.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-2xl mb-1">Settings</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">{currentUser?.email}</p>
      </div>

      <section className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4 space-y-3">
        <h2 className="text-lg">Export your data</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Download a personal backup of all your transactions. The free tier doesn't back up data automatically, so this is on you.
        </p>
        <div className="flex gap-2">
          <button onClick={() => handleExport('csv')} className="border border-[var(--color-hairline)] rounded px-4 py-2 text-sm">Export CSV</button>
          <button onClick={() => handleExport('json')} className="border border-[var(--color-hairline)] rounded px-4 py-2 text-sm">Export JSON</button>
        </div>
      </section>

      <section className="bg-[var(--color-paper-raised)] border border-[var(--color-expense)] rounded-lg p-4 space-y-3">
        <h2 className="text-lg text-[var(--color-expense)]">Delete account and all data</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">
          This permanently deletes every account, transaction, and budget, plus your sign-in — not just a disabled login. This can't be undone.
        </p>
        {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
        {!showConfirm ? (
          <button onClick={() => setShowConfirm(true)} className="text-sm underline text-[var(--color-expense)]">
            Delete my account and all data
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">Type <strong>DELETE</strong> to confirm.</p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} className="flex-1 border border-[var(--color-hairline)] rounded py-2 text-sm">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE' || busy}
                className="flex-1 bg-[var(--color-expense)] text-white rounded py-2 text-sm disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Permanently delete'}
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="text-xs text-[var(--color-ink-soft)]">
        This app is a personal tracker and does not provide financial or tax advice.
      </p>
    </div>
  )
}
