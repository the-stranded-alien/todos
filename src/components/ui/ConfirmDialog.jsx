// ── Confirm a step that can't be taken back easily ─────────
import { useRef } from 'react'
import { AlertTriangle } from '../../icons.jsx'
import { Dialog } from './Dialog.jsx'

export const ConfirmDialog = ({ title, children, confirmLabel, onConfirm, onCancel }) => {
  const cancelRef = useRef(null)
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      initialFocus={cancelRef}
      footer={<>
        <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-danger" data-feat="danger" onClick={onConfirm}>{confirmLabel}</button>
      </>}
    >
      <div className="flex gap-3" style={{ color: 'var(--text-2)', fontSize: '.875rem', lineHeight: 1.5 }}>
        <AlertTriangle size={20} data-feat="danger" />
        <div>{children}</div>
      </div>
    </Dialog>
  )
}
