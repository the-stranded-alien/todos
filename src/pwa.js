// ── Service worker registration + update notice ────────────
import { toast } from './toast.js'

export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) {
    // A stale production worker on the dev port would serve old assets.
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {})
    return
  }
  const hadController = !!navigator.serviceWorker.controller
  let notified = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // First install takes control silently; later ones mean a new version
    if (!hadController || notified) return
    notified = true
    toast({
      message: 'Todos was updated. Reload to use the new version.',
      action: { label: 'Reload', onClick: () => location.reload() },
      duration: 0,
    })
  })
  navigator.serviceWorker.register('/sw.js').then(reg => {
    // Check for a new version when the app comes back to the foreground
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) })
  }).catch(() => {})
}
