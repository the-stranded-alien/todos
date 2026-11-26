// ── Task list ──────────────────────────────────────────────
import { useMemo, useState, useCallback, useRef } from 'react'
import { ChevronDown, ChevronRight, X, Filter, ArrowDownUp } from 'lucide-react'
import { useStore } from '../store/context.js'
import { todayISO, addDaysISO, parseLocalISO } from '../utils/dates.js'
import { TaskRow } from './TaskRow.jsx'
import { QuickAdd } from './QuickAdd.jsx'

const SORT_OPTIONS = [
  { value: 'order',     label: 'Manual order' },
  { value: 'dueDate',   label: 'Due date' },
  { value: 'priority',  label: 'Priority' },
  { value: 'createdAt', label: 'Date created' },
  { value: 'title',     label: 'Alphabetical' },
]

const EmptyState = ({ view }) => {
  const messages = {
    inbox:     { title: 'All clear.', sub: 'Your inbox is empty — add a task above.' },
    today:     { title: 'Nothing due today.', sub: 'Enjoy your day, or add something above.' },
    upcoming:  { title: 'No upcoming tasks.', sub: 'Everything is clear for the next 7 days.' },
    all:       { title: 'No tasks yet.', sub: 'Start by adding a task above.' },
    completed: { title: 'No completed tasks yet.', sub: 'Complete a task to see it here.' },
  }
  const base = view.startsWith('project:') ? { title: 'No tasks in this project.', sub: 'Add a task above to get started.' }
    : view.startsWith('tag:') ? { title: 'No tasks with this tag.', sub: '' }
    : messages[view] || { title: 'No tasks.', sub: '' }

  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center anim-fade-in">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ marginBottom: 20, opacity: 0.35 }}>
        <circle cx="36" cy="36" r="34" stroke="var(--border-strong)" strokeWidth="2" />
        <path d="M22 36l10 10 18-18" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p style={{ color: 'var(--text-2)', fontWeight: 600, fontSize: '.95rem', marginBottom: 6 }}>{base.title}</p>
      {base.sub && <p style={{ color: 'var(--text-4)', fontSize: '.825rem' }}>{base.sub}</p>}
    </div>
  )
}

