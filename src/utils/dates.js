// ── Local-calendar date helpers ────────────────────────────
// Due dates are stored as local "YYYY-MM-DD" strings. Never derive them
// from toISOString(), which is UTC and is a day off for much of the world.

export const toLocalISO = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const todayISO = (now = new Date()) => toLocalISO(now)

export const addDaysISO = (n, from = new Date()) => {
  const d = new Date(from)
  d.setDate(d.getDate() + n)
  return toLocalISO(d)
}

// Parse "YYYY-MM-DD" as a local date (new Date('YYYY-MM-DD') is UTC midnight).
export const parseLocalISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
