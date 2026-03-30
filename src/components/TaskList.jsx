// ── Task list ──────────────────────────────────────────────
import { useMemo, useState, useCallback, useRef } from 'react'
import { ChevronDown, ChevronRight, SlidersHorizontal, ArrowUpDown, X, Filter } from 'lucide-react'
import { useStore } from '../useStore.jsx'
import { TaskRow } from './TaskRow.jsx'
import { QuickAdd } from './QuickAdd.jsx'

const SORT_OPTIONS = [
  { value: 'order', label: 'Manual order' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'createdAt', label: 'Created date' },
  { value: 'title', label: 'Alphabetical' },
]

const EmptyState = ({ view }) => {
  const messages = {
    inbox: { title: 'All clear.', sub: 'Your inbox is empty. Create a task to get started.' },
    today: { title: 'Nothing due today — enjoy your day.', sub: 'Check Upcoming for future tasks.' },
    upcoming: { title: 'No upcoming tasks.', sub: 'Everything is clear for the next 7 days.' },
    all: { title: 'No tasks yet.', sub: 'Start by adding a task above.' },
    completed: { title: 'No completed tasks yet.', sub: 'Complete tasks to see them here.' },
    calendar: { title: 'No tasks this month.', sub: '' },
    stats: { title: '', sub: '' },
  }

  const base = view.startsWith('project:') ? { title: 'No tasks in this project.', sub: 'Add a task above.' }
    : view.startsWith('tag:') ? { title: 'No tasks with this tag.', sub: '' }
    : messages[view] || { title: 'No tasks.', sub: '' }

  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      {/* SVG illustration */}
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ marginBottom: 20, opacity: 0.4 }}>
        <circle cx="40" cy="40" r="38" stroke="var(--border-strong)" strokeWidth="2" />
        <path d="M25 40l10 10 20-20" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h3 style={{ color: 'var(--text-2)', fontWeight: 600, fontSize: '1rem', marginBottom: 6 }}>{base.title}</h3>
      {base.sub && <p style={{ color: 'var(--text-4)', fontSize: '.875rem' }}>{base.sub}</p>}
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

  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date()
  in7.setDate(in7.getDate() + 7)
  const in7str = in7.toISOString().slice(0, 10)

  // Compute view title
  const viewTitle = useMemo(() => {
    if (view === 'inbox') return 'Inbox'
    if (view === 'today') return 'Today'
    if (view === 'upcoming') return 'Upcoming'
    if (view === 'all') return 'All Tasks'
    if (view === 'completed') return 'Completed'
    if (view === 'calendar') return 'Calendar'
    if (view === 'stats') return 'Statistics'
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

  // Current project for quick-add
  const currentProjectId = useMemo(() =>
    view.startsWith('project:') ? view.slice(8) : null
  , [view])

  // Filter and sort tasks
  const { activeTasks, completedTasks } = useMemo(() => {
    let filtered = tasks.filter(t => !t.parentId) // only root tasks

    // View filter
    if (view === 'inbox') {
      filtered = filtered.filter(t => !t.projectId && !t.completed)
    } else if (view === 'today') {
      filtered = filtered.filter(t => !t.completed && t.dueDate && t.dueDate <= today)
    } else if (view === 'upcoming') {
      filtered = filtered.filter(t => !t.completed && t.dueDate && t.dueDate > today && t.dueDate <= in7str)
    } else if (view === 'all') {
      filtered = filtered.filter(t => !t.completed)
    } else if (view === 'completed') {
      filtered = filtered // all, including completed
    } else if (view.startsWith('project:')) {
      const pid = view.slice(8)
      filtered = filtered.filter(t => t.projectId === pid && !t.completed)
    } else if (view.startsWith('tag:')) {
      const tid = view.slice(4)
      filtered = filtered.filter(t => (t.tags || []).includes(tid) && !t.completed)
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q)
      )
    }

    // Additional filters
    if (filters.priority != null) filtered = filtered.filter(t => t.priority === filters.priority)
    if (filters.tagId) filtered = filtered.filter(t => (t.tags || []).includes(filters.tagId))
    if (filters.projectId) filtered = filtered.filter(t => t.projectId === filters.projectId)
    if (filters.hasDueDate) filtered = filtered.filter(t => t.dueDate)
    if (filters.overdue) filtered = filtered.filter(t => t.dueDate && t.dueDate < today && !t.completed)

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'order') return a.order - b.order
      if (sortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      }
      if (sortBy === 'priority') return b.priority - a.priority
      if (sortBy === 'createdAt') return b.createdAt - a.createdAt
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      return 0
    })

    return {
      activeTasks: sorted.filter(t => !t.completed),
      completedTasks: sorted.filter(t => t.completed),
    }
  }, [tasks, view, today, in7str, searchQuery, filters, sortBy])

  const handleSelect = useCallback((id) => {
    dispatch({ type: 'SELECT_TASK', id })
  }, [dispatch])

  const handleBulkToggle = useCallback((id) => {
    dispatch({ type: 'TOGGLE_BULK', id })
  }, [dispatch])

  const handleDragStart = useCallback((id) => {
    setDraggingId(id)
    dragRef.current = id
  }, [])

  const handleDragOver = useCallback((id) => {
    setDragOverId(id)
  }, [])

  const handleDrop = useCallback(async (targetId) => {
    const srcId = dragRef.current
    if (!srcId || srcId === targetId) { setDragOverId(null); setDraggingId(null); return }

    const ids = activeTasks.map(t => t.id)
    const srcIdx = ids.indexOf(srcId)
    const tgtIdx = ids.indexOf(targetId)
    if (srcIdx === -1 || tgtIdx === -1) { setDragOverId(null); setDraggingId(null); return }

    const reordered = [...ids]
    reordered.splice(srcIdx, 1)
    reordered.splice(tgtIdx, 0, srcId)

    await reorderTasks(reordered)
    setDragOverId(null)
    setDraggingId(null)
    dragRef.current = null
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

  // Upcoming: group by date
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
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
        <div className="flex items-center justify-between mb-3">
          <h1 style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '1.3rem' }}>{viewTitle}</h1>
          <div className="flex items-center gap-1">
            <button
              className="btn btn-ghost p-1.5 relative"
              onClick={() => setShowFilters(v => !v)}
              aria-label="Filters"
              style={{ color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-3)' }}
            >
              <Filter size={15} />
              {activeFilterCount > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -2,
                  background: 'var(--accent)', color: '#fff',
                  borderRadius: '50%', width: 14, height: 14, fontSize: '.6rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{activeFilterCount}</span>
              )}
            </button>
            <select
              value={sortBy}
              onChange={e => dispatch({ type: 'SET_SORT', sortBy: e.target.value })}
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-3)', fontSize: '.8rem',
                padding: '4px 8px', cursor: 'pointer', outline: 'none',
              }}
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="anim-slide-up flex flex-wrap gap-2 mb-3 p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {/* Priority filter */}
            <select
              value={filters.priority ?? ''}
              onChange={e => dispatch({ type: 'SET_FILTER', filters: { priority: e.target.value === '' ? null : Number(e.target.value) } })}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)', fontSize: '.8rem', padding: '3px 8px' }}
              aria-label="Filter by priority"
            >
              <option value="">All priorities</option>
              <option value="0">No priority</option>
              <option value="1">Low</option>
              <option value="2">Medium</option>
              <option value="3">High</option>
            </select>

            {/* Tag filter */}
            <select
              value={filters.tagId || ''}
              onChange={e => dispatch({ type: 'SET_FILTER', filters: { tagId: e.target.value || null } })}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)', fontSize: '.8rem', padding: '3px 8px' }}
              aria-label="Filter by tag"
            >
              <option value="">All tags</option>
              {state.tags.map(t => <option key={t.id} value={t.id}>#{t.name}</option>)}
            </select>

            {/* Has due date */}
            <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: '.8rem', color: 'var(--text-2)' }}>
              <input
                type="checkbox"
                checked={filters.hasDueDate}
                onChange={e => dispatch({ type: 'SET_FILTER', filters: { hasDueDate: e.target.checked } })}
                style={{ accentColor: 'var(--accent)' }}
              />
              Has due date
            </label>

            {/* Overdue */}
            <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: '.8rem', color: '#ef4444' }}>
              <input
                type="checkbox"
                checked={filters.overdue}
                onChange={e => dispatch({ type: 'SET_FILTER', filters: { overdue: e.target.checked } })}
                style={{ accentColor: '#ef4444' }}
              />
              Overdue only
            </label>

            {activeFilterCount > 0 && (
              <button className="btn btn-ghost p-1" onClick={() => dispatch({ type: 'CLEAR_FILTERS' })} style={{ fontSize: '.8rem' }}>
                <X size={12} /> Clear all
              </button>
            )}
          </div>
        )}

        {/* Active filter chips */}
        {!showFilters && activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {filters.priority != null && (
              <span className="tag-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                Priority: {['none','low','med','high'][filters.priority]}
                <button onClick={() => dispatch({ type: 'SET_FILTER', filters: { priority: null } })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, marginLeft: 2 }}>✕</button>
              </span>
            )}
            {filters.hasDueDate && (
              <span className="tag-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                Has due date
                <button onClick={() => dispatch({ type: 'SET_FILTER', filters: { hasDueDate: false } })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, marginLeft: 2 }}>✕</button>
              </span>
            )}
            {filters.overdue && (
              <span className="tag-chip" style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444' }}>
                Overdue
                <button onClick={() => dispatch({ type: 'SET_FILTER', filters: { overdue: false } })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, marginLeft: 2 }}>✕</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Quick add */}
      {view !== 'completed' && view !== 'calendar' && view !== 'stats' && (
        <QuickAdd inputRef={quickAddRef} defaultProjectId={currentProjectId} />
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '8px 8px' }}>
        {/* Upcoming grouped view */}
        {upcomingGroups ? (
          upcomingGroups.length === 0 ? <EmptyState view={view} /> :
          upcomingGroups.map(([date, dateTasks]) => (
            <div key={date} className="mb-4">
              <div style={{ color: 'var(--text-3)', fontSize: '.75rem', fontWeight: 600, padding: '4px 12px', marginBottom: 4 }}>
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
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  dragging={draggingId === task.id}
                  dropTarget={dragOverId === task.id ? 'above' : null}
                />
              ))}
            </div>
          ))
        ) : (
          <>
            {activeTasks.length === 0 && completedTasks.length === 0 ? (
              <EmptyState view={view} />
            ) : (
              activeTasks.map(task => (
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
              ))
            )}
          </>
        )}

        {/* Completed section */}
        {completedTasks.length > 0 && view !== 'completed' && (
          <div className="mt-4">
            <button
              className="flex items-center gap-2 px-3 py-1.5 w-full text-left"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: '.8rem' }}
              onClick={() => setCompletedOpen(v => !v)}
            >
              {completedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              Completed ({completedTasks.length})
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
          completedTasks.length === 0 ? <EmptyState view={view} /> :
          completedTasks.map(task => (
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
