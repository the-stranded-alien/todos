// ── Dialog keyboard handling ───────────────────────────────
// Focus once on open, Escape closes the topmost dialog, focus returns to
// whatever was focused before. Callbacks are read from a ref so parent
// re-renders never steal focus.
import { useEffect, useRef } from 'react'

const stack = []

export function useDialogKeys(onClose, { focus, canClose } = {}) {
  const latest = useRef({ onClose, canClose, focus })
  useEffect(() => { latest.current = { onClose, canClose, focus } })
  useEffect(() => {
    const token = {}
    stack.push(token)
    const previous = document.activeElement
    latest.current.focus?.()
    const onKey = (e) => {
      if (e.key !== 'Escape' || stack[stack.length - 1] !== token) return
      const { canClose: cc, onClose: close } = latest.current
      if (cc && !cc()) return
      e.preventDefault()
      e.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      stack.splice(stack.indexOf(token), 1)
      if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus()
    }
  }, [])
}
