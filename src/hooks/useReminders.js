// ── Reminder scheduler (runs while the app is open) ────────
// One timer for the soonest reminder; re-planned whenever tasks change or
// the tab comes back. Shows an in-app toast, plus a system notification
// with Done / Snooze when notifications are on.
import { useCallback, useEffect, useRef } from 'react'
import { useStore } from '../store/context.js'
import { usePrefs } from '../prefs.js'
import { nextReminder, missedReminders, reminderTime, pendingAt } from '../utils/reminders.js'
import { toast } from '../toast.js'

const SNOOZE_MS = 10 * 60000
const MAX_WAIT = 6 * 3600000 // re-plan at least every 6 hours

const key = (t, at) => `${t.id}@${at}`
const unhandled = (list, set) => list.filter(x => !set.has(key(x.task, x.at)))

const when = (t) => (t.dueTime ? `due ${t.dueTime}` : t.dueDate ? `due ${t.dueDate}` : 'reminder')

export const useReminders = ({ onOpenTask }) => {
  const { state, markReminder, completeTask } = useStore()
  const prefs = usePrefs()
  const tasksRef = useRef(state.tasks)
  useEffect(() => { tasksRef.current = state.tasks })

  // Reminders already handled this session ("id@time"): guards against
  // firing twice before the IndexedDB write lands
  const handled = useRef(new Set())

  const snooze = useCallback((task) => markReminder(task.id, { reminderDone: reminderTime({ ...task, snoozeUntil: null }), snoozeUntil: Date.now() + SNOOZE_MS }), [markReminder])
  const dismiss = useCallback((task) => markReminder(task.id, { reminderDone: reminderTime({ ...task, snoozeUntil: null }), snoozeUntil: null }), [markReminder])

  const showSystem = useCallback((task) => {
    if (!prefs.reminders || !('Notification' in window) || Notification.permission !== 'granted') return
    const opts = {
      body: `${task.title} · ${when(task)}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `reminder-${task.id}`,
      requireInteraction: true,
      data: { taskId: task.id },
      actions: [{ action: 'done', title: 'Done' }, { action: 'snooze', title: 'Snooze 10 min' }],
    }
    if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then(r => r.showNotification('Reminder', opts)).catch(() => {})
    else { try { const { actions: _a, ...plain } = opts; new Notification('Reminder', plain) } catch { /* not allowed */ } }
  }, [prefs.reminders])

  const fire = useCallback((task, at) => {
    handled.current.add(key(task, at))
    dismiss(task)
    showSystem(task)
    toast({
      message: `Reminder: “${task.title}” (${when(task)}).`,
      tone: 'warning',
      duration: 0,
      action: { label: 'Snooze 10 min', onClick: () => snooze(task) },
    })
  }, [dismiss, showSystem, snooze])

  // Reminders that came due while the app was closed: tell once on load
  const checkedMissed = useRef(false)
  useEffect(() => {
    if (state.loading || checkedMissed.current) return
    checkedMissed.current = true
    const missed = missedReminders(state.tasks)
    if (!missed.length) return
    missed.forEach(m => { handled.current.add(key(m.task, m.at)); dismiss(m.task) })
    const first = missed[0].task
    toast({
      message: missed.length === 1 ? `While Todos was closed, a reminder came due: “${first.title}”.` : `While Todos was closed, ${missed.length} reminders came due, starting with “${first.title}”.`,
      tone: 'warning',
      duration: 0,
      action: { label: 'Open', onClick: () => onOpenTask(first.id) },
    })
  }, [state.loading, state.tasks, dismiss, onOpenTask])

  // Plan the next one
  useEffect(() => {
    if (state.loading) return
    let timer = 0
    const plan = () => {
      clearTimeout(timer)
      // Anything that came due while timers weren't running (sleep, a
      // throttled tab) fires now; otherwise wait for the soonest one
      const overdue = unhandled(missedReminders(tasksRef.current, Date.now(), 6 * 3600000), handled.current)[0]
      if (overdue) { timer = setTimeout(() => fire(overdue.task, overdue.at), 0); return }
      const next = nextReminder(tasksRef.current.filter(t => !handled.current.has(key(t, pendingAt(t)))))
      if (!next) return
      const wait = Math.min(Math.max(0, next.at - Date.now()), MAX_WAIT)
      timer = setTimeout(plan, wait)
    }
    plan()
    const onVis = () => { if (document.visibilityState === 'visible') plan() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [state.loading, state.tasks, fire])

  // Actions from a system notification (via the service worker) or a launch URL
  const act = useCallback((taskId, action) => {
    const task = tasksRef.current.find(t => t.id === taskId)
    if (!task) return
    if (action === 'done') { completeTask(taskId); toast({ message: `Completed “${task.title}”.`, tone: 'success' }) }
    else if (action === 'snooze') { snooze(task); toast(`Snoozed “${task.title}” for 10 minutes.`) }
    else onOpenTask(taskId)
  }, [completeTask, snooze, onOpenTask])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e) => { if (e.data?.type === 'REMINDER_ACTION') act(e.data.taskId, e.data.action) }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [act])

  return { act }
}
