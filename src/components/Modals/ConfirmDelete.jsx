// ── Confirm dialog for destructive actions ─────────────────
import { useRef } from 'react'
import { AlertTriangle } from '../../icons.jsx'
import { Dialog } from '../ui/Dialog.jsx'

export const ConfirmDelete = ({ title = 'Delete?', message, confirmLabel = 'Delete', onConfirm, onCancel }) => {
  const cancelRef = useRef(null)
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      initialFocus={cancelRef}
      footer={<>
        <button ref={cancelRef} className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
      </>}
    >
      <div className="flex gap-3" style={{ color: 'var(--text-2)', fontSize: '.875rem' }}>
        <AlertTriangle size={20} data-feat="danger" />
        <p>{message}</p>
      </div>
    </Dialog>
  )
}
