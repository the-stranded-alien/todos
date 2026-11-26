// ── Safe localStorage ──────────────────────────────────────
// Every access is wrapped: storage can throw in private windows,
// with blocked site data, or when the quota is full.

export const PREFIX = 'todos-'

export const readPref = (key, fallback = null) => {
  try {
    const v = localStorage.getItem(PREFIX + key)
    return v == null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}

export const writePref = (key, value) => {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // quota or access errors are ignored: prefs are conveniences
  }
}

export const removePref = (key) => {
  try { localStorage.removeItem(PREFIX + key) } catch { /* ignore */ }
}
