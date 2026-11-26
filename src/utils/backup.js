// ── Backup format: build and validate ──────────────────────
// A backup is one JSON file: a small manifest, the settings, and every
// store. Restoring validates first and says plainly what is wrong.

export const BACKUP_FORMAT = 'todos-backup'
export const BACKUP_VERSION = 2

export const makeBackup = (data, settings) => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  app: 'Todos',
  exportedAt: new Date().toISOString(),
  counts: { tasks: data.tasks.length, projects: data.projects.length, tags: data.tags.length },
  settings,
  tasks: data.tasks,
  projects: data.projects,
  tags: data.tags,
  history: data.history ?? [],
  trash: data.trash ?? [],
})

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v)

const checkList = (list, kind, required) => {
  if (list == null) return null
  if (!Array.isArray(list)) return `The ${kind} list in this backup is damaged.`
  const seen = new Set()
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (!isObj(item)) return `${kind[0].toUpperCase()}${kind.slice(1, -1)} ${i + 1} in this backup is damaged.`
    for (const [key, type] of required) {
      if (typeof item[key] !== type) return `${kind[0].toUpperCase()}${kind.slice(1, -1)} ${i + 1} is missing its ${key}.`
    }
    if (seen.has(item.id)) return `Two ${kind} in this backup share the id “${item.id}”.`
    seen.add(item.id)
  }
  return null
}

// Returns { ok: true, data, settings } or { ok: false, error }
export const validateBackup = (raw) => {
  if (!isObj(raw)) return { ok: false, error: 'This file doesn’t contain a Todos backup.' }
  if (raw.format != null && raw.format !== BACKUP_FORMAT) return { ok: false, error: 'This is a backup from a different app.' }
  if (typeof raw.version === 'number' && raw.version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of Todos. Reload the page to update, then try again.' }
  }
  if (!Array.isArray(raw.tasks)) return { ok: false, error: 'This file has no task list, so it isn’t a Todos backup.' }
  const problem =
    checkList(raw.tasks, 'tasks', [['id', 'string'], ['title', 'string']]) ??
    checkList(raw.projects, 'projects', [['id', 'string'], ['name', 'string']]) ??
    checkList(raw.tags, 'tags', [['id', 'string'], ['name', 'string']])
  if (problem) return { ok: false, error: problem }
  if (raw.history != null && !Array.isArray(raw.history)) return { ok: false, error: 'The activity history in this backup is damaged.' }
  if (raw.trash != null && (!Array.isArray(raw.trash) || raw.trash.some(e => !isObj(e) || typeof e.id !== 'string' || !isObj(e.task)))) {
    return { ok: false, error: 'The trash in this backup is damaged.' }
  }
  return {
    ok: true,
    data: { tasks: raw.tasks, projects: raw.projects ?? [], tags: raw.tags ?? [], history: raw.history ?? [], trash: raw.trash ?? [] },
    settings: isObj(raw.settings) ? raw.settings : null,
  }
}
