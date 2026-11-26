// ── IndexedDB setup ────────────────────────────────────────
import { openDB } from 'idb'
import { announceChange } from './sync.js'

const DB_NAME = 'todos-db'
const DB_VERSION = 3
export const TRASH_DAYS = 30
const MAX_SNAPSHOTS = 5

let _db = null

export const getDB = async () => {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const tasks = db.createObjectStore('tasks', { keyPath: 'id' })
        tasks.createIndex('projectId', 'projectId')
        tasks.createIndex('dueDate', 'dueDate')
        tasks.createIndex('completed', 'completed')
        tasks.createIndex('parentId', 'parentId')
        tasks.createIndex('tags', 'tags', { multiEntry: true })
        db.createObjectStore('projects', { keyPath: 'id' })
        db.createObjectStore('tags', { keyPath: 'id' })
        const history = db.createObjectStore('history', { keyPath: 'id' })
        history.createIndex('taskId', 'taskId')
      }
      if (oldVersion < 2) {
        // Whole-workspace snapshots taken before risky operations (restore, clear)
        db.createObjectStore('snapshots', { keyPath: 'id' })
      }
      if (oldVersion < 3) {
        // Deleted tasks, kept for TRASH_DAYS: { id, task, deletedAt, batch }
        db.createObjectStore('trash', { keyPath: 'id' })
      }
    },
    blocking() {
      // Another tab needs a newer schema: let it upgrade
      _db?.close(); _db = null
    },
  })
  return _db
}

// ── Task helpers ───────────────────────────────────────────
export const getTasks = async () => {
  const db = await getDB()
  return db.getAll('tasks')
}

export const getTask = async (id) => {
  const db = await getDB()
  return db.get('tasks', id)
}

export const putTask = async (task) => {
  const db = await getDB()
  await db.put('tasks', { ...task, updatedAt: task.updatedAt ?? Date.now() })
  announceChange()
}

export const putTasks = async (tasks) => {
  const db = await getDB()
  const tx = db.transaction('tasks', 'readwrite')
  await Promise.all([...tasks.map(t => tx.store.put(t)), tx.done])
  announceChange()
}

export const deleteTasks = async (ids) => {
  const db = await getDB()
  const tx = db.transaction('tasks', 'readwrite')
  await Promise.all([...ids.map(id => tx.store.delete(id)), tx.done])
  announceChange()
}

export const deleteTask = async (id) => {
  const db = await getDB()
  await db.delete('tasks', id)
  announceChange()
}

// ── Project helpers ────────────────────────────────────────
export const getProjects = async () => {
  const db = await getDB()
  return db.getAll('projects')
}

export const putProject = async (project) => {
  const db = await getDB()
  await db.put('projects', project)
  announceChange()
}

export const deleteProject = async (id) => {
  const db = await getDB()
  await db.delete('projects', id)
  announceChange()
}

// ── Tag helpers ────────────────────────────────────────────
export const getTags = async () => {
  const db = await getDB()
  return db.getAll('tags')
}

export const putTag = async (tag) => {
  const db = await getDB()
  await db.put('tags', tag)
  announceChange()
}

export const deleteTag = async (id) => {
  const db = await getDB()
  await db.delete('tags', id)
  announceChange()
}

// ── History helpers ────────────────────────────────────────
export const addHistory = async (entry) => {
  const db = await getDB()
  await db.put('history', entry)
}

export const getTaskHistory = async (taskId) => {
  const db = await getDB()
  const idx = db.transaction('history').store.index('taskId')
  return idx.getAll(taskId)
}

// ── Full export ────────────────────────────────────────────
export const exportAll = async () => {
  const db = await getDB()
  const [tasks, projects, tags, history, trash] = await Promise.all([
    db.getAll('tasks'),
    db.getAll('projects'),
    db.getAll('tags'),
    db.getAll('history'),
    db.getAll('trash'),
  ])
  return { tasks, projects, tags, history, trash, exportedAt: Date.now() }
}

export const importAll = async (data) => {
  const db = await getDB()
  const stores = ['tasks', 'projects', 'tags', 'history', 'trash']
  const tx = db.transaction(stores, 'readwrite')
  await Promise.all(stores.map(st => tx.objectStore(st).clear()))
  await Promise.all([
    ...(data.tasks || []).map(t => tx.objectStore('tasks').put(t)),
    ...(data.projects || []).map(p => tx.objectStore('projects').put(p)),
    ...(data.tags || []).map(t => tx.objectStore('tags').put(t)),
    ...(data.history || []).map(h => tx.objectStore('history').put(h)),
    ...(data.trash || []).map(t => tx.objectStore('trash').put(t)),
  ])
  await tx.done
  announceChange()
}

// ── Snapshots (kept before risky operations) ───────────────
export const saveSnapshot = async (reason, data) => {
  const db = await getDB()
  const snap = { id: `snap-${Date.now()}`, reason, createdAt: Date.now(), counts: { tasks: data.tasks?.length ?? 0 }, data }
  await db.put('snapshots', snap)
  const all = (await db.getAll('snapshots')).sort((a, b) => b.createdAt - a.createdAt)
  await Promise.all(all.slice(MAX_SNAPSHOTS).map(x => db.delete('snapshots', x.id)))
  return snap
}

export const getSnapshots = async () => {
  const db = await getDB()
  return (await db.getAll('snapshots')).sort((a, b) => b.createdAt - a.createdAt)
}

// ── Trash ──────────────────────────────────────────────────
export const getTrash = async () => {
  const db = await getDB()
  return (await db.getAll('trash')).sort((a, b) => b.deletedAt - a.deletedAt)
}

// Move tasks into the trash (one transaction: tasks out, trash in)
export const trashTasks = async (tasks, batch, deletedAt = Date.now()) => {
  const db = await getDB()
  const tx = db.transaction(['tasks', 'trash'], 'readwrite')
  await Promise.all([
    ...tasks.map(t => tx.objectStore('tasks').delete(t.id)),
    ...tasks.map(t => tx.objectStore('trash').put({ id: t.id, task: t, deletedAt, batch })),
    tx.done,
  ])
  announceChange()
}

// Move tasks back out of the trash
export const untrashTasks = async (tasks) => {
  const db = await getDB()
  const tx = db.transaction(['tasks', 'trash'], 'readwrite')
  await Promise.all([
    ...tasks.map(t => tx.objectStore('trash').delete(t.id)),
    ...tasks.map(t => tx.objectStore('tasks').put(t)),
    tx.done,
  ])
  announceChange()
}

export const putTrash = async (entries) => {
  const db = await getDB()
  const tx = db.transaction('trash', 'readwrite')
  await Promise.all([...entries.map(e => tx.store.put(e)), tx.done])
  announceChange()
}

export const deleteFromTrash = async (ids) => {
  const db = await getDB()
  const tx = db.transaction('trash', 'readwrite')
  await Promise.all([...ids.map(id => tx.store.delete(id)), tx.done])
  announceChange()
}

// Drop entries older than TRASH_DAYS; returns how many were removed
export const purgeTrash = async (now = Date.now()) => {
  const old = (await getTrash()).filter(e => now - e.deletedAt > TRASH_DAYS * 86400000)
  if (old.length) await deleteFromTrash(old.map(e => e.id))
  return old.length
}
