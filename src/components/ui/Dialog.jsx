// ── Modal dialog ───────────────────────────────────────────
// role="dialog" + aria-modal + aria-labelledby; closes on backdrop
// mouse-down and Escape; focus moves in once and returns on close;
// Tab stays inside.
import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDialogKeys } from '../../hooks/useDialogKeys.js'
import { X } from '../../icons.jsx'
import { IconButton } from './IconButton.jsx'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export const Dialog = ({
  title, onClose, children, footer, size = 'sm', initialFocus, canClose,
  hideHeader = false, placement = 'center', className = '',
}) => {
  const id = useId()
  const ref = useRef(null)

  useDialogKeys(onClose, {
    canClose,
    focus: () => {
      const box = ref.current
      const target = initialFocus?.current ?? box?.querySelector('[data-autofocus]') ?? box
      target?.focus()
    },
  })

  const trapTab = (e) => {
    if (e.key !== 'Tab') return
    const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null)
    if (!items.length) return
    const first = items[0], last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return createPortal(
    <div
      className={`backdrop dialog-backdrop dialog-${placement}`}
      onMouseDown={e => { if (e.target === e.currentTarget && (!canClose || canClose())) onClose() }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className={`dialog dialog-${size} anim-drop-in ${className}`}
        onKeyDown={trapTab}
      >
        {hideHeader ? (
          <h2 id={id} className="sr-only">{title}</h2>
        ) : (
          <div className="dialog-head">
            <h2 id={id} className="dialog-title">{title}</h2>
            <IconButton label="Close" icon={X} onClick={onClose} tooltipAlign="end" />
          </div>
        )}
        <div className={hideHeader ? '' : 'dialog-body'}>{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
