// ── Global keyboard shortcut registry ─────────────────────
import { useEffect } from 'react'

const isLetter = (k) => k.length === 1 && k.toLowerCase() !== k.toUpperCase()

// Does a keydown event match a shortcut definition?
// Letters compare case-insensitively (Shift+Z reports "Z"); symbol keys
// like "?" or "/" ignore Shift, since typing them may need it.
export const matchesHotkey = (e, { key, ctrl = false, shift = false }) => {
  const mod = e.ctrlKey || e.metaKey
  if (ctrl !== mod) return false
  if (isLetter(key)) return e.key.toLowerCase() === key.toLowerCase() && shift === e.shiftKey
  if (key.length === 1) return e.key === key
  return e.key === key && shift === e.shiftKey
}

export const useHotkeys = (handlers) => {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented || e.isComposing) return
      const el = document.activeElement
      const isInput = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || el?.isContentEditable

      for (const h of handlers) {
        if (!matchesHotkey(e, h)) continue
        if (isInput && !h.allowInInput) continue
        e.preventDefault()
        h.handler(e)
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}
