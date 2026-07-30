import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { OfflineBanner } from './OfflineBanner'
import { EmailVerificationBanner } from './EmailVerificationBanner'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transactions' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
]

export function AppLayout() {
  const { logout, currentUser } = useAuth()

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <OfflineBanner />
      <EmailVerificationBanner />
      <header className="border-b border-[var(--color-hairline)] bg-[var(--color-paper-raised)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-lg">Ledger</span>
          <nav className="hidden sm:flex gap-1 text-sm">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  isActive
                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] px-3 py-1.5 rounded-full'
                    : 'text-[var(--color-ink-soft)] px-3 py-1.5 rounded-full hover:bg-[var(--color-hairline)]/40'
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <button onClick={logout} className="text-sm text-[var(--color-ink-soft)] underline">
            Sign out
          </button>
        </div>
        <div className="sm:hidden relative">
          <nav className="flex gap-1.5 px-4 pb-3 text-xs overflow-x-auto">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  isActive
                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] px-3 py-1 rounded-full whitespace-nowrap'
                    : 'text-[var(--color-ink-soft)] px-3 py-1 rounded-full whitespace-nowrap'
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="pointer-events-none absolute right-0 top-0 bottom-3 w-8 bg-gradient-to-l from-[var(--color-paper-raised)] to-transparent" />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet context={{ uid: currentUser?.uid }} />
      </main>
    </div>
  )
}
