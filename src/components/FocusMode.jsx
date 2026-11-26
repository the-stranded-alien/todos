// ── Focus mode ─────────────────────────────────────────────
import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { useDialogKeys } from '../hooks/useDialogKeys.js'
import { X, CheckCircle2 } from '../icons.jsx'
import { toast } from '../toast.js'
import { useStore } from '../store/context.js'
import { usePrefs } from '../prefs.js'
import { Pomodoro } from './Pomodoro.jsx'

export const FocusMode = ({ onClose }) => {
  const { state, completeTask } = useStore()
  const prefs = usePrefs()

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

  const doneRef = useRef(null)
  const backRef = useRef(null)
  useDialogKeys(onClose, { focus: () => (doneRef.current ?? backRef.current)?.focus() })

  // Keep the screen awake while focusing (re-acquired when the tab returns)
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock = null
    let alive = true
    const acquire = async () => {
      try { if (alive && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen') } catch { /* not allowed */ }
    }
    const onVis = () => { if (document.visibilityState === 'visible') acquire() }
    acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); lock?.release().catch(() => {}) }
  }, [])

  // Fullscreen toggle
  const canFullscreen = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen
  const [isFull, setIsFull] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement)
  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen().catch(() => toast({ message: 'Your browser didn’t allow full screen here.', tone: 'warning' }))
  }

  const handleDone = useCallback(async () => {
    if (firstTask) await completeTask(firstTask.id)
  }, [firstTask, completeTask])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-mode-title"
      style={{ background: 'var(--bg-app)' }}
    >
      <h2 id="focus-mode-title" className="sr-only">Focus mode</h2>
      <div className="absolute top-4 right-4 flex gap-1">
        {canFullscreen && (
          <button type="button" className="btn btn-ghost" onClick={toggleFullscreen} aria-pressed={isFull}>
            {isFull ? 'Exit full screen' : 'Full screen'}
          </button>
        )}
      <button
        type="button"
        className="btn btn-ghost"
        onClick={onClose}
      >
        <X size={20} /> Exit focus mode
      </button>
      </div>

      {firstTask ? (
        <div className="anim-fade-in flex flex-col items-center gap-6 max-w-2xl w-full px-8 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 80px)', paddingTop: 16, paddingBottom: 16 }}>
          <div aria-live="polite" style={{ color: 'var(--text-3)', fontSize: '.875rem' }}>
            {remaining} task{remaining !== 1 ? 's' : ''} remaining
          </div>

          <div className="focus-frame" style={{ width: '100%' }}>
            <div className="focus-mode-task" id="focus-mode-task">
              {firstTask.title}
            </div>
          </div>

          {firstTask.notes && (
            <p style={{ color: 'var(--text-3)', fontSize: '1rem', textAlign: 'center', maxWidth: 500 }}>
              {firstTask.notes.slice(0, 200)}{firstTask.notes.length > 200 ? '…' : ''}
            </p>
          )}

          {prefs.pomodoro && <Pomodoro task={firstTask} />}

          <button
            ref={doneRef}
            type="button"
            className="btn btn-primary"
            onClick={handleDone}
            style={{ padding: '14px 40px', fontSize: '1rem', borderRadius: 999 }}
            aria-describedby="focus-mode-task"
          >
            <CheckCircle2 size={20} /> Done
          </button>

          <p style={{ color: 'var(--text-3)', fontSize: '.8rem' }}>
            {prefs.pomodoro && <>Press <kbd className="kbd">P</kbd> to start or pause the timer · </>}Press <kbd className="kbd">Esc</kbd> to exit
          </p>
        </div>
      ) : (
        <div className="anim-fade-in flex flex-col items-center gap-4">
          <CheckCircle2 size={64} style={{ color: 'var(--accent)' }} />
          <p style={{ color: 'var(--text-1)', fontSize: '1.5rem', fontWeight: 700 }}>All done! <span aria-hidden="true">🎉</span></p>
          <p style={{ color: 'var(--text-3)' }}>You have no remaining tasks.</p>
          <button ref={backRef} type="button" className="btn btn-primary" onClick={onClose}>Back to tasks</button>
        </div>
      )}
    </div>
  )
}
