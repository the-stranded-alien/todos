// ── Focus mode ─────────────────────────────────────────────
import { useMemo, useCallback } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { useStore } from '../store/context.js'

export const FocusMode = ({ onClose }) => {
  const { state, completeTask } = useStore()

  const firstTask = useMemo(() =>
    state.tasks
      .filter(t => !t.completed && !t.parentId)
      .sort((a, b) => {
        // Prioritize by priority desc, then order asc
        if (b.priority !== a.priority) return b.priority - a.priority
        return a.order - b.order
      })[0]
  , [state.tasks])

  const remaining = useMemo(() =>
    state.tasks.filter(t => !t.completed && !t.parentId).length
  , [state.tasks])

  const handleDone = useCallback(async () => {
    if (firstTask) await completeTask(firstTask.id)
  }, [firstTask, completeTask])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'var(--bg-app)' }}
    >
      {/* Close */}
      <button
        className="btn btn-ghost absolute top-4 right-4"
        onClick={onClose}
        aria-label="Exit focus mode"
      >
        <X size={20} /> Exit focus mode
      </button>

      {firstTask ? (
        <div className="anim-fade-in flex flex-col items-center gap-8 max-w-2xl w-full px-8">
          <div style={{ color: 'var(--text-4)', fontSize: '.875rem' }}>
            {remaining} task{remaining !== 1 ? 's' : ''} remaining
          </div>

          <div
            className="focus-mode-task"
            style={{
              background: 'var(--bg-card)',
              border: '2px solid var(--border)',
              borderRadius: 24,
              padding: '3rem 4rem',
              width: '100%',
              textAlign: 'center',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {firstTask.title}
          </div>

          {firstTask.notes && (
            <p style={{ color: 'var(--text-3)', fontSize: '1rem', textAlign: 'center', maxWidth: 500 }}>
              {firstTask.notes.slice(0, 200)}{firstTask.notes.length > 200 ? '…' : ''}
            </p>
          )}

          <button
            className="btn btn-primary"
            onClick={handleDone}
            style={{ padding: '14px 40px', fontSize: '1rem', borderRadius: 999 }}
            aria-label="Mark task done and go to next"
          >
            <CheckCircle2 size={20} /> Done
          </button>

          <p style={{ color: 'var(--text-4)', fontSize: '.8rem' }}>
            Press <kbd style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>Esc</kbd> to exit
          </p>
        </div>
      ) : (
        <div className="anim-fade-in flex flex-col items-center gap-4">
          <CheckCircle2 size={64} style={{ color: 'var(--accent)' }} />
          <h2 style={{ color: 'var(--text-1)', fontSize: '1.5rem', fontWeight: 700 }}>All done! 🎉</h2>
          <p style={{ color: 'var(--text-3)' }}>You have no remaining tasks.</p>
          <button className="btn btn-primary" onClick={onClose}>Back to tasks</button>
        </div>
      )}
    </div>
  )
}
