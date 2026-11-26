// ── Repeating tasks ────────────────────────────────────────
// A rule looks like:
// { freq: 'daily'|'weekly'|'monthly'|'yearly', interval: 1,
//   weekdays: [1, 5],                       // weekly: which days (0 = Sunday)
//   monthly: { mode: 'day' } | { mode: 'nth', nth: 2, weekday: 2 } | { mode: 'nth', nth: -1, weekday: 'weekday' },
//   from: 'due' | 'completion',             // repeat from the due date or from when it's done
//   end: null | { after: 5 } | { until: 'YYYY-MM-DD' },
//   count: 0 }                              // occurrences completed so far
// Older tasks store just { freq, interval } and keep working.
import { toLocalISO, parseLocalISO } from './dates.js'

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ORD = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', [-1]: 'last' }

// Work at noon so daylight-saving changes never shift the calendar day
const at = (iso) => { const d = parseLocalISO(iso); d.setHours(12); return d }
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate()

// Same day-of-month N months later, clamped (31 Jan → 28/29 Feb)
const addMonthsClamped = (d, n, day = d.getDate()) => {
  const y = d.getFullYear(), m = d.getMonth() + n
  const ty = y + Math.floor(m / 12), tm = ((m % 12) + 12) % 12
  return new Date(ty, tm, Math.min(day, daysIn(ty, tm)), 12)
}

// The nth weekday (or 'weekday' = Mon–Fri) of a month; nth -1 = last
export const nthWeekdayOfMonth = (y, m, nth, weekday) => {
  const matches = []
  for (let day = 1; day <= daysIn(y, m); day++) {
    const w = new Date(y, m, day, 12).getDay()
    if (weekday === 'weekday' ? w >= 1 && w <= 5 : w === weekday) matches.push(day)
  }
  const day = nth === -1 ? matches[matches.length - 1] : matches[nth - 1]
  return day ? new Date(y, m, day, 12) : null
}

// Which nth weekday a date is (1–4, or -1 for a 5th), and whether it's the last one
export const nthOf = (iso) => {
  const d = at(iso)
  const nth = Math.ceil(d.getDate() / 7)
  return { nth: nth >= 5 ? -1 : nth, weekday: d.getDay(), isLast: d.getDate() + 7 > daysIn(d.getFullYear(), d.getMonth()) }
}

const weekStart = (d) => addDays(d, -d.getDay())
const weeksBetween = (a, b) => Math.round((weekStart(b) - weekStart(a)) / (7 * 86400000))

// Next date strictly after `fromISO`, or null when the rule has ended.
// `anchorISO` is the series start used to keep "every 2 weeks" in step.
export const nextOccurrence = (rule, fromISO, anchorISO = fromISO) => {
  if (!rule?.freq) return null
  const interval = Math.max(1, Number(rule.interval) || 1)
  const from = at(fromISO)
  let next = null

  if (rule.freq === 'daily') next = addDays(from, interval)

  else if (rule.freq === 'weekly') {
    const days = rule.weekdays?.length ? rule.weekdays : null
    if (!days) next = addDays(from, 7 * interval)
    else {
      const anchor = at(anchorISO)
      for (let i = 1; i <= 7 * interval + 7; i++) {
        const d = addDays(from, i)
        if (days.includes(d.getDay()) && weeksBetween(anchor, d) % interval === 0) { next = d; break }
      }
    }
  }

  else if (rule.freq === 'monthly') {
    const mode = rule.monthly?.mode ?? 'day'
    if (mode === 'nth') {
      // This month (if still ahead), then every `interval` months after
      for (let k = 0; k <= 24 && !next; k++) {
        const base = new Date(from.getFullYear(), from.getMonth() + k * interval, 1, 12)
        const cand = nthWeekdayOfMonth(base.getFullYear(), base.getMonth(), rule.monthly.nth, rule.monthly.weekday)
        if (cand && cand > from) next = cand
      }
    } else {
      const day = rule.monthly?.day ?? at(anchorISO).getDate()
      next = addMonthsClamped(from, interval, day)
      if (next <= from) next = addMonthsClamped(from, interval + 1, day)
    }
  }

  else if (rule.freq === 'yearly') {
    const anchor = at(anchorISO)
    next = new Date(from.getFullYear() + interval, anchor.getMonth(), 1, 12)
    next.setDate(Math.min(anchor.getDate(), daysIn(next.getFullYear(), next.getMonth())))
  }

  if (!next) return null
  const iso = toLocalISO(next)
  if (rule.end?.until && iso > rule.end.until) return null
  if (rule.end?.after && (rule.count ?? 0) + 1 >= rule.end.after) return null
  return iso
}

// First date on or after `todayISO` that fits the rule (for new tasks)
export const firstOccurrence = (rule, todayISO) => {
  const yesterday = toLocalISO(addDays(at(todayISO), -1))
  if (rule.freq === 'weekly' && rule.weekdays?.length) return nextOccurrence({ ...rule, interval: 1, end: null }, yesterday)
  if (rule.freq === 'monthly' && rule.monthly?.mode === 'nth') return nextOccurrence({ ...rule, interval: 1, end: null }, yesterday)
  if (rule.freq === 'monthly' && rule.monthly?.day) {
    const t = at(todayISO)
    const thisMonth = new Date(t.getFullYear(), t.getMonth(), Math.min(rule.monthly.day, daysIn(t.getFullYear(), t.getMonth())), 12)
    return toLocalISO(thisMonth >= t ? thisMonth : addMonthsClamped(t, 1, rule.monthly.day))
  }
  return todayISO
}

