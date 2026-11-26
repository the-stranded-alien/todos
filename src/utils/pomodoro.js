// ── Pomodoro cycle logic ───────────────────────────────────
export const DEFAULT_POMODORO = { work: 25, short: 5, long: 15, longEvery: 4 }

export const PHASE_LABEL = { work: 'Focus', short: 'Short break', long: 'Long break' }

// After finishing `phase` (with `done` work sessions completed so far,
// including this one if it was work), what comes next?
export const nextPhase = (phase, done, s = DEFAULT_POMODORO) => {
  if (phase !== 'work') return { phase: 'work', minutes: s.work }
  return done > 0 && done % s.longEvery === 0 ? { phase: 'long', minutes: s.long } : { phase: 'short', minutes: s.short }
}

export const formatClock = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60), sec = total % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Sessions are stored on the task: [{ at, minutes }], newest last, capped
export const addSession = (sessions = [], at, minutes, cap = 200) => [...sessions, { at, minutes }].slice(-cap)

export const sessionsSince = (tasks, since) => {
  let count = 0, minutes = 0
  for (const t of tasks) for (const s of t.pomodoros ?? []) if (s.at >= since) { count++; minutes += s.minutes }
  return { count, minutes }
}
