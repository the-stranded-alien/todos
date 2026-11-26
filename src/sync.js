// ── Cross-tab change notifications (BroadcastChannel) ──────
// Every IndexedDB write announces itself; other tabs reload from
// IndexedDB, which is the single source of truth. Own messages are
// ignored and bursts of writes collapse into one message.
import { nanoid } from './utils/nanoid.js'

export const TAB_ID = nanoid(8)
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('todos-sync') : null
let timer = 0

export const announceChange = () => {
  if (!channel) return
  clearTimeout(timer)
  timer = setTimeout(() => {
    try { channel.postMessage({ from: TAB_ID, at: Date.now() }) } catch { /* closed */ }
  }, 30)
}

export const onRemoteChange = (cb) => {
  if (!channel) return () => {}
  const handler = (e) => { if (e.data?.from && e.data.from !== TAB_ID) cb(e.data) }
  channel.addEventListener('message', handler)
  return () => channel.removeEventListener('message', handler)
}
