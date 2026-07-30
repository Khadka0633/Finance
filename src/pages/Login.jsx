import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Login() {
  const { login, loginWithGoogle, pendingLink, resolveLinkWithPassword, cancelPendingLink, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [linkPassword, setLinkPassword] = useState('')
  const [linkError, setLinkError] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetBusy, setResetBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setBusy(true)
    try {
      const user = await loginWithGoogle()
      if (user) navigate('/')
      // If user is null but no error was thrown, a pendingLink was set —
      // the inline linking form below will render itself.
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleResolveLink(e) {
    e.preventDefault()
    setLinkError('')
    setLinkBusy(true)
    try {
      await resolveLinkWithPassword(linkPassword)
      navigate('/')
    } catch (err) {
      setLinkError(friendlyAuthError(err))
    } finally {
      setLinkBusy(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setResetError('')
    setResetBusy(true)
    try {
      await resetPassword(resetEmail)
      setResetSent(true)
    } catch (err) {
      // Firebase reports "user-not-found" for reset requests too, but we
      // don't want to confirm/deny whether an email is registered — show
      // the same success state either way.
      if (err?.code === 'auth/user-not-found') {
        setResetSent(true)
      } else {
        setResetError(friendlyAuthError(err))
      }
    } finally {
      setResetBusy(false)
    }
  }

  if (showForgot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-4">
        <div className="w-full max-w-sm bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-8">
          <h1 className="text-2xl mb-1">Reset your password</h1>
          <p className="text-sm text-[var(--color-ink-soft)] mb-6">
            Enter your email and we'll send you a link to set a new password.
          </p>
          {resetSent ? (
            <p className="text-sm text-[var(--color-income)] mb-4">
              If an account exists for {resetEmail}, a reset link is on its way — check your inbox.
            </p>
          ) : (
            <>
              {resetError && <p className="text-sm text-[var(--color-expense)] mb-4">{resetError}</p>}
              <form onSubmit={handleResetPassword} className="space-y-3">
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="Email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white"
                />
                <button type="submit" disabled={resetBusy} className="btn-primary w-full rounded py-2 disabled:opacity-50">
                  {resetBusy ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
          <button
            onClick={() => {
              setShowForgot(false)
              setResetSent(false)
              setResetError('')
              setResetEmail('')
            }}
            className="text-sm text-[var(--color-ink-soft)] underline mt-4 block mx-auto"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  if (pendingLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-4">
        <div className="w-full max-w-sm bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-8">
          <h1 className="text-2xl mb-1">Link your accounts</h1>
          <p className="text-sm text-[var(--color-ink-soft)] mb-6">
            You already have a password account for <strong>{pendingLink.email}</strong>. Enter that password to link Google
            sign-in to it — after this, either method will get you into the same account.
          </p>
          {linkError && <p className="text-sm text-[var(--color-expense)] mb-4">{linkError}</p>}
          <form onSubmit={handleResolveLink} className="space-y-3">
            <input
              type="password"
              required
              autoFocus
              placeholder="Password"
              value={linkPassword}
              onChange={(e) => setLinkPassword(e.target.value)}
              className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white"
            />
            <button type="submit" disabled={linkBusy} className="btn-primary w-full rounded py-2 disabled:opacity-50">
              {linkBusy ? 'Linking…' : 'Link accounts and sign in'}
            </button>
          </form>
          <button
            onClick={cancelPendingLink}
            className="text-sm text-[var(--color-ink-soft)] underline mt-4 block mx-auto"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-4">
      <div className="w-full max-w-sm bg-[var(--color-paper-raised)] border border-[var(--color-hairline)] rounded-lg p-8">
        <h1 className="text-2xl mb-1">Ledger</h1>
        <p className="text-sm text-[var(--color-ink-soft)] mb-6">Welcome back — please sign in.</p>

        {error && (
          <p className="text-sm text-[var(--color-expense)] mb-4">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-[var(--color-hairline)] rounded px-3 py-2 bg-white"
          />
          <div className="text-right">
            <button
              type="button"
              onClick={() => {
                setResetEmail(email)
                setShowForgot(true)
              }}
              className="text-xs text-[var(--color-ink-soft)] underline"
            >
              Forgot password?
            </button>
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full rounded py-2 disabled:opacity-50">
            Sign in
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px bg-[var(--color-hairline)] flex-1" />
          <span className="text-xs text-[var(--color-ink-soft)]">or</span>
          <div className="h-px bg-[var(--color-hairline)] flex-1" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full border border-[var(--color-hairline)] rounded py-2 disabled:opacity-50"
        >
          Continue with Google
        </button>

        <p className="text-sm text-[var(--color-ink-soft)] mt-6 text-center">
          No account? <Link to="/signup" className="underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}

function friendlyAuthError(err) {
  const code = err?.code ?? ''
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Incorrect email or password.'
  }
  if (code.includes('network-request-failed')) {
    return "Can't reach the server — first sign-in requires an internet connection."
  }
  return 'Something went wrong. Please try again.'
}
