import { todayISO } from './dates.js'
// ── Export utilities ───────────────────────────────────────

export const exportJSON = (data) => {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `todos-backup-${todayISO()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const exportCSV = (tasks, projects, tags) => {
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))
  const tagMap = Object.fromEntries(tags.map(t => [t.id, t.name]))

  const PRIORITY_LABELS = ['none','low','medium','high']

  const headers = ['Title','Project','Tags','Due Date','Priority','Completed','Time Tracked (min)']

  const rows = tasks.map(t => [
    `"${(t.title || '').replace(/"/g, '""')}"`,
    `"${t.projectId ? (projectMap[t.projectId] || '') : ''}"`,
    `"${(t.tags || []).map(id => tagMap[id] || id).join(', ')}"`,
    t.dueDate || '',
    PRIORITY_LABELS[t.priority] || 'none',
    t.completed ? 'yes' : 'no',
    Math.round((t.timeTracked || 0) / 60000),
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `todos-export-${todayISO()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
