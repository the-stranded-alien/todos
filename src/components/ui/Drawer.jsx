// ── Slide-in drawer (modal on narrow screens) ──────────────
import { useRef } from 'react'
import { useDialogKeys } from '../../hooks/useDialogKeys.js'

export const Drawer = ({ label, onClose, children }) => {
  const ref = useRef(null)
  useDialogKeys(onClose, { focus: () => ref.current?.querySelector('[aria-current="page"], button')?.focus() })
  return (
    <div className="drawer-backdrop backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className="drawer anim-slide-in-left">
        {children}
      </div>
    </div>
  )
}
