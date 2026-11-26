// ── Confirm delete modal ───────────────────────────────────
import { AlertTriangle } from '../../icons.jsx'

export const ConfirmDelete = ({ message, onConfirm, onCancel }) => (
  <div
    className="backdrop fixed inset-0 z-50 flex items-center justify-center"
    onClick={e => { if (e.target === e.currentTarget) onCancel() }}
  >
    <div
      className="anim-drop-in rounded-2xl p-6 w-full max-w-sm"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div style={{ color: 'var(--danger)' }}>
          <AlertTriangle size={20} />
        </div>
        <h2 style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '1rem' }}>Delete?</h2>
      </div>
      <p style={{ color: 'var(--text-3)', fontSize: '.875rem', marginBottom: '1.25rem' }}>
        {message || 'This action cannot be undone.'}
      </p>
      <div className="flex gap-2 justify-end">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
      </div>
    </div>
  </div>
)
