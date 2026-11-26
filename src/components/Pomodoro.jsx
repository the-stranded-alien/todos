// ── Pomodoro timer (focus mode) ────────────────────────────
// Counts down from an end timestamp (accurate even if the tab is
// throttled). Focus phases run the task's own timer; finished focus
// sessions are recorded on the task.
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/context.js'
import { usePrefs, prefersReducedMotion } from '../prefs.js'
import { nextPhase, formatClock, PHASE_LABEL } from '../utils/pomodoro.js'
import { toast } from '../toast.js'

const chime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    for (const t of [0, 0.28]) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = t ? 1046 : 784
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.27)
    }
    setTimeout(() => ctx.close(), 900)
  } catch { /* no audio */ }
}

const notify = (title, body) => {
  if (document.visibilityState !== 'hidden' || !('Notification' in window) || Notification.permission !== 'granted') return
  const opts = { body, icon: '/icons/icon-192.png', tag: 'pomodoro' }
  if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => {})
  else try { new Notification(title, opts) } catch { /* not allowed */ }
}

export const Pomodoro = ({ task }) => {
  const { startTimer, stopTimer, recordPomodoro } = useStore()
  const prefs = usePrefs()
  const settings = { work: prefs.pomoWork, short: prefs.pomoShort, long: prefs.pomoLong, longEvery: prefs.pomoLongEvery }
  const [phase, setPhase] = useState('work')
  const [endsAt, setEndsAt] = useState(null)        // running when set
  const [left, setLeft] = useState(settings.work * 60000) // remaining when paused
  const [done, setDone] = useState(0)               // focus sessions finished this run
  const [now, setNow] = useState(() => Date.now())
  const [announce, setAnnounce] = useState('')
  const taskRef = useRef(task)
  const live = useRef({})

  const running = endsAt != null
  const remaining = running ? Math.max(0, endsAt - now) : left
  const total = (phase === 'work' ? settings.work : phase === 'short' ? settings.short : settings.long) * 60000

  const useTimers = prefs.timers
  const startTask = (id) => (useTimers && id ? startTimer(id) : Promise.resolve())
  const stopTask = (id) => (useTimers && id ? stopTimer(id) : Promise.resolve())

  // Keep the latest values for the interval callback and unmount
  useEffect(() => { live.current = { phase, done, settings, task: taskRef.current, running } })

  // The task in focus changed (e.g. Done): move the running timer to it
  useEffect(() => {
    const prev = taskRef.current
    taskRef.current = task
    if (prev?.id !== task?.id && live.current.running && live.current.phase === 'work') startTask(task?.id)
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving focus mode stops a running focus timer
  useEffect(() => () => { if (live.current.running && live.current.phase === 'work') stopTask(live.current.task?.id) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const finishPhase = (skipped) => {
    const { phase: p, done: d, settings: s, task: t } = live.current
    let doneNow = d
    if (p === 'work') {
      // Stop the timer first, then record: both write the same task
      const stopped = stopTask(t?.id)
      if (!skipped) {
        doneNow = d + 1; setDone(doneNow)
        if (t) stopped.then(() => recordPomodoro(t.id, s.work))
      }
    }
    const next = nextPhase(p, doneNow, s)
    setPhase(next.phase)
    if (!skipped && prefs.pomoSound) chime()
    if (next.phase === 'work') {
      // Breaks end on their own; the next focus session waits for Start
      setEndsAt(null); setLeft(next.minutes * 60000)
      const msg = 'Break’s over. Press Start when you’re ready.'
      setAnnounce(msg); if (!skipped) { toast(msg); notify('Break’s over', msg) }
    } else {
      setEndsAt(Date.now() + next.minutes * 60000)
      const msg = `${PHASE_LABEL[next.phase]}: ${next.minutes} minutes.${skipped ? '' : ' Nice work.'}`
      setAnnounce(msg); if (!skipped) { toast({ message: `Focus session done. ${msg}`, tone: 'success' }); notify('Focus session done', msg) }
    }
  }

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= endsAt) finishPhase(false)
    }, 250)
    return () => clearInterval(id)
  }, [running, endsAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    setEndsAt(Date.now() + left); setNow(Date.now())
    if (phase === 'work') startTask(task?.id)
    setAnnounce(`${PHASE_LABEL[phase]} started.`)
  }
  const pause = () => {
    setLeft(Math.max(0, endsAt - Date.now())); setEndsAt(null)
    if (phase === 'work') stopTask(task?.id)
    setAnnounce('Paused.')
  }
  const reset = () => {
    if (running && phase === 'work') stopTask(task?.id)
    setEndsAt(null); setPhase('work'); setLeft(settings.work * 60000); setDone(0); setAnnounce('Timer reset.')
  }
  const toggle = () => (running ? pause() : start())

  const toggleRef = useRef(toggle)
  useEffect(() => { toggleRef.current = toggle })

  // "P" starts/pauses while in focus mode
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() !== 'p' || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return
      e.preventDefault(); toggleRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const r = 54, circ = 2 * Math.PI * r
  const frac = total ? remaining / total : 0
  const cycle = done % settings.longEvery

  return (
    <section className="pomo" aria-label="Pomodoro timer" data-phase={phase}>
      <div className="pomo-ring">
        <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
          <circle cx="66" cy="66" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle cx="66" cy="66" r={r} fill="none" stroke="var(--pomo-color)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} transform="rotate(-90 66 66)"
            style={{ transition: prefersReducedMotion() ? 'none' : 'stroke-dashoffset .3s linear' }} />
        </svg>
        <div className="pomo-center">
          <span className="pomo-phase">{PHASE_LABEL[phase]}</span>
          <span className="pomo-clock" role="timer" aria-label={`${PHASE_LABEL[phase]}, ${Math.ceil(remaining / 60000)} minutes left`}>{formatClock(remaining)}</span>
        </div>
      </div>
      <div className="pomo-dots" role="img" aria-label={`${cycle} of ${settings.longEvery} focus sessions before a long break; ${done} done`}>
        {Array.from({ length: settings.longEvery }, (_, i) => <span key={i} data-on={i < cycle || undefined} />)}
      </div>
      <div className="pomo-actions">
        <button type="button" className="btn btn-ghost" onClick={toggle} aria-keyshortcuts="P">
          {running ? 'Pause' : left < total ? 'Resume' : phase === 'work' ? 'Start focus' : 'Start break'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => finishPhase(true)}>Skip {phase === 'work' ? 'to break' : 'break'}</button>
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={!running && left === settings.work * 60000 && phase === 'work' && !done}>Reset</button>
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </section>
  )
}
