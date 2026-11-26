// ── Dark mode hook ─────────────────────────────────────────
import { useState, useEffect } from 'react'

export const useIsDark = () => {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  return isDark
}

export const toggleDark = () => {
  const isDark = document.documentElement.classList.toggle('dark')
  try { localStorage.setItem('theme', isDark ? 'dark' : 'light') } catch { /* ignore */ }
}
