// ── Global keyboard shortcut registry ─────────────────────
import { useEffect } from 'react'

export const useHotkeys = (handlers) => {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented) return
      // Skip if typing in an input/textarea (unless explicitly handled)
      const tag = document.activeElement?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
        || document.activeElement?.contentEditable === 'true'

      for (const { key, ctrl, shift, allowInInput, handler } of handlers) {
        const matchCtrl  = ctrl  ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
        const matchShift = shift ? e.shiftKey : !e.shiftKey
        const matchKey   = e.key === key

        if (matchCtrl && matchShift && matchKey) {
          if (isInput && !allowInInput) continue
          e.preventDefault()
          handler(e)
          return
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}
