import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="sticky top-0 z-50 bg-[var(--color-budget)] text-[var(--color-ink)] text-sm text-center py-1.5 px-4">
      You're offline — changes will be saved locally and synced when you're back online.
    </div>
  )
}
