// ── Suggest subtasks: on-device AI with a quick non-AI fallback ──
import { useEffect, useRef, useState } from 'react'
import { Sparkles } from '../icons.jsx'
import { useStore } from '../store/context.js'
import { aiAvailability, aiSteps, quickSteps } from '../ai.js'
import { toast } from '../toast.js'

const PRIVACY = 'Runs on your device. Nothing is sent anywhere.'
const NEEDS = 'Suggestions use the AI built into Chrome on desktop (Chrome 138 or later, about 22 GB of free disk space and 4 GB of graphics memory).'

export const SuggestSubtasks = ({ task }) => {
  const { addSubtasks, undo } = useStore()
  // idle | checking | downloading | thinking | results | unsupported | error
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [steps, setSteps] = useState([])
  const [picked, setPicked] = useState([])
  const [note, setNote] = useState('')
  const abort = useRef(null)

  // Leaving the task (or closing the panel) cancels any work in progress
  useEffect(() => () => abort.current?.abort(), [task.id])

  const show = (list, source) => {
    if (!list.length) {
      setNote(source === 'quick'
        ? 'Couldn’t find steps to split out. Write one step per line in the notes, then try again.'
        : 'No suggestions came back. Try the quick version, or add more detail to the notes.')
      setPhase(source === 'quick' ? 'idle' : 'error')
      return
    }
    setSteps(list)
    setPicked(list.map(() => true))
    setNote(source === 'quick' ? 'Quick version: taken from your notes and title.' : PRIVACY)
    setPhase('results')
  }

  const useQuick = () => {
    abort.current?.abort()
    show(quickSteps(task), 'quick')
  }

  const start = async () => {
    setNote('')
    setPhase('checking')
    const avail = await aiAvailability()
    if (avail === 'unsupported' || avail === 'unavailable') { setPhase('unsupported'); return }
    const ctrl = new AbortController()
    abort.current = ctrl
    setProgress(0)
    setPhase(avail === 'available' ? 'thinking' : 'downloading')
    try {
      const list = await aiSteps(task, {
        signal: ctrl.signal,
        onProgress: (p) => { setProgress(p); if (p >= 1) setPhase('thinking') },
      })
      if (!ctrl.signal.aborted) show(list, 'ai')
    } catch (e) {
      if (ctrl.signal.aborted || e?.name === 'AbortError') return
      setNote(`The on-device model couldn’t answer (${e?.message || 'unknown error'}). Use the quick version instead.`)
      setPhase('error')
    }
  }

  const cancel = () => { abort.current?.abort(); setPhase('idle') }

  const add = async () => {
    const chosen = steps.filter((_, i) => picked[i])
    if (!chosen.length) return
    const n = await addSubtasks(task, chosen)
    setPhase('idle')
    toast({ message: `Added ${n} subtask${n > 1 ? 's' : ''}.`, tone: 'success', action: { label: 'Undo', onClick: undo } })
  }

  if (phase === 'idle') {
    return (
      <div className="suggest">
        <button type="button" className="btn btn-ghost suggest-btn" onClick={start}>
          <Sparkles size={14} /> Suggest subtasks
        </button>
        {note && <p className="suggest-note" role="status">{note}</p>}
      </div>
    )
  }

  return (
    <div className="suggest suggest-open" role="group" aria-label="Suggested subtasks" aria-busy={phase === 'checking' || phase === 'downloading' || phase === 'thinking'}>
      {phase === 'checking' && <p className="suggest-note" role="status">Checking for on-device AI…</p>}

      {phase === 'unsupported' && (
        <>
          <p className="suggest-note">{NEEDS}</p>
          <div className="suggest-actions">
            <button type="button" className="btn btn-primary" onClick={useQuick}>Use quick version</button>
            <button type="button" className="btn btn-ghost" onClick={cancel}>Cancel</button>
          </div>
        </>
      )}

      {phase === 'downloading' && (
        <>
          <p className="suggest-note" role="status">Downloading the on-device model (first time only)… {Math.round(progress * 100)}%</p>
          <div className="usage-bar" role="progressbar" aria-label="Model download" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <span style={{ width: `${Math.max(2, progress * 100)}%` }} />
          </div>
          <div className="suggest-actions">
            <button type="button" className="btn btn-ghost" onClick={useQuick}>Use quick version</button>
            <button type="button" className="btn btn-ghost" onClick={cancel}>Cancel</button>
          </div>
        </>
      )}

      {phase === 'thinking' && (
        <>
          <p className="suggest-note" role="status"><span className="suggest-dot" aria-hidden="true" /> Thinking… {PRIVACY}</p>
          <div className="suggest-actions">
            <button type="button" className="btn btn-ghost" onClick={useQuick}>Use quick version</button>
            <button type="button" className="btn btn-ghost" onClick={cancel}>Cancel</button>
          </div>
        </>
      )}

      {phase === 'error' && (
        <>
          <p className="suggest-note" role="alert">{note}</p>
          <div className="suggest-actions">
            <button type="button" className="btn btn-primary" onClick={useQuick}>Use quick version</button>
            <button type="button" className="btn btn-ghost" onClick={cancel}>Cancel</button>
          </div>
        </>
      )}

      {phase === 'results' && (
        <>
          <ul className="suggest-list">
            {steps.map((s, i) => (
              <li key={i}>
                <label>
                  <input type="checkbox" className="bulk-check" checked={picked[i]} onChange={e => setPicked(p => p.map((v, j) => (j === i ? e.target.checked : v)))} />
                  <span>{s}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="suggest-note">{note}</p>
          <div className="suggest-actions">
            <button type="button" className="btn btn-primary" onClick={add} disabled={!picked.some(Boolean)}>
              Add {picked.filter(Boolean).length} subtask{picked.filter(Boolean).length === 1 ? '' : 's'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancel}>Discard</button>
          </div>
        </>
      )}
    </div>
  )
}
