// ── Live elapsed time for a running timer ──────────────────
import { useEffect, useState } from 'react'

export const useElapsed = (startedAt) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt == null) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 1000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [startedAt])
  return startedAt == null ? 0 : Math.max(0, now - startedAt)
}
