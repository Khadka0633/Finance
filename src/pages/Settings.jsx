import { useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { exportAllData } from '../lib/exportData'
import { deleteMyAccountAndData } from '../services/deleteAccount'
import { useAuth } from '../contexts/AuthContext'

export function Settings() {
  const { uid } = useOutletContext()
  const { currentUser, linkGoogleToAccount, linkPasswordToAccount, resendVerificationEmail } = useAuth()
  const navigate = useNavigate()
  const [confirmText, setConfirmText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const providers = currentUser?.providerData?.map((p) => p.providerId) ?? []
  const hasPassword = providers.includes('password')
  const hasGoogle = providers.includes('google.com')
  const [newPassword, setNewPassword] = useState('')
  const [showAddPassword, setShowAddPassword] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkMsg, setLinkMsg] = useState('')
  const [linkErr, setLinkErr] = useState('')
  const [verifyMsg, setVerifyMsg] = useState('')

  async function handleAddGoogle() {
    setLinkErr('')
    setLinkMsg('')
    setLinkBusy(true)
    try {
      await linkGoogleToAccount()
      setLinkMsg('Google sign-in linked to your account.')
    } catch (err) {
      setLinkErr(
        err.code === 'auth/credential-already-in-use'
          ? 'That Google account is already linked to a different account.'
          : 'Could not link Google. Please try again.'
      )
    } finally {
      setLinkBusy(false)
    }
  }

  async function handleAddPassword(e) {
    e.preventDefault()
    setLinkErr('')
    setLinkMsg('')
    if (newPassword.length < 6) {
      setLinkErr('Password must be at least 6 characters.')
      return
    }
    setLinkBusy(true)
    try {
      await linkPasswordToAccount(newPassword)
      setNewPassword('')
      setShowAddPassword(false)
      setLinkMsg('Password sign-in added to your account.')
    } catch {
      setLinkErr('Could not add a password. Please try again.')
    } finally {
      setLinkBusy(false)
    }
  }

  async function handleResendVerification() {
    setVerifyMsg('Sending…')
    try {
      await resendVerificationEmail()
      setVerifyMsg('Verification email sent — check your inbox.')
    } catch {
      setVerifyMsg('Could not send it right now — please try again shortly.')
    }
  }

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
    } catch {
      setError('Could not delete your account. If this was a while since you last signed in, please sign out and back in, then try again.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl mb-1">Settings</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">{currentUser?.email}</p>
      </div>

      <section className="bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-4 space-y-3">
        <h2 className="text-lg">Sign-in methods</h2>

        <div className="flex items-center justify-between text-sm">
          <span>Email verification</span>
          {currentUser?.emailVerified ? (
            <span className="text-[var(--color-income)]">Verified ✓</span>
          ) : (
            <button onClick={handleResendVerification} className="underline text-[var(--color-ink-soft)]">
              Not verified — resend
            </button>
          )}
        </div>
        {verifyMsg && <p className="text-xs text-[var(--color-ink-soft)]">{verifyMsg}</p>}

        <div className="h-px bg-[var(--color-hairline)]" />

        <div className="flex items-center justify-between text-sm">
          <span>Password</span>
          {hasPassword ? (
            <span className="text-[var(--color-income)]">Enabled ✓</span>
          ) : (
            <button onClick={() => setShowAddPassword((v) => !v)} className="underline text-[var(--color-ink-soft)]">
              Add password
            </button>
          )}
        </div>
        {!hasPassword && showAddPassword && (
          <form onSubmit={handleAddPassword} className="flex gap-2">
            <input
              type="password"
              placeholder="New password (min. 6 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1 border border-[var(--color-hairline)] rounded px-3 py-2 bg-white text-sm"
            />
            <button type="submit" disabled={linkBusy} className="btn-primary rounded px-4 py-2 text-sm disabled:opacity-50">
              Add
            </button>
          </form>
        )}

        <div className="flex items-center justify-between text-sm">
          <span>Google</span>
          {hasGoogle ? (
            <span className="text-[var(--color-income)]">Linked ✓</span>
          ) : (
            <button onClick={handleAddGoogle} disabled={linkBusy} className="underline text-[var(--color-ink-soft)] disabled:opacity-50">
              Link Google
            </button>
          )}
        </div>

        {linkMsg && <p className="text-xs text-[var(--color-income)]">{linkMsg}</p>}
        {linkErr && <p className="text-xs text-[var(--color-expense)]">{linkErr}</p>}
        <p className="text-xs text-[var(--color-ink-soft)]">
          Linking both means you can sign in with either your password or Google — same account either way.
        </p>
      </section>

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