const unit = { daily: [null, 'days'], weekly: [null, 'weeks'], monthly: [null, 'months'], yearly: [null, 'years'] }

export const describeRecurrence = (rule, dueISO) => {
  if (!rule?.freq) return ''
  const n = Math.max(1, Number(rule.interval) || 1)
  const many = unit[rule.freq][1]
  let text = n === 1 ? { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[rule.freq] : `Every ${n} ${many}`
  if (rule.freq === 'daily' && n === 1) text = 'Every day'
  if (rule.freq === 'weekly' && rule.weekdays?.length) {
    const wd = [...rule.weekdays].sort()
    const isWeekdays = wd.join() === '1,2,3,4,5'
    text = isWeekdays && n === 1 ? 'Every weekday' : `${n === 1 ? 'Weekly' : `Every ${n} weeks`} on ${wd.map(d => DAY[d]).join(', ')}`
  }
  if (rule.freq === 'monthly') {
    if (rule.monthly?.mode === 'nth') {
      const wd = rule.monthly.weekday === 'weekday' ? 'weekday' : DAY_LONG[rule.monthly.weekday]
      text += ` on the ${ORD[rule.monthly.nth]} ${wd}`
    } else {
      const day = rule.monthly?.day ?? (dueISO ? at(dueISO).getDate() : null)
      if (day) text += ` on the ${day}${['th', 'st', 'nd', 'rd'][day % 10 > 3 || [11, 12, 13].includes(day % 100) ? 0 : day % 10]}`
    }
  }
  if (rule.from === 'completion') text += ` after completion`
  if (rule.end?.after) text += `, ${rule.end.after} times`
  if (rule.end?.until) text += `, until ${at(rule.end.until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  return text
}

// ── Natural language ("every weekday", "every 2 weeks on fri", …) ──
const DAYS_RE = '(sun|mon|tue|wed|thu|fri|sat)[a-z]*'
const dayIdx = (s) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(s.slice(0, 3).toLowerCase())
const ORD_WORDS = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, last: -1 }

// Returns { rule, match } or null. `match` is the text to remove from the title.
export const parseRecurrence = (text) => {
  const t = text
  let m
  const fromDone = /\b(?:after (?:done|completion|completing|finishing))\b/i
  const withFrom = (rule, match) => {
    const fm = t.match(fromDone)
    return { rule: fm ? { ...rule, from: 'completion' } : rule, match: fm ? [match, fm[0]] : [match] }
  }

  if ((m = t.match(/\bevery\s+weekday\b|\bon weekdays\b/i))) return withFrom({ freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] }, m[0])
  if ((m = t.match(/\b(?:daily|every\s+day)\b/i))) return withFrom({ freq: 'daily', interval: 1 }, m[0])
  if ((m = t.match(/\bevery\s+(\d+)\s+days?\b/i))) return withFrom({ freq: 'daily', interval: +m[1] }, m[0])

  // monthly on the 15th / every month on the last friday / monthly on the 2nd tuesday
  if ((m = t.match(new RegExp(`\\b(?:monthly|every\\s+(?:(\\d+)\\s+)?months?)\\s+on\\s+the\\s+(first|1st|second|2nd|third|3rd|fourth|4th|last)\\s+(weekday|${DAYS_RE})\\b`, 'i')))) {
    const weekday = m[3].toLowerCase() === 'weekday' ? 'weekday' : dayIdx(m[3])
    return withFrom({ freq: 'monthly', interval: +(m[1] || 1), monthly: { mode: 'nth', nth: ORD_WORDS[m[2].toLowerCase()], weekday } }, m[0])
  }
  if ((m = t.match(/\b(?:monthly|every\s+(?:(\d+)\s+)?months?)\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b/i))) {
    return withFrom({ freq: 'monthly', interval: +(m[1] || 1), monthly: { mode: 'day', day: Math.min(31, +m[2]) } }, m[0])
  }
  if ((m = t.match(/\b(?:monthly|every\s+(?:(\d+)\s+)?months?)\b/i))) return withFrom({ freq: 'monthly', interval: +(m[1] || 1) }, m[0])

  // weekly on mon and thu / every 2 weeks on fri / every monday
  if ((m = t.match(new RegExp(`\\b(?:weekly|every\\s+(?:(\\d+)\\s+)?weeks?)\\s+on\\s+((?:${DAYS_RE})(?:\\s*(?:,|and|&)\\s*(?:${DAYS_RE}))*)`, 'i')))) {
    const days = [...m[2].matchAll(new RegExp(DAYS_RE, 'gi'))].map(x => dayIdx(x[0]))
    return withFrom({ freq: 'weekly', interval: +(m[1] || 1), weekdays: [...new Set(days)].sort() }, m[0])
  }
  if ((m = t.match(new RegExp(`\\bevery\\s+((?:${DAYS_RE})(?:\\s*(?:,|and|&)\\s*(?:${DAYS_RE}))*)`, 'i')))) {
    const days = [...m[1].matchAll(new RegExp(DAYS_RE, 'gi'))].map(x => dayIdx(x[0]))
    return withFrom({ freq: 'weekly', interval: 1, weekdays: [...new Set(days)].sort() }, m[0])
  }
  if ((m = t.match(/\b(?:weekly|every\s+(?:(\d+)\s+)?weeks?)\b/i))) return withFrom({ freq: 'weekly', interval: +(m[1] || 1) }, m[0])
  if ((m = t.match(/\b(?:yearly|annually|every\s+(?:(\d+)\s+)?years?)\b/i))) return withFrom({ freq: 'yearly', interval: +(m[1] || 1) }, m[0])
  return null
}
