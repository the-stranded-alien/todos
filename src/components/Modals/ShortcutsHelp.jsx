// ── Keyboard shortcuts help modal ──────────────────────────
import { X } from 'lucide-react'

const SHORTCUTS = [
  { key: 'n', desc: 'Focus quick-add input' },
  { key: '/', desc: 'Focus search' },
  { key: 'Ctrl+Z', desc: 'Undo last action' },
  { key: 'Ctrl+Shift+Z', desc: 'Redo' },
  { key: 'Ctrl+K', desc: 'Open command palette' },
  { key: 'Escape', desc: 'Close panel / modal' },
  { key: '1', desc: 'Jump to Inbox' },
  { key: '2', desc: 'Jump to Today' },
  { key: '3', desc: 'Jump to Upcoming' },
  { key: '4', desc: 'Jump to All Tasks' },
  { key: 'Space', desc: 'Toggle complete on focused task' },
  { key: 'Tab', desc: 'Indent task (make subtask)' },
  { key: 'Shift+Tab', desc: 'Unindent task' },
  { key: 'F', desc: 'Toggle focus mode' },
  { key: '?', desc: 'Show this help' },
]

export const ShortcutsHelp = ({ onClose }) => (
  <div
    className="backdrop fixed inset-0 z-50 flex items-center justify-center"
    onClick={e => { if (e.target === e.currentTarget) onClose() }}
  >
    <div
      className="anim-drop-in rounded-2xl p-6 w-full max-w-md"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '1.1rem' }}>Keyboard Shortcuts</h2>
        <button className="btn btn-ghost p-1" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-1">
        {SHORTCUTS.map(({ key, desc }) => (
          <div key={key} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <span style={{ color: 'var(--text-3)', fontSize: '.875rem' }}>{desc}</span>
            <kbd style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              color: 'var(--text-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: '.75rem',
              padding: '2px 8px',
              whiteSpace: 'nowrap',
            }}>{key}</kbd>
          </div>
        ))}
      </div>
    </div>
  </div>
)