export const TaskList = ({ quickAddRef }) => {
  const { state, dispatch, reorderTasks } = useStore()
  const { tasks, projects, tags, view, filters, sortBy, selectedTaskId, bulkSelected, searchQuery } = state
  const [completedOpen, setCompletedOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [dragOverId, setDragOverId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const dragRef = useRef(null)

  const today = todayISO()
  const in7str = addDaysISO(7)

  // View title
  const viewTitle = useMemo(() => {
    if (view === 'inbox')     return 'Inbox'
    if (view === 'today')     return 'Today'
    if (view === 'upcoming')  return 'Upcoming'
    if (view === 'all')       return 'All Tasks'
    if (view === 'completed') return 'Completed'
    if (view.startsWith('project:')) {
      const p = projects.find(p => p.id === view.slice(8))
      return p?.name || 'Project'
    }
    if (view.startsWith('tag:')) {
      const t = tags.find(t => t.id === view.slice(4))
      return t ? `#${t.name}` : 'Tag'
    }
    return 'Tasks'
  }, [view, projects, tags])

  // Default values to inject into new tasks based on view
  const currentProjectId = useMemo(() =>
    view.startsWith('project:') ? view.slice(8) : null
  , [view])

  const defaultDueDate = useMemo(() => {
    if (view === 'today') return today
    return null
  }, [view, today])

  // Filter + sort
  const { activeTasks, completedTasks } = useMemo(() => {
    let filtered = tasks.filter(t => !t.parentId)

    if (view === 'inbox') {
      filtered = filtered.filter(t => !t.projectId && !t.completed)
    } else if (view === 'today') {
      filtered = filtered.filter(t => !t.completed && t.dueDate && t.dueDate <= today)
    } else if (view === 'upcoming') {
      filtered = filtered.filter(t => !t.completed && t.dueDate && t.dueDate > today && t.dueDate <= in7str)
    } else if (view === 'all') {
      filtered = filtered.filter(t => !t.completed)
    } else if (view === 'completed') {
      // all, including completed — handled below
    } else if (view.startsWith('project:')) {
      const pid = view.slice(8)
      filtered = filtered.filter(t => t.projectId === pid && !t.completed)
    } else if (view.startsWith('tag:')) {
      const tid = view.slice(4)
      filtered = filtered.filter(t => (t.tags || []).includes(tid) && !t.completed)
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q)
      )
    }

    // Sidebar filters
    if (filters.priority != null)  filtered = filtered.filter(t => t.priority === filters.priority)
    if (filters.tagId)             filtered = filtered.filter(t => (t.tags || []).includes(filters.tagId))
    if (filters.projectId)         filtered = filtered.filter(t => t.projectId === filters.projectId)
    if (filters.hasDueDate)        filtered = filtered.filter(t => t.dueDate)
    if (filters.overdue)           filtered = filtered.filter(t => t.dueDate && t.dueDate < today && !t.completed)

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'order')     return a.order - b.order
      if (sortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      }
      if (sortBy === 'priority')  return b.priority - a.priority
      if (sortBy === 'createdAt') return b.createdAt - a.createdAt
      if (sortBy === 'title')     return a.title.localeCompare(b.title)
      return 0
    })

    return {
      activeTasks:    sorted.filter(t => !t.completed),
      completedTasks: sorted.filter(t => t.completed),
    }
  }, [tasks, view, today, in7str, searchQuery, filters, sortBy])

  const handleSelect    = useCallback((id) => dispatch({ type: 'SELECT_TASK', id }), [dispatch])
  const handleBulkToggle = useCallback((id) => dispatch({ type: 'TOGGLE_BULK', id }), [dispatch])

  const handleDragStart = useCallback((id) => { setDraggingId(id); dragRef.current = id }, [])
  const handleDragOver  = useCallback((id) => setDragOverId(id), [])
  const handleDrop      = useCallback(async (targetId) => {
    const srcId = dragRef.current
    if (!srcId || srcId === targetId) { setDragOverId(null); setDraggingId(null); return }
    const ids = activeTasks.map(t => t.id)
    const si = ids.indexOf(srcId), ti = ids.indexOf(targetId)
    if (si === -1 || ti === -1) { setDragOverId(null); setDraggingId(null); return }
    const reordered = [...ids]
    reordered.splice(si, 1)
    reordered.splice(ti, 0, srcId)
    await reorderTasks(reordered)
    setDragOverId(null); setDraggingId(null); dragRef.current = null
  }, [activeTasks, reorderTasks])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.priority != null) n++
    if (filters.tagId) n++
    if (filters.projectId) n++
    if (filters.hasDueDate) n++
    if (filters.overdue) n++
    return n
  }, [filters])

  // Upcoming groups by date
  const upcomingGroups = useMemo(() => {
    if (view !== 'upcoming') return null
    const groups = {}
    for (const t of activeTasks) {
      const d = t.dueDate || 'No date'
      if (!groups[d]) groups[d] = []
      groups[d].push(t)
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [view, activeTasks])

  const formatGroupDate = (d) => {
    if (d === 'No date') return 'No date'
    const date = parseLocalISO(d)
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }

  const showQuickAdd = view !== 'completed' && view !== 'calendar' && view !== 'stats'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── View header ──────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
        <div className="flex items-center gap-2 mb-4">
          <h1 style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '1.4rem', flex: 1 }}>{viewTitle}</h1>

          {/* Active filter badge */}
          {activeFilterCount > 0 && (
            <button
              className="tag-chip"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)', cursor: 'pointer' }}
              onClick={() => dispatch({ type: 'CLEAR_FILTERS' })}
            >
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} <X size={10} />
            </button>
          )}

          {/* Filter toggle */}
          <button
            className="btn btn-ghost p-1.5"
            onClick={() => setShowFilters(v => !v)}
            aria-label="Toggle filters"
            style={{ color: showFilters ? 'var(--accent)' : 'var(--text-3)' }}
          >
            <Filter size={15} />
          </button>

          {/* Sort */}
          <div className="relative flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
            <ArrowDownUp size={13} style={{ flexShrink: 0 }} />
            <select
              value={sortBy}
              onChange={e => dispatch({ type: 'SET_SORT', sortBy: e.target.value })}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-3)',
                fontSize: '.8rem',
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                paddingRight: 4,
              }}
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="anim-slide-up flex flex-wrap gap-2 mb-4 p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <select
              value={filters.priority ?? ''}
              onChange={e => dispatch({ type: 'SET_FILTER', filters: { priority: e.target.value === '' ? null : Number(e.target.value) } })}
              className="input-base"
              style={{ width: 'auto', fontSize: '.8rem', padding: '4px 8px' }}
              aria-label="Filter by priority"
            >
              <option value="">All priorities</option>
              <option value="0">No priority</option>
              <option value="1">Low</option>
              <option value="2">Medium</option>
              <option value="3">High</option>
            </select>

            <select
              value={filters.tagId || ''}
              onChange={e => dispatch({ type: 'SET_FILTER', filters: { tagId: e.target.value || null } })}
              className="input-base"
              style={{ width: 'auto', fontSize: '.8rem', padding: '4px 8px' }}
              aria-label="Filter by tag"
            >
              <option value="">All tags</option>
              {state.tags.map(t => <option key={t.id} value={t.id}>#{t.name}</option>)}
            </select>

            <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: '.8rem', color: 'var(--text-2)' }}>
              <input type="checkbox" checked={filters.hasDueDate} onChange={e => dispatch({ type: 'SET_FILTER', filters: { hasDueDate: e.target.checked } })} style={{ accentColor: 'var(--accent)' }} />
              Has due date
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: '.8rem', color: 'var(--danger)' }}>
              <input type="checkbox" checked={filters.overdue} onChange={e => dispatch({ type: 'SET_FILTER', filters: { overdue: e.target.checked } })} style={{ accentColor: 'var(--danger)' }} />
              Overdue only
            </label>

            {activeFilterCount > 0 && (
              <button className="btn btn-ghost p-1" style={{ fontSize: '.8rem', marginLeft: 'auto' }} onClick={() => dispatch({ type: 'CLEAR_FILTERS' })}>
                <X size={12} /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Quick add ─────────────────────────────────────── */}
      {showQuickAdd && (
        <div style={{ padding: '0 12px 2px' }}>
          <QuickAdd inputRef={quickAddRef} defaultProjectId={currentProjectId} defaultDueDate={defaultDueDate} />
        </div>
      )}

      {/* ── Task list ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '4px 12px 16px' }}>

        {/* Upcoming: grouped by date */}
        {upcomingGroups ? (
          upcomingGroups.length === 0 ? <EmptyState view={view} /> :
          upcomingGroups.map(([date, dateTasks]) => (
            <div key={date} className="mb-5">
              <div style={{ color: 'var(--text-4)', fontSize: '.72rem', fontWeight: 700, letterSpacing: '.06em', padding: '0 4px 6px', textTransform: 'uppercase' }}>
                {formatGroupDate(date)}
              </div>
              {dateTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  isChecked={bulkSelected.has(task.id)}
                  onSelect={handleSelect}
                  onBulkToggle={handleBulkToggle}
                />
              ))}
            </div>
          ))
        ) : (
          <>
            {activeTasks.length === 0 && view !== 'completed' && <EmptyState view={view} />}
            {activeTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                isSelected={selectedTaskId === task.id}
                isChecked={bulkSelected.has(task.id)}
                onSelect={handleSelect}
                onBulkToggle={handleBulkToggle}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                dragging={draggingId === task.id}
                dropTarget={dragOverId === task.id ? 'above' : null}
              />
            ))}
          </>
        )}

        {/* Completed section (inline in non-completed views) */}
        {completedTasks.length > 0 && view !== 'completed' && (
          <div className="mt-2">
            <button
              className="flex items-center gap-2 px-2 py-2 w-full text-left rounded-lg"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: '.78rem', fontWeight: 500 }}
              onClick={() => setCompletedOpen(v => !v)}
            >
              {completedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              Completed · {completedTasks.length}
            </button>
            {completedOpen && completedTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                isSelected={selectedTaskId === task.id}
                isChecked={bulkSelected.has(task.id)}
                onSelect={handleSelect}
                onBulkToggle={handleBulkToggle}
              />
            ))}
          </div>
        )}

        {/* Completed view */}
        {view === 'completed' && (
          completedTasks.length === 0
            ? <EmptyState view={view} />
            : completedTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                isSelected={selectedTaskId === task.id}
                isChecked={bulkSelected.has(task.id)}
                onSelect={handleSelect}
                onBulkToggle={handleBulkToggle}
              />
            ))
        )}
      </div>
    </div>
  )
}
