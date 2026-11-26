// ── Persistent storage (navigator.storage) ─────────────────
// Asks the browser not to evict this site's data under storage pressure.

export const canPersist = () => typeof navigator !== 'undefined' && !!navigator.storage?.persist

export const isPersisted = async () => {
  try { return (await navigator.storage?.persisted?.()) ?? false } catch { return false }
}

// Returns 'granted' | 'denied' | 'unsupported'
export const requestPersist = async () => {
  if (!canPersist()) return 'unsupported'
  try { return (await navigator.storage.persist()) ? 'granted' : 'denied' } catch { return 'denied' }
}

export const storageEstimate = async () => {
  try { return (await navigator.storage?.estimate?.()) ?? null } catch { return null }
}

export const PERSIST_DENIED_HELP =
  'Your browser decided not to keep data permanently yet. Browsers usually allow it once the app is installed, bookmarked or used often. Download a backup to be safe.'
