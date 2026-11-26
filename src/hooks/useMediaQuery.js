// ── Media query as React state ─────────────────────────────
import { useSyncExternalStore } from 'react'

export const NARROW = '(max-width: 768px)'

export const useMediaQuery = (query) => useSyncExternalStore(
  (cb) => {
    const mq = window.matchMedia(query)
    mq.addEventListener?.('change', cb)
    return () => mq.removeEventListener?.('change', cb)
  },
  () => window.matchMedia(query).matches,
  () => false,
)
