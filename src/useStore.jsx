// ── Global state store ─────────────────────────────────────
import { useReducer, useCallback, useRef, useEffect } from 'react'
import { StoreContext } from './store/context.js'
import { parseLocalISO, toLocalISO } from './utils/dates.js'
import { nanoid } from './utils/nanoid.js'
import * as db from './db.js'
import { addHistory } from './db.js'

// ── Initial state ──────────────────────────────────────────
const initialState = {
  tasks: [],
  projects: [],
  tags: [],
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
  focusMode: false,
  bulkSelected: new Set(),
  activeTimerTaskId: null,
}

// ── Reducer ────────────────────────────────────────────────
const reducer = (state, action) => {
  switch (action.type) {
    case 'LOAD': return { ...state, ...action.payload, loading: false }

    case 'ADD_TASK': return { ...state, tasks: [...state.tasks, action.task] }
    case 'UPDATE_TASK': return {
      ...state,
      tasks: state.tasks.map(t => t.id === action.task.id ? action.task : t),
    }
    case 'DELETE_TASK': return {
      ...state,
      tasks: state.tasks.filter(t => t.id !== action.id),
      selectedTaskId: state.selectedTaskId === action.id ? null : state.selectedTaskId,
      detailOpen: state.selectedTaskId === action.id ? false : state.detailOpen,
    }
    case 'SET_TASKS': return { ...state, tasks: action.tasks }

    case 'ADD_PROJECT': return { ...state, projects: [...state.projects, action.project] }
    case 'UPDATE_PROJECT': return {
      ...state,
      projects: state.projects.map(p => p.id === action.project.id ? action.project : p),
    }
    case 'DELETE_PROJECT': return {
      ...state,
      projects: state.projects.filter(p => p.id !== action.id),
    }
    case 'SET_PROJECTS': return { ...state, projects: action.projects }

    case 'ADD_TAG': return { ...state, tags: [...state.tags, action.tag] }
    case 'UPDATE_TAG': return {
      ...state,
      tags: state.tags.map(t => t.id === action.tag.id ? action.tag : t),
    }
    case 'DELETE_TAG': return { ...state, tags: state.tags.filter(t => t.id !== action.id) }

    case 'SET_VIEW': return {
      ...state,
      view: action.view,
      selectedTaskId: null,
      detailOpen: false,
      bulkSelected: new Set(),
    }
    case 'SELECT_TASK': return {
      ...state,
      selectedTaskId: action.id,
      detailOpen: action.id != null,
    }
    case 'CLOSE_DETAIL': return { ...state, detailOpen: false, selectedTaskId: null }
    case 'SET_SEARCH': return { ...state, searchQuery: action.query }
    case 'SET_FILTER': return { ...state, filters: { ...state.filters, ...action.filters } }
    case 'CLEAR_FILTERS': return { ...state, filters: initialState.filters }
    case 'SET_SORT': return { ...state, sortBy: action.sortBy }
    case 'TOGGLE_SIDEBAR': return { ...state, sidebarOpen: !state.sidebarOpen }
    case 'SET_FOCUS_MODE': return { ...state, focusMode: action.value }
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

// ── Undo/Redo stack ────────────────────────────────────────
const MAX_UNDO = 50

// ── Provider ───────────────────────────────────────────────
export const StoreProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState)
  const undoStack = useRef([])
  const redoStack = useRef([])

  // Load all data on mount
  useEffect(() => {
    const load = async () => {
      const [tasks, projects, tags] = await Promise.all([
        db.getTasks(),
        db.getProjects(),
        db.getTags(),
      ])

      // Restore active timer if any
      const activeTimer = tasks.find(t => t.timerStartedAt != null)

      dispatch({
        type: 'LOAD',
        payload: { tasks, projects, tags, activeTimerTaskId: activeTimer?.id ?? null },
      })
    }
    load()
  }, [])

  // ── Mutation helpers ─────────────────────────────────────

  const pushUndo = useCallback((undoFn, redoFn) => {
    undoStack.current.push({ undo: undoFn, redo: redoFn })
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
    redoStack.current = []
  }, [])

  const undo = useCallback(async () => {
    const entry = undoStack.current.pop()
    if (!entry) return
    await entry.undo()
    redoStack.current.push(entry)
  }, [])

  const redo = useCallback(async () => {
    const entry = redoStack.current.pop()
    if (!entry) return
    await entry.redo()
    undoStack.current.push(entry)
  }, [])

  // ── Task actions ─────────────────────────────────────────

  const createTask = useCallback(async (fields) => {
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
      order: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      timeTracked: 0,
      timerStartedAt: null,
      ...fields,
    }
    await db.putTask(task)
    dispatch({ type: 'ADD_TASK', task })
    await addHistory({ id: nanoid(), taskId: task.id, action: 'created', diff: { after: task }, timestamp: Date.now() })

    pushUndo(
      async () => { dispatch({ type: 'DELETE_TASK', id: task.id }); await db.deleteTask(task.id) },
      async () => { await db.putTask(task); dispatch({ type: 'ADD_TASK', task }) }
    )
    return task
  }, [pushUndo])

  const updateTask = useCallback(async (id, changes) => {
    const prev = state.tasks.find(t => t.id === id)
    if (!prev) return
    const next = { ...prev, ...changes, updatedAt: Date.now() }
    await db.putTask(next)
    dispatch({ type: 'UPDATE_TASK', task: next })
    await addHistory({ id: nanoid(), taskId: id, action: 'updated', diff: { before: changes, after: next }, timestamp: Date.now() })

    pushUndo(
      async () => { await db.putTask(prev); dispatch({ type: 'UPDATE_TASK', task: prev }) },
      async () => { await db.putTask(next); dispatch({ type: 'UPDATE_TASK', task: next }) }
    )
    return next
  }, [state.tasks, pushUndo])

  const completeTask = useCallback(async (id) => {
    const task = state.tasks.find(t => t.id === id)
    if (!task) return

    const now = Date.now()
    const next = { ...task, completed: true, completedAt: now, updatedAt: now }

    // Stop any active timer
    if (next.timerStartedAt != null) {
      next.timeTracked = (next.timeTracked || 0) + (now - next.timerStartedAt)
      next.timerStartedAt = null
      if (state.activeTimerTaskId === id) dispatch({ type: 'SET_ACTIVE_TIMER', taskId: null })
    }

    await db.putTask(next)
    dispatch({ type: 'UPDATE_TASK', task: next })
    await addHistory({ id: nanoid(), taskId: id, action: 'completed', diff: { before: task, after: next }, timestamp: now })

    // Handle recurring tasks
    if (task.recurring && task.dueDate) {
      const nextDue = getNextDueDate(task.dueDate, task.recurring)
      await createTask({
        ...task,
        id: nanoid(),
        completed: false,
        completedAt: null,
        dueDate: nextDue,
        timeTracked: 0,
        timerStartedAt: null,
        createdAt: now,
        updatedAt: now,
        order: now + 1,
      })
    }

    pushUndo(
      async () => { await db.putTask(task); dispatch({ type: 'UPDATE_TASK', task }) },
      async () => { await db.putTask(next); dispatch({ type: 'UPDATE_TASK', task: next }) }
    )
  }, [state.tasks, state.activeTimerTaskId, createTask, pushUndo])

  const uncompleteTask = useCallback(async (id) => {
    const task = state.tasks.find(t => t.id === id)
    if (!task) return
    const next = { ...task, completed: false, completedAt: null, updatedAt: Date.now() }
    await db.putTask(next)
    dispatch({ type: 'UPDATE_TASK', task: next })
  }, [state.tasks])

  const deleteTask = useCallback(async (id) => {
    const task = state.tasks.find(t => t.id === id)
    if (!task) return
    await db.deleteTask(id)
    dispatch({ type: 'DELETE_TASK', id })
    await addHistory({ id: nanoid(), taskId: id, action: 'deleted', diff: { before: task }, timestamp: Date.now() })

    pushUndo(
      async () => { await db.putTask(task); dispatch({ type: 'ADD_TASK', task }) },
      async () => { await db.deleteTask(id); dispatch({ type: 'DELETE_TASK', id }) }
    )
  }, [state.tasks, pushUndo])

  const reorderTasks = useCallback(async (orderedIds) => {
    const prev = [...state.tasks]
    const next = state.tasks.map(t => {
      const idx = orderedIds.indexOf(t.id)
      return idx !== -1 ? { ...t, order: idx * 1000 } : t
    })
    await Promise.all(next.filter(t => orderedIds.includes(t.id)).map(t => db.putTask(t)))
    dispatch({ type: 'SET_TASKS', tasks: next })

    pushUndo(
      async () => { await Promise.all(prev.map(t => db.putTask(t))); dispatch({ type: 'SET_TASKS', tasks: prev }) },
      async () => { await Promise.all(next.map(t => db.putTask(t))); dispatch({ type: 'SET_TASKS', tasks: next }) }
    )
  }, [state.tasks, pushUndo])

  // ── Timer actions ────────────────────────────────────────

  const stopTimer = useCallback(async (id) => {
    const task = state.tasks.find(t => t.id === id)
    if (!task || task.timerStartedAt == null) return
    const now = Date.now()
    const elapsed = now - task.timerStartedAt
    const next = { ...task, timeTracked: (task.timeTracked || 0) + elapsed, timerStartedAt: null, updatedAt: now }
    await db.putTask(next)
    dispatch({ type: 'UPDATE_TASK', task: next })
    dispatch({ type: 'SET_ACTIVE_TIMER', taskId: null })
  }, [state.tasks])

  const startTimer = useCallback(async (id) => {
    // Stop previous timer
    if (state.activeTimerTaskId && state.activeTimerTaskId !== id) {
      await stopTimer(state.activeTimerTaskId)
    }
    const task = state.tasks.find(t => t.id === id)
    if (!task) return
    const now = Date.now()
    const next = { ...task, timerStartedAt: now, updatedAt: now }
    await db.putTask(next)
    dispatch({ type: 'UPDATE_TASK', task: next })
    dispatch({ type: 'SET_ACTIVE_TIMER', taskId: id })
  }, [state.tasks, state.activeTimerTaskId, stopTimer])

  // ── Project actions ──────────────────────────────────────

  const createProject = useCallback(async (fields) => {
    const project = {
      id: nanoid(),
      name: 'New Project',
      color: '#6d28d9',
      icon: 'Folder',
      order: Date.now(),
      createdAt: Date.now(),
      ...fields,
    }
    await db.putProject(project)
    dispatch({ type: 'ADD_PROJECT', project })
    return project
  }, [])

  const updateProject = useCallback(async (id, changes) => {
    const prev = state.projects.find(p => p.id === id)
    if (!prev) return
    const next = { ...prev, ...changes }
    await db.putProject(next)
    dispatch({ type: 'UPDATE_PROJECT', project: next })
  }, [state.projects])

  const deleteProject = useCallback(async (id) => {
    await db.deleteProject(id)
    dispatch({ type: 'DELETE_PROJECT', id })
    // Move tasks to inbox
    const projectTasks = state.tasks.filter(t => t.projectId === id)
    for (const t of projectTasks) {
      const next = { ...t, projectId: null }
      await db.putTask(next)
      dispatch({ type: 'UPDATE_TASK', task: next })
    }
  }, [state.tasks])

  // ── Tag actions ──────────────────────────────────────────

  const createTag = useCallback(async (fields) => {
    const tag = {
      id: nanoid(),
      name: 'New Tag',
      color: '#6d28d9',
      createdAt: Date.now(),
      ...fields,
    }
    await db.putTag(tag)
    dispatch({ type: 'ADD_TAG', tag })
    return tag
  }, [])

  const updateTag = useCallback(async (id, changes) => {
    const prev = state.tags.find(t => t.id === id)
    if (!prev) return
    const next = { ...prev, ...changes }
    await db.putTag(next)
    dispatch({ type: 'UPDATE_TAG', tag: next })
  }, [state.tags])

  const deleteTag = useCallback(async (id) => {
    await db.deleteTag(id)
    dispatch({ type: 'DELETE_TAG', id })
    // Remove tag from all tasks
    const taggedTasks = state.tasks.filter(t => t.tags?.includes(id))
    for (const t of taggedTasks) {
      const next = { ...t, tags: t.tags.filter(tid => tid !== id) }
      await db.putTask(next)
      dispatch({ type: 'UPDATE_TASK', task: next })
    }
  }, [state.tasks])

  // ── Bulk actions ─────────────────────────────────────────

  const bulkComplete = useCallback(async () => {
    for (const id of state.bulkSelected) await completeTask(id)
    dispatch({ type: 'CLEAR_BULK' })
  }, [state.bulkSelected, completeTask])

  const bulkDelete = useCallback(async () => {
    for (const id of state.bulkSelected) await deleteTask(id)
    dispatch({ type: 'CLEAR_BULK' })
  }, [state.bulkSelected, deleteTask])

  const bulkMoveToProject = useCallback(async (projectId) => {
    for (const id of state.bulkSelected) {
      await updateTask(id, { projectId })
    }
    dispatch({ type: 'CLEAR_BULK' })
  }, [state.bulkSelected, updateTask])

  const bulkAddTag = useCallback(async (tagId) => {
    for (const id of state.bulkSelected) {
      const task = state.tasks.find(t => t.id === id)
      if (task && !task.tags.includes(tagId)) {
        await updateTask(id, { tags: [...task.tags, tagId] })
      }
    }
    dispatch({ type: 'CLEAR_BULK' })
  }, [state.bulkSelected, state.tasks, updateTask])

  // ── Import/Export ────────────────────────────────────────

  const importData = useCallback(async (data) => {
    await db.importAll(data)
    dispatch({
      type: 'LOAD',
      payload: {
        tasks: data.tasks || [],
        projects: data.projects || [],
        tags: data.tags || [],
        activeTimerTaskId: null,
      },
    })
  }, [])

  const value = {
    state,
    dispatch,
    // task actions
    createTask,
    updateTask,
    completeTask,
    uncompleteTask,
    deleteTask,
    reorderTasks,
    // timer
    startTimer,
    stopTimer,
    // project
    createProject,
    updateProject,
    deleteProject,
    // tag
    createTag,
    updateTag,
    deleteTag,
    // bulk
    bulkComplete,
    bulkDelete,
    bulkMoveToProject,
    bulkAddTag,
    // undo/redo
    undo,
    redo,
    // import
    importData,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// ── Helpers ────────────────────────────────────────────────

const getNextDueDate = (dueDateStr, recurring) => {
  const d = parseLocalISO(dueDateStr)
  const { freq, interval = 1 } = recurring
  if (freq === 'daily') d.setDate(d.getDate() + interval)
  else if (freq === 'weekly') d.setDate(d.getDate() + 7 * interval)
  else if (freq === 'monthly') d.setMonth(d.getMonth() + interval)
  return toLocalISO(d)
}
