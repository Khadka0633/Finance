import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function EmailVerificationBanner() {
  const { currentUser, resendVerificationEmail } = useAuth()
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  // Only password accounts need this — Google-authenticated emails are
  // already verified by Google, so currentUser.emailVerified is true for them.
  if (!currentUser || currentUser.emailVerified) return null

  async function handleResend() {
    setBusy(true)
    try {
      await resendVerificationEmail()
      setSent(true)
    } catch {
      // Best-effort — if this fails (e.g. rate limited), just leave the
      // banner as-is so they can try again in a bit.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-[var(--color-budget)] text-[var(--color-ink)] text-sm text-center py-1.5 px-4">
      {sent ? (
        <span>Verification email sent to {currentUser.email} — check your inbox.</span>
      ) : (
        <span>
          Please verify your email ({currentUser.email}) to secure your account.{' '}
          <button onClick={handleResend} disabled={busy} className="underline disabled:opacity-50">
            {busy ? 'Sending…' : 'Resend verification email'}
          </button>
        </span>
      )}
    </div>
  )
}
