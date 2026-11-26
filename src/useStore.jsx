// ── Global state store ─────────────────────────────────────
// IndexedDB is the source of truth. Every action reads the current record
// from IndexedDB (never from a render closure), writes it, then updates
// React state. Every destructive action is undoable; multi-step actions
// become one undo step; rapid edits to one field coalesce into one step.
import { useReducer, useCallback, useRef, useEffect } from 'react'
import { StoreContext } from './store/context.js'
import { parseLocalISO, toLocalISO } from './utils/dates.js'
import { DEFAULT_SWATCH } from './utils/colors.js'
import { nanoid } from './utils/nanoid.js'
import { onRemoteChange } from './sync.js'
import { getPrefs } from './prefs.js'
import * as db from './db.js'
import { addHistory } from './db.js'

// ── Initial state ──────────────────────────────────────────
const initialState = {
  tasks: [],
  projects: [],
  tags: [],
  trash: [],             // [{ id, task, deletedAt, batch }]
  lists: [],             // smart lists
  loading: true,
  view: 'inbox',         // inbox|today|upcoming|all|completed|calendar|stats|project:id|tag:id
  selectedTaskId: null,
  searchQuery: '',
  filters: {
    priority: null,      // 0-3 or null
    tagId: null,
    projectId: null,
    hasDueDate: false,
    overdue: false,
  },
  sortBy: 'order',       // order|dueDate|priority|createdAt|title
  sidebarOpen: true,
  detailOpen: false,
  bulkSelected: new Set(),
  activeTimerTaskId: null,
}

const upsert = (list, items) => {
  const byId = new Map(items.map(t => [t.id, t]))
  const out = list.map(t => byId.get(t.id) ?? t)
  for (const t of items) if (!list.some(x => x.id === t.id)) out.push(t)
  return out
}

// ── Reducer ────────────────────────────────────────────────
const reducer = (state, action) => {
  switch (action.type) {
    case 'LOAD': return { ...state, ...action.payload, loading: false }

    // Data replaced from IndexedDB (restore, another tab): keep UI state valid
    case 'SYNC': {
      const { tasks, projects, tags, trash = state.trash, lists = state.lists } = action
      const ids = new Set(tasks.map(t => t.id))
      const selectedGone = state.selectedTaskId && !ids.has(state.selectedTaskId)
      const viewGone = (state.view.startsWith('list:') && !lists.some(l => `list:${l.id}` === state.view))
        || (state.view.startsWith('project:') && !projects.some(p => `project:${p.id}` === state.view))
        || (state.view.startsWith('tag:') && !tags.some(t => `tag:${t.id}` === state.view))
      return {
        ...state,
        tasks, projects, tags, trash, lists,
        activeTimerTaskId: tasks.find(t => t.timerStartedAt != null)?.id ?? null,
        selectedTaskId: selectedGone ? null : state.selectedTaskId,
        detailOpen: selectedGone ? false : state.detailOpen,
        view: viewGone ? 'inbox' : state.view,
        bulkSelected: new Set([...state.bulkSelected].filter(id => ids.has(id))),
      }
    }

    case 'ADD_TASK': return { ...state, tasks: [...state.tasks, action.task] }
    case 'UPDATE_TASK': return { ...state, tasks: state.tasks.map(t => t.id === action.task.id ? action.task : t) }
    case 'UPSERT_TASKS': return { ...state, tasks: upsert(state.tasks, action.tasks) }
    case 'REMOVE_TASKS': {
      const ids = new Set(action.ids)
      const hit = ids.has(state.selectedTaskId)
      return {
        ...state,
        tasks: state.tasks.filter(t => !ids.has(t.id)),
        selectedTaskId: hit ? null : state.selectedTaskId,
        detailOpen: hit ? false : state.detailOpen,
        bulkSelected: new Set([...state.bulkSelected].filter(id => !ids.has(id))),
      }
    }
    case 'SET_TASKS': return { ...state, tasks: action.tasks }
    case 'SET_TRASH': return { ...state, trash: action.trash }
    case 'UPSERT_LIST': return { ...state, lists: upsert(state.lists, [action.list]) }
    case 'REMOVE_LIST': return {
      ...state,
      lists: state.lists.filter(l => l.id !== action.id),
      view: state.view === `list:${action.id}` ? 'inbox' : state.view,
    }

    case 'UPSERT_PROJECT': return { ...state, projects: upsert(state.projects, [action.project]) }
    case 'REMOVE_PROJECT': return {
      ...state,
      projects: state.projects.filter(p => p.id !== action.id),
      view: state.view === `project:${action.id}` ? 'inbox' : state.view,
    }
    case 'UPSERT_TAG': return { ...state, tags: upsert(state.tags, [action.tag]) }
    case 'REMOVE_TAG': return {
      ...state,
      tags: state.tags.filter(t => t.id !== action.id),
      view: state.view === `tag:${action.id}` ? 'inbox' : state.view,
      filters: state.filters.tagId === action.id ? { ...state.filters, tagId: null } : state.filters,
    }

    case 'SET_VIEW': return {
      ...state,
      view: action.view,
      selectedTaskId: null,
      detailOpen: false,
      bulkSelected: new Set(),
    }
    case 'SELECT_TASK': return { ...state, selectedTaskId: action.id, detailOpen: action.id != null }
    case 'CLOSE_DETAIL': return { ...state, detailOpen: false, selectedTaskId: null }
    case 'SET_SEARCH': return { ...state, searchQuery: action.query }
    case 'SET_FILTER': return { ...state, filters: { ...state.filters, ...action.filters } }
    case 'CLEAR_FILTERS': return { ...state, filters: initialState.filters }
    case 'SET_SORT': return { ...state, sortBy: action.sortBy }
    case 'TOGGLE_SIDEBAR': return { ...state, sidebarOpen: !state.sidebarOpen }
    case 'TOGGLE_BULK': {
      const next = new Set(state.bulkSelected)
      if (next.has(action.id)) next.delete(action.id)
      else next.add(action.id)
      return { ...state, bulkSelected: next }
    }
    case 'CLEAR_BULK': return { ...state, bulkSelected: new Set() }
    case 'SET_BULK': return { ...state, bulkSelected: action.ids }
    case 'SET_ACTIVE_TIMER': return { ...state, activeTimerTaskId: action.taskId }

    default: return state
  }
}

