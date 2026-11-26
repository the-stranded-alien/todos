// ── Toast store: one toast at a time ───────────────────────
import { useSyncExternalStore } from 'react'

let current = null
let seq = 0
const listeners = new Set()
const emit = () => listeners.forEach(l => l())

// toast({ message, tone: 'info'|'success'|'warning', action: { label, onClick }, duration })
export const toast = (opts) => {
  const t = typeof opts === 'string' ? { message: opts } : opts
  current = { tone: 'info', duration: t.action ? 7000 : 4000, ...t, id: ++seq }
  emit()
  return current.id
}

export const dismissToast = (id) => {
  if (!current || (id != null && current.id !== id)) return
  current = null
  emit()
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
export const useToast = () => useSyncExternalStore(subscribe, () => current)
