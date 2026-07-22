import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Login() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setBusy(false)
    }
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