// ── Undo/Redo ──────────────────────────────────────────────
const MAX_UNDO = 50
const COALESCE_MS = 2000

// All descendants of a task (subtasks, their subtasks…)
const withDescendants = (all, rootId) => {
  const out = []
  const queue = [rootId]
  while (queue.length) {
    const id = queue.shift()
    const t = all.find(x => x.id === id)
    if (!t) continue
    out.push(t)
    for (const c of all) if (c.parentId === id) queue.push(c.id)
  }
  return out
}

const getNextDueDate = (dueDateStr, recurring) => {
  const d = parseLocalISO(dueDateStr)
  const { freq, interval = 1 } = recurring
  if (freq === 'daily') d.setDate(d.getDate() + interval)
  else if (freq === 'weekly') d.setDate(d.getDate() + 7 * interval)
  else if (freq === 'monthly') d.setMonth(d.getMonth() + interval)
  return toLocalISO(d)
}

const history = (taskId, action, diff) =>
  addHistory({ id: nanoid(), taskId, action, diff, timestamp: Date.now() })

// ── Provider ───────────────────────────────────────────────
export const StoreProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState, (s) => ({ ...s, view: getPrefs().defaultView || 'inbox' }))
  const undoStack = useRef([])
  const redoStack = useRef([])
  const group = useRef(null)

  const reloadAll = useCallback(async () => {
    const [tasks, projects, tags, trash, lists] = await Promise.all([db.getTasks(), db.getProjects(), db.getTags(), db.getTrash(), db.getLists()])
    dispatch({ type: 'SYNC', tasks, projects, tags, trash, lists })
  }, [])

  // Load on mount
  useEffect(() => {
    let alive = true
    ;(async () => {
      await db.purgeTrash()
      const [tasks, projects, tags, trash, lists] = await Promise.all([db.getTasks(), db.getProjects(), db.getTags(), db.getTrash(), db.getLists()])
      if (!alive) return
      const activeTimer = tasks.find(t => t.timerStartedAt != null)
      dispatch({ type: 'LOAD', payload: { tasks, projects, tags, trash, lists, activeTimerTaskId: activeTimer?.id ?? null } })
    })()
    return () => { alive = false }
  }, [])

  // Another tab changed the data: reload from IndexedDB (debounced)
  useEffect(() => {
    let t = 0
    const off = onRemoteChange(() => { clearTimeout(t); t = setTimeout(reloadAll, 80) })
    return () => { clearTimeout(t); off() }
  }, [reloadAll])

  // ── Undo plumbing ─────────────────────────────────────────
  const pushEntry = (entry) => {
    undoStack.current.push(entry)
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
    redoStack.current = []
  }

  const pushUndo = useCallback((undoFn, redoFn, coalesce) => {
    const entry = { undo: undoFn, redo: redoFn, coalesce, at: Date.now() }
    if (group.current) { group.current.push(entry); return }
    const top = undoStack.current[undoStack.current.length - 1]
    if (coalesce && top?.coalesce === coalesce && entry.at - top.at < COALESCE_MS) {
      top.redo = redoFn // keep the original undo, extend the redo
      top.at = entry.at
      redoStack.current = []
      return
    }
    pushEntry(entry)
  }, [])

  // Run several actions as one undo step
  const grouped = useCallback(async (fn) => {
    if (group.current) return fn()
    group.current = []
    try {
      return await fn()
    } finally {
      const entries = group.current
      group.current = null
      if (entries.length) {
        pushEntry({
          undo: async () => { for (const e of [...entries].reverse()) await e.undo() },
          redo: async () => { for (const e of entries) await e.redo() },
          at: Date.now(),
        })
      }
    }
  }, [])

  const undo = useCallback(async () => {
    const entry = undoStack.current.pop()
    if (!entry) return false
    await entry.undo()
    redoStack.current.push(entry)
    return true
  }, [])

  const redo = useCallback(async () => {
    const entry = redoStack.current.pop()
    if (!entry) return false
    await entry.redo()
    undoStack.current.push(entry)
    return true
  }, [])

  // ── Low-level writes (no undo) ───────────────────────────
  const writeTasks = useCallback(async (tasks) => {
    await db.putTasks(tasks)
    dispatch({ type: 'UPSERT_TASKS', tasks })
  }, [])
  const removeTasks = useCallback(async (ids) => {
    await db.deleteTasks(ids)
    dispatch({ type: 'REMOVE_TASKS', ids })
  }, [])

  // ── Task actions ─────────────────────────────────────────

  const createTask = useCallback(async (fields) => {
    const now = Date.now()
    const task = {
      id: nanoid(),
      title: '',
      notes: '',
      completed: false,
      completedAt: null,
      projectId: null,
      parentId: null,
      priority: 0,
      tags: [],
      dueDate: null,
      dueTime: null,
      recurring: null,
      order: now,
      timeTracked: 0,
      timerStartedAt: null,
      ...fields,
      createdAt: now,
      updatedAt: now,
    }
    await writeTasks([task])
    await history(task.id, 'created', { after: task })
    pushUndo(() => removeTasks([task.id]), () => writeTasks([task]))
    return task
  }, [pushUndo, writeTasks, removeTasks])

  // opts.coalesce: rapid edits with the same key become one undo step
  const updateTask = useCallback(async (id, changes, opts = {}) => {
    const prev = await db.getTask(id)
    if (!prev) return
    const next = { ...prev, ...changes, updatedAt: Date.now() }
    await writeTasks([next])
    if (!opts.silent) await history(id, 'updated', { before: Object.fromEntries(Object.keys(changes).map(k => [k, prev[k]])), after: changes })
    pushUndo(() => writeTasks([prev]), () => writeTasks([next]), opts.coalesce ? `${id}:${opts.coalesce}` : undefined)
    return next
  }, [pushUndo, writeTasks])

  const completeTask = useCallback((id) => grouped(async () => {
    const task = await db.getTask(id)
    if (!task || task.completed) return
    const now = Date.now()
    const next = { ...task, completed: true, completedAt: now, updatedAt: now }
    if (next.timerStartedAt != null) {
      next.timeTracked = (next.timeTracked || 0) + (now - next.timerStartedAt)
      next.timerStartedAt = null
      dispatch({ type: 'SET_ACTIVE_TIMER', taskId: null })
    }
    await writeTasks([next])
    await history(id, 'completed', { before: { completed: false }, after: { completed: true } })
    pushUndo(() => writeTasks([task]), () => writeTasks([next]))

    // Recurring: create the next occurrence (same undo step)
    if (task.recurring && task.dueDate) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = task
      await createTask({
        ...rest,
        completed: false,
        completedAt: null,
        dueDate: getNextDueDate(task.dueDate, task.recurring),
        timeTracked: 0,
        timerStartedAt: null,
        order: now + 1,
      })
    }
  }), [grouped, pushUndo, writeTasks, createTask])

  const uncompleteTask = useCallback(async (id) => {
    const task = await db.getTask(id)
    if (!task || !task.completed) return
    const next = { ...task, completed: false, completedAt: null, updatedAt: Date.now() }
    await writeTasks([next])
    await history(id, 'reopened', { before: { completed: true }, after: { completed: false } })
    pushUndo(() => writeTasks([task]), () => writeTasks([next]))
  }, [pushUndo, writeTasks])

  const refreshTrash = useCallback(async () => dispatch({ type: 'SET_TRASH', trash: await db.getTrash() }), [])

  // Moves the task and all of its subtasks to the trash (one batch);
  // undo brings them all back
  const deleteTask = useCallback(async (id) => {
    const all = await db.getTasks()
    const doomed = withDescendants(all, id)
    if (!doomed.length) return 0
    const ids = doomed.map(t => t.id)
    if (doomed.some(t => t.timerStartedAt != null)) dispatch({ type: 'SET_ACTIVE_TIMER', taskId: null })
    const stopped = doomed.map(t => (t.timerStartedAt != null ? { ...t, timeTracked: (t.timeTracked || 0) + (Date.now() - t.timerStartedAt), timerStartedAt: null } : t))
    const batch = nanoid(8)
    await db.trashTasks(stopped, batch)
    dispatch({ type: 'REMOVE_TASKS', ids })
    await refreshTrash()
    await history(id, 'deleted', { before: doomed[0], subtasks: ids.length - 1 })
    pushUndo(
      async () => { await db.untrashTasks(doomed); dispatch({ type: 'UPSERT_TASKS', tasks: doomed }); await refreshTrash() },
      async () => { await db.trashTasks(stopped, batch); dispatch({ type: 'REMOVE_TASKS', ids }); await refreshTrash() },
    )
    return ids.length
  }, [pushUndo, refreshTrash])

  // Restore a trashed task with everything deleted alongside it
  const restoreFromTrash = useCallback(async (entryId) => {
    const all = await db.getTrash()
    const entry = all.find(e => e.id === entryId)
    if (!entry) return 0
    const group = all.filter(e => e.batch && e.batch === entry.batch)
    const entries = group.length ? group : [entry]
    const live = new Set((await db.getTasks()).map(t => t.id))
    const ids = new Set(entries.map(e => e.id))
    // A subtask whose parent is gone for good comes back as a top-level task
    const tasks = entries.map(e => (e.task.parentId && !live.has(e.task.parentId) && !ids.has(e.task.parentId) ? { ...e.task, parentId: null } : e.task))
    await db.untrashTasks(tasks)
    dispatch({ type: 'UPSERT_TASKS', tasks })
    await refreshTrash()
    pushUndo(
      async () => { await db.trashTasks(tasks, entry.batch, entry.deletedAt); dispatch({ type: 'REMOVE_TASKS', ids: [...ids] }); await refreshTrash() },
      async () => { await db.untrashTasks(tasks); dispatch({ type: 'UPSERT_TASKS', tasks }); await refreshTrash() },
    )
    return tasks.length
  }, [pushUndo, refreshTrash])

  // Delete for good (entries can still be put back with Undo this session)
  const deletePermanently = useCallback(async (entryIds) => {
    const entries = (await db.getTrash()).filter(e => entryIds.includes(e.id))
    if (!entries.length) return 0
    await db.deleteFromTrash(entries.map(e => e.id))
    await refreshTrash()
    pushUndo(
      async () => { await db.putTrash(entries); await refreshTrash() },
      async () => { await db.deleteFromTrash(entries.map(e => e.id)); await refreshTrash() },
    )
    return entries.length
  }, [pushUndo, refreshTrash])

  const emptyTrash = useCallback(async () => deletePermanently((await db.getTrash()).map(e => e.id)), [deletePermanently])

  // ── Smart lists ──────────────────────────────────────────
  const putList = useCallback(async (list) => { await db.putList(list); dispatch({ type: 'UPSERT_LIST', list }) }, [])
  const removeList = useCallback(async (id) => { await db.deleteList(id); dispatch({ type: 'REMOVE_LIST', id }) }, [])

  const createList = useCallback(async (fields) => {
    const list = { id: nanoid(), name: 'Smart list', color: DEFAULT_SWATCH, rules: {}, sortBy: 'order', order: Date.now(), createdAt: Date.now(), ...fields }
    await putList(list)
    pushUndo(() => removeList(list.id), () => putList(list))
    return list
  }, [putList, removeList, pushUndo])

  const updateList = useCallback(async (id, changes) => {
    const prev = (await db.getLists()).find(l => l.id === id)
    if (!prev) return
    const next = { ...prev, ...changes }
    await putList(next)
    pushUndo(() => putList(prev), () => putList(next))
  }, [putList, pushUndo])

  const deleteList = useCallback(async (id) => {
    const prev = (await db.getLists()).find(l => l.id === id)
    if (!prev) return
    await removeList(id)
    pushUndo(() => putList(prev), () => removeList(id))
  }, [putList, removeList, pushUndo])

  // Restore a task's fields to how they were before a recorded change
  const restoreVersion = useCallback(async (taskId, fields) => updateTask(taskId, fields), [updateTask])

  const reorderTasks = useCallback(async (orderedIds) => {
    const all = await db.getTasks()
    const prev = all.filter(t => orderedIds.includes(t.id))
    const next = prev.map(t => ({ ...t, order: orderedIds.indexOf(t.id) * 1000 }))
    await writeTasks(next)
    pushUndo(() => writeTasks(prev), () => writeTasks(next))
  }, [pushUndo, writeTasks])

  // ── Timers (not part of undo) ────────────────────────────

  const stopTimer = useCallback(async (id) => {
    const task = await db.getTask(id)
    if (!task || task.timerStartedAt == null) return
    const now = Date.now()
    await writeTasks([{ ...task, timeTracked: (task.timeTracked || 0) + (now - task.timerStartedAt), timerStartedAt: null, updatedAt: now }])
    dispatch({ type: 'SET_ACTIVE_TIMER', taskId: null })
  }, [writeTasks])

  const startTimer = useCallback(async (id) => {
    const running = (await db.getTasks()).filter(t => t.timerStartedAt != null && t.id !== id)
    for (const t of running) await stopTimer(t.id)
    const task = await db.getTask(id)
    if (!task) return
    const now = Date.now()
    await writeTasks([{ ...task, timerStartedAt: now, updatedAt: now }])
    dispatch({ type: 'SET_ACTIVE_TIMER', taskId: id })
  }, [writeTasks, stopTimer])

  // ── Projects ─────────────────────────────────────────────

  const putProject = useCallback(async (project) => {
    await db.putProject(project)
    dispatch({ type: 'UPSERT_PROJECT', project })
  }, [])

  const createProject = useCallback(async (fields) => {
    const project = { id: nanoid(), name: 'New project', color: DEFAULT_SWATCH, icon: 'Folder', order: Date.now(), createdAt: Date.now(), ...fields }
    await putProject(project)
    pushUndo(async () => { await db.deleteProject(project.id); dispatch({ type: 'REMOVE_PROJECT', id: project.id }) }, () => putProject(project))
    return project
  }, [putProject, pushUndo])

  const updateProject = useCallback(async (id, changes) => {
    const prev = (await db.getProjects()).find(p => p.id === id)
    if (!prev) return
    const next = { ...prev, ...changes }
    await putProject(next)
    pushUndo(() => putProject(prev), () => putProject(next))
  }, [putProject, pushUndo])

  // Tasks move to the Inbox; undo restores the project and every task
  const deleteProject = useCallback((id) => grouped(async () => {
    const project = (await db.getProjects()).find(p => p.id === id)
    if (!project) return 0
    const moved = (await db.getTasks()).filter(t => t.projectId === id)
    const inbox = moved.map(t => ({ ...t, projectId: null, updatedAt: Date.now() }))
    await db.deleteProject(id)
    dispatch({ type: 'REMOVE_PROJECT', id })
    if (inbox.length) await writeTasks(inbox)
    pushUndo(
      async () => { await putProject(project); if (moved.length) await writeTasks(moved) },
      async () => { await db.deleteProject(id); dispatch({ type: 'REMOVE_PROJECT', id }); if (inbox.length) await writeTasks(inbox) },
    )
    return moved.length
  }), [grouped, pushUndo, putProject, writeTasks])

  // ── Tags ─────────────────────────────────────────────────

  const putTag = useCallback(async (tag) => {
    await db.putTag(tag)
    dispatch({ type: 'UPSERT_TAG', tag })
  }, [])

  const createTag = useCallback(async (fields) => {
    const tag = { id: nanoid(), name: 'new-tag', color: DEFAULT_SWATCH, createdAt: Date.now(), ...fields }
    await putTag(tag)
    pushUndo(async () => { await db.deleteTag(tag.id); dispatch({ type: 'REMOVE_TAG', id: tag.id }) }, () => putTag(tag))
    return tag
  }, [putTag, pushUndo])

  const updateTag = useCallback(async (id, changes) => {
    const prev = (await db.getTags()).find(t => t.id === id)
    if (!prev) return
    const next = { ...prev, ...changes }
    await putTag(next)
    pushUndo(() => putTag(prev), () => putTag(next))
  }, [putTag, pushUndo])

  // Removes the tag from every task; undo puts it all back
  const deleteTag = useCallback((id) => grouped(async () => {
    const tag = (await db.getTags()).find(t => t.id === id)
    if (!tag) return 0
    const tagged = (await db.getTasks()).filter(t => t.tags?.includes(id))
    const stripped = tagged.map(t => ({ ...t, tags: t.tags.filter(x => x !== id), updatedAt: Date.now() }))
    await db.deleteTag(id)
    dispatch({ type: 'REMOVE_TAG', id })
    if (stripped.length) await writeTasks(stripped)
    pushUndo(
      async () => { await putTag(tag); if (tagged.length) await writeTasks(tagged) },
      async () => { await db.deleteTag(id); dispatch({ type: 'REMOVE_TAG', id }); if (stripped.length) await writeTasks(stripped) },
    )
    return tagged.length
  }), [grouped, pushUndo, putTag, writeTasks])

  // ── Bulk actions: one undo step each ─────────────────────

  const bulkComplete = useCallback(async () => {
    const ids = [...state.bulkSelected]
    await grouped(async () => { for (const id of ids) await completeTask(id) })
    dispatch({ type: 'CLEAR_BULK' })
    return ids.length
  }, [state.bulkSelected, grouped, completeTask])

  const bulkDelete = useCallback(async () => {
    const ids = [...state.bulkSelected]
    let n = 0
    await grouped(async () => { for (const id of ids) n += await deleteTask(id) })
    dispatch({ type: 'CLEAR_BULK' })
    return n
  }, [state.bulkSelected, grouped, deleteTask])

  const bulkMoveToProject = useCallback(async (projectId) => {
    const ids = [...state.bulkSelected]
    await grouped(async () => { for (const id of ids) await updateTask(id, { projectId }) })
    dispatch({ type: 'CLEAR_BULK' })
    return ids.length
  }, [state.bulkSelected, grouped, updateTask])

  const bulkAddTag = useCallback(async (tagId) => {
    const ids = [...state.bulkSelected]
    await grouped(async () => {
      for (const id of ids) {
        const task = await db.getTask(id)
        if (task && !task.tags.includes(tagId)) await updateTask(id, { tags: [...task.tags, tagId] })
      }
    })
    dispatch({ type: 'CLEAR_BULK' })
    return ids.length
  }, [state.bulkSelected, grouped, updateTask])

  // Several subtasks at once (e.g. suggestions): one undo step
  const addSubtasks = useCallback((parent, titles) => grouped(async () => {
    let order = Date.now()
    for (const title of titles) await createTask({ title, parentId: parent.id, projectId: parent.projectId, order: order++ })
    return titles.length
  }), [grouped, createTask])

  const clearCompleted = useCallback(async () => {
    const done = (await db.getTasks()).filter(t => t.completed && !t.parentId)
    let n = 0
    await grouped(async () => { for (const t of done) n += await deleteTask(t.id) })
    return n
  }, [grouped, deleteTask])

  // ── Restore: snapshot first, then replace; undo puts the snapshot back

  const importData = useCallback(async (data) => {
    const before = await db.exportAll()
    await db.saveSnapshot('Before restoring a backup', before)
    await db.importAll(data)
    await reloadAll()
    pushUndo(
      async () => { await db.importAll(before); await reloadAll() },
      async () => { await db.importAll(data); await reloadAll() },
    )
  }, [pushUndo, reloadAll])

  const value = {
    state,
    dispatch,
    createTask, updateTask, completeTask, uncompleteTask, deleteTask, reorderTasks,
    startTimer, stopTimer,
    createProject, updateProject, deleteProject,
    createTag, updateTag, deleteTag,
    bulkComplete, bulkDelete, bulkMoveToProject, bulkAddTag, clearCompleted, addSubtasks,
    restoreFromTrash, deletePermanently, emptyTrash, restoreVersion,
    createList, updateList, deleteList,
    undo, redo,
    importData, reloadAll,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
