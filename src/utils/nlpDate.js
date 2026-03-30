// ── Natural language date parser ───────────────────────────
// Returns ISO date string or null

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']

const toISO = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const addDays = (d, n) => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export const parseNLDate = (text) => {
  const t = text.toLowerCase().trim()
  const now = new Date()

  if (t === 'today') return toISO(now)
  if (t === 'tomorrow') return toISO(addDays(now, 1))
  if (t === 'yesterday') return toISO(addDays(now, -1))

  // next {weekday}
  const nextDay = t.match(/^next\s+(\w+)$/)
  if (nextDay) {
    const idx = DAYS.indexOf(nextDay[1])
    if (idx !== -1) {
      const diff = (idx - now.getDay() + 7) % 7 || 7
      return toISO(addDays(now, diff))
    }
  }

  // this {weekday}
  const thisDay = t.match(/^this\s+(\w+)$/)
  if (thisDay) {
    const idx = DAYS.indexOf(thisDay[1])
    if (idx !== -1) {
      const diff = (idx - now.getDay() + 7) % 7
      return toISO(addDays(now, diff === 0 ? 7 : diff))
    }
  }

  // bare weekday name
  const dayIdx = DAYS.indexOf(t)
  if (dayIdx !== -1) {
    const diff = (dayIdx - now.getDay() + 7) % 7 || 7
    return toISO(addDays(now, diff))
  }

  // in N days/weeks/months
  const inN = t.match(/^in\s+(\d+)\s+(day|days|week|weeks|month|months)$/)
  if (inN) {
    const n = parseInt(inN[1])
    const unit = inN[2]
    if (unit.startsWith('day')) return toISO(addDays(now, n))
    if (unit.startsWith('week')) return toISO(addDays(now, n * 7))
    if (unit.startsWith('month')) {
      const d = new Date(now)
      d.setMonth(d.getMonth() + n)
      return toISO(d)
    }
  }

  // end of week / month
  if (t === 'end of week' || t === 'eow') {
    const diff = 7 - now.getDay()
    return toISO(addDays(now, diff))
  }
  if (t === 'end of month' || t === 'eom') {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return toISO(d)
  }

  // {month} {day}
  const monthDay = t.match(/^(\w+)\s+(\d{1,2})$/)
  if (monthDay) {
    const mIdx = MONTHS.indexOf(monthDay[1])
    if (mIdx !== -1) {
      const day = parseInt(monthDay[2])
      let year = now.getFullYear()
      const candidate = new Date(year, mIdx, day)
      if (candidate < now) year++
      return toISO(new Date(year, mIdx, day))
    }
  }

  // ISO date passthrough
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t

  // MM/DD or MM/DD/YYYY
  const slashDate = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/)
  if (slashDate) {
    const m = parseInt(slashDate[1]) - 1
    const d = parseInt(slashDate[2])
    const y = slashDate[3] ? parseInt(slashDate[3]) : now.getFullYear()
    return toISO(new Date(y, m, d))
  }

  return null
}
