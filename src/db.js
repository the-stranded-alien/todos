// ── IndexedDB setup ────────────────────────────────────────
import { openDB } from 'idb'

const DB_NAME = 'todos-db'
const DB_VERSION = 1

let _db = null

export const getDB = async () => {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // tasks
      const tasks = db.createObjectStore('tasks', { keyPath: 'id' })
      tasks.createIndex('projectId', 'projectId')
      tasks.createIndex('dueDate', 'dueDate')
      tasks.createIndex('completed', 'completed')
      tasks.createIndex('parentId', 'parentId')
      tasks.createIndex('tags', 'tags', { multiEntry: true })

      // projects
      db.createObjectStore('projects', { keyPath: 'id' })

      // tags
      db.createObjectStore('tags', { keyPath: 'id' })

      // history
      const history = db.createObjectStore('history', { keyPath: 'id' })
      history.createIndex('taskId', 'taskId')
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
  await db.put('tasks', { ...task, updatedAt: Date.now() })
}

export const deleteTask = async (id) => {
  const db = await getDB()
  await db.delete('tasks', id)
}

// ── Project helpers ────────────────────────────────────────
export const getProjects = async () => {
  const db = await getDB()
  return db.getAll('projects')
}

export const putProject = async (project) => {
  const db = await getDB()
  await db.put('projects', project)
}

export const deleteProject = async (id) => {
  const db = await getDB()
  await db.delete('projects', id)
}

// ── Tag helpers ────────────────────────────────────────────
export const getTags = async () => {
  const db = await getDB()
  return db.getAll('tags')
}

export const putTag = async (tag) => {
  const db = await getDB()
  await db.put('tags', tag)
}

export const deleteTag = async (id) => {
  const db = await getDB()
  await db.delete('tags', id)
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
  const [tasks, projects, tags, history] = await Promise.all([
    db.getAll('tasks'),
    db.getAll('projects'),
    db.getAll('tags'),
    db.getAll('history'),
  ])
  return { tasks, projects, tags, history, exportedAt: Date.now() }
}

export const importAll = async (data) => {
  const db = await getDB()
  const tx = db.transaction(['tasks','projects','tags','history'], 'readwrite')
  for (const store of ['tasks','projects','tags','history']) {
    await tx.objectStore(store).clear()
  }
  for (const task of data.tasks || []) await tx.objectStore('tasks').put(task)
  for (const p of data.projects || []) await tx.objectStore('projects').put(p)
  for (const t of data.tags || []) await tx.objectStore('tags').put(t)
  for (const h of data.history || []) await tx.objectStore('history').put(h)
  await tx.done
}
