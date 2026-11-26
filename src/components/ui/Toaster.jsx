// ── Toast host: bottom centre, polite live region ──────────
import { useEffect } from 'react'
import { useToast, dismissToast } from '../../toast.js'
import { CheckCircle2, AlertTriangle, X } from '../../icons.jsx'
import { IconButton } from './IconButton.jsx'

export const Toaster = () => {
  const t = useToast()

  useEffect(() => {
    if (!t || !t.duration) return
    const id = setTimeout(() => dismissToast(t.id), t.duration)
    return () => clearTimeout(id)
  }, [t])

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {t && (
        <div key={t.id} className={`toast toast-${t.tone} anim-slide-up no-print`}>
          {t.tone === 'success' && <CheckCircle2 size={15} data-feat="success" />}
          {t.tone === 'warning' && <AlertTriangle size={15} data-feat="warning" />}
          <span className="toast-msg">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => { t.action.onClick(); dismissToast(t.id) }}
            >
              {t.action.label}
            </button>
          )}
          <IconButton label="Dismiss" icon={X} size={13} small onClick={() => dismissToast(t.id)} />
        </div>
      )}
    </div>
  )
}
