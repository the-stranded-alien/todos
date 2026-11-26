// ── iCalendar (.ics) export (RFC 5545) ─────────────────────
// Tasks with a due date become events; repeats become RRULEs and
// reminders become VALARMs, so the OS calendar can alert reliably.

const pad = (n) => String(n).padStart(2, '0')
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export const escapeText = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// Lines longer than 75 octets are folded with CRLF + space
export const fold = (line) => {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const out = []
  let cur = ''
  let len = 0
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length
    if (len + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0 }
    cur += ch; len += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

const utcStamp = (ms) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

export const rrule = (rule) => {
  if (!rule?.freq) return null
  const parts = [`FREQ=${rule.freq.toUpperCase()}`]
  if ((rule.interval ?? 1) > 1) parts.push(`INTERVAL=${rule.interval}`)
  if (rule.freq === 'weekly' && rule.weekdays?.length) parts.push(`BYDAY=${[...rule.weekdays].sort().map(d => DAYS[d]).join(',')}`)
  if (rule.freq === 'monthly' && rule.monthly?.mode === 'nth') {
    if (rule.monthly.weekday === 'weekday') parts.push('BYDAY=MO,TU,WE,TH,FR', `BYSETPOS=${rule.monthly.nth}`)
    else parts.push(`BYDAY=${rule.monthly.nth}${DAYS[rule.monthly.weekday]}`)
  }
  if (rule.freq === 'monthly' && rule.monthly?.mode === 'day' && rule.monthly.day) parts.push(`BYMONTHDAY=${rule.monthly.day}`)
  if (rule.end?.after) parts.push(`COUNT=${Math.max(1, rule.end.after - (rule.count ?? 0))}`)
  if (rule.end?.until) parts.push(`UNTIL=${rule.end.until.replace(/-/g, '')}`)
  return `RRULE:${parts.join(';')}`
}

export const taskToEvent = (task, { now = Date.now(), minutes = 30 } = {}) => {
  if (!task.dueDate) return null
  const date = task.dueDate.replace(/-/g, '')
  const lines = ['BEGIN:VEVENT', `UID:${task.id}@todos`, `DTSTAMP:${utcStamp(now)}`, `SUMMARY:${escapeText(task.title || 'Untitled')}`]
  if (task.dueTime) {
    const [h, m] = task.dueTime.split(':')
    lines.push(`DTSTART:${date}T${h}${m}00`, `DURATION:PT${task.estimate || minutes}M`)
  } else {
    const d = new Date(`${task.dueDate}T12:00`); d.setDate(d.getDate() + 1)
    lines.push(`DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`)
  }
  if (task.notes) lines.push(`DESCRIPTION:${escapeText(task.notes)}`)
  const r = rrule(task.recurring)
  if (r) lines.push(r)
  if (task.reminder?.mode === 'offset') {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(task.title || 'Reminder')}`, `TRIGGER:-PT${task.reminder.minutes || 0}M`, 'END:VALARM')
  }
  lines.push('END:VEVENT')
  return lines
}

export const buildCalendar = (tasks, opts) => {
  const events = tasks.filter(t => t.dueDate && !t.completed).flatMap(t => taskToEvent(t, opts))
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Todos//Tasks//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Todos', ...events, 'END:VCALENDAR']
    .map(fold).join('\r\n') + '\r\n'
}
