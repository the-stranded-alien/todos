// ── Reminder timing ────────────────────────────────────────
// task.reminder: null | { mode: 'offset', minutes } | { mode: 'at', at: 'YYYY-MM-DDTHH:MM' }
// task.reminderDone: the reminder time (ms) that has already fired or been dismissed
// task.snoozeUntil: a one-off time (ms) that replaces the reminder until it fires

export const DEFAULT_DUE_TIME = '09:00' // all-day tasks remind at 9am

export const REMINDER_PRESETS = [
  ['none', 'No reminder'],
  ['0', 'At the due time'],
  ['10', '10 minutes before'],
  ['60', '1 hour before'],
  ['1440', '1 day before'],
  ['at', 'At a specific time…'],
]

const localMs = (iso, time) => {
  const [y, m, d] = iso.split('-').map(Number)
  const [hh, mm] = (time || DEFAULT_DUE_TIME).split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm).getTime()
}

// When should this task's reminder fire? (ms, or null)
export const reminderTime = (task) => {
  const r = task?.reminder
  if (!r || task.completed) return null
  if (r.mode === 'at' && r.at) { const [d, t] = r.at.split('T'); return localMs(d, t) }
  if (r.mode === 'offset' && task.dueDate) return localMs(task.dueDate, task.dueTime) - (r.minutes || 0) * 60000
  return null
}

// When this task should next alert, if at all
export const pendingAt = (t) => {
  if (t.completed) return null
  if (t.snoozeUntil) return t.snoozeUntil
  const at = reminderTime(t)
  return at != null && t.reminderDone !== at ? at : null
}
const pending = pendingAt

// The soonest reminder still to come (after `now`)
export const nextReminder = (tasks, now = Date.now()) => {
  let best = null
  for (const t of tasks) {
    const at = pending(t)
    if (at != null && at > now && (!best || at < best.at)) best = { task: t, at }
  }
  return best
}

// Reminders whose time has passed but haven't fired (e.g. the app was closed);
// only the last `windowMs` count, older ones are just overdue tasks
export const missedReminders = (tasks, now = Date.now(), windowMs = 24 * 3600000) =>
  tasks.map(t => ({ task: t, at: pending(t) })).filter(x => x.at != null && x.at <= now && now - x.at <= windowMs).sort((a, b) => a.at - b.at)

export const describeReminder = (task) => {
  const r = task.reminder
  if (!r) return 'No reminder'
  if (r.mode === 'at') return `At ${new Date(reminderTime({ ...task, completed: false })).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
  if (!task.dueDate) return 'Set a due date for this reminder to work'
  return REMINDER_PRESETS.find(([v]) => Number(v) === r.minutes)?.[1] ?? `${r.minutes} minutes before`
}
