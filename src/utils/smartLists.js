// ── Smart lists: saved rules that select tasks ─────────────
import { todayISO, addDaysISO } from './dates.js'

export const EMPTY_RULES = {
  text: '',             // words in the name or notes
  projectIds: [],       // any of these ('inbox' = no project)
  tagIds: [],
  tagMode: 'any',       // 'any' | 'all'
  priorities: [],       // any of 0–3
  due: 'any',           // any | overdue | today | week | none | has
  hasNotes: false,
  hasTime: false,       // has tracked time
  includeCompleted: false,
}

export const DUE_OPTIONS = [
  ['any', 'Any time'], ['overdue', 'Overdue'], ['today', 'Due today or earlier'],
  ['week', 'Due in the next 7 days'], ['has', 'Has a due date'], ['none', 'No due date'],
]

export const matchesRules = (task, rules, now = new Date()) => {
  const r = { ...EMPTY_RULES, ...rules }
  if (!r.includeCompleted && task.completed) return false
  if (r.text) {
    const q = r.text.toLowerCase()
    if (!`${task.title} ${task.notes || ''}`.toLowerCase().includes(q)) return false
  }
  if (r.projectIds.length && !r.projectIds.includes(task.projectId ?? 'inbox')) return false
  if (r.tagIds.length) {
    const tags = task.tags || []
    const ok = r.tagMode === 'all' ? r.tagIds.every(t => tags.includes(t)) : r.tagIds.some(t => tags.includes(t))
    if (!ok) return false
  }
  if (r.priorities.length && !r.priorities.includes(task.priority ?? 0)) return false
  const today = todayISO(now)
  const d = task.dueDate
  switch (r.due) {
    case 'overdue': if (!d || d >= today || task.completed) return false; break
    case 'today': if (!d || d > today) return false; break
    case 'week': if (!d || d < today || d > addDaysISO(7, now)) return false; break
    case 'has': if (!d) return false; break
    case 'none': if (d) return false; break
    default: break
  }
  if (r.hasNotes && !(task.notes || '').trim()) return false
  if (r.hasTime && !(task.timeTracked > 0 || task.timerStartedAt != null)) return false
  return true
}

// Build rules from the list view's current search and filters
export const rulesFromFilters = (filters, searchQuery) => ({
  ...EMPTY_RULES,
  text: searchQuery || '',
  priorities: filters.priority != null ? [filters.priority] : [],
  tagIds: filters.tagId ? [filters.tagId] : [],
  projectIds: filters.projectId ? [filters.projectId] : [],
  due: filters.overdue ? 'overdue' : filters.hasDueDate ? 'has' : 'any',
})

// Short human summary, e.g. "High priority · #urgent · Overdue"
export const describeRules = (rules, { projects = [], tags = [] } = {}) => {
  const r = { ...EMPTY_RULES, ...rules }
  const parts = []
  if (r.text) parts.push(`“${r.text}”`)
  if (r.projectIds.length) parts.push(r.projectIds.map(id => id === 'inbox' ? 'Inbox' : projects.find(p => p.id === id)?.name ?? '?').join(' or '))
  if (r.tagIds.length) parts.push(r.tagIds.map(id => `#${tags.find(t => t.id === id)?.name ?? '?'}`).join(r.tagMode === 'all' ? ' and ' : ' or '))
  if (r.priorities.length) parts.push(r.priorities.map(p => ['No', 'Low', 'Medium', 'High'][p]).join('/') + ' priority')
  if (r.due !== 'any') parts.push(DUE_OPTIONS.find(([v]) => v === r.due)?.[1])
  if (r.hasNotes) parts.push('Has notes')
  if (r.hasTime) parts.push('Has tracked time')
  if (r.includeCompleted) parts.push('Includes completed')
  return parts.join(' · ') || 'All open tasks'
}
