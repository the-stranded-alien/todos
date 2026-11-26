// ── Focus helpers ──────────────────────────────────────────

// Focus was dropped (its element went away) rather than moved by the user
const focusLost = () => !document.activeElement || document.activeElement === document.body

// Return focus to a task's title button after closing the detail panel or
// renaming — but only if focus was lost, never if the user already moved on.
export const focusTaskRow = (id) => {
  requestAnimationFrame(() => {
    if (!focusLost()) return
    document.querySelector(`[data-task-id="${CSS.escape(id)}"] .task-title`)?.focus()
  })
}

// Move focus into the detail panel's title field
export const focusTaskDetail = () => {
  requestAnimationFrame(() => document.getElementById('task-detail-title')?.focus())
}

// Move focus to the detail panel heading (narrow screens: no on-screen keyboard)
export const focusTaskDetailHeading = () => {
  requestAnimationFrame(() => document.getElementById('task-detail-heading')?.focus())
}

// ↑/↓/Home/End between task title buttons inside a container
export const moveTaskFocus = (e) => {
  if (!e.target.classList?.contains('task-title')) return
  const keys = { ArrowDown: 1, ArrowUp: -1, Home: 'first', End: 'last' }
  if (!(e.key in keys)) return
  const all = [...e.currentTarget.querySelectorAll('.task-title')]
  const i = all.indexOf(e.target)
  const k = keys[e.key]
  const next = k === 'first' ? all[0] : k === 'last' ? all[all.length - 1] : all[i + k]
  if (next) { e.preventDefault(); next.focus() }
}
