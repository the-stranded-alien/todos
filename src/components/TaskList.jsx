// ── Task list ──────────────────────────────────────────────
import { useMemo, useState, useCallback, useRef } from 'react'
import { ChevronDown, ChevronRight, X, Filter, ArrowDownUp, Inbox, Sun, CalendarDays, LayoutList, CheckCircle2, Search, Folder, Tag } from '../icons.jsx'
import { EmptyState } from './ui/EmptyState.jsx'
import { IconButton } from './ui/IconButton.jsx'
import { Menu } from './ui/Menu.jsx'
import { focusTaskDetail, moveTaskFocus } from '../utils/focus.js'
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

const EMPTY = {
  inbox:     { icon: Inbox,        title: 'All clear.',               sub: 'Your inbox is empty. Add a task above.' },
  today:     { icon: Sun,          title: 'Nothing due today.',       sub: 'Enjoy your day, or add something above.' },
  upcoming:  { icon: CalendarDays, title: 'No upcoming tasks.',       sub: 'Nothing is due in the next 7 days.' },
  all:       { icon: LayoutList,   title: 'No tasks yet.',            sub: 'Start by adding a task above.' },
  completed: { icon: CheckCircle2, title: 'No completed tasks yet.',  sub: 'Tasks you complete show up here.' },
}

const ViewEmpty = ({ view, searching }) => {
  if (searching) return <EmptyState icon={Search} title="No matching tasks.">Try a different word, or clear the search.</EmptyState>
  const e = view.startsWith('project:') ? { icon: Folder, title: 'No tasks in this project.', sub: 'Add a task above to get started.' }
    : view.startsWith('tag:') ? { icon: Tag, title: 'No tasks with this tag.', sub: 'Add #tagname to a task to tag it.' }
    : EMPTY[view] ?? { icon: CheckCircle2, title: 'No tasks.', sub: '' }
  return <EmptyState icon={e.icon} title={e.title}>{e.sub}</EmptyState>
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

  const handleSelect    = useCallback((id, opts) => {
    dispatch({ type: 'SELECT_TASK', id })
    if (opts?.focus) focusTaskDetail()
  }, [dispatch])
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
          <h1 style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '1.4rem' }}>{viewTitle}</h1>
          <span aria-live="polite" style={{ color: 'var(--text-3)', fontSize: '.8rem', flex: 1, fontVariantNumeric: 'tabular-nums' }}>
            {view === 'completed' ? completedTasks.length : activeTasks.length} {(view === 'completed' ? completedTasks.length : activeTasks.length) === 1 ? 'task' : 'tasks'}
          </span>

          {/* Active filter badge */}
          {activeFilterCount > 0 && (
            <button
              className="tag-chip"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)', cursor: 'pointer' }}
              onClick={() => dispatch({ type: 'CLEAR_FILTERS' })}
              aria-label={`Clear ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''}`}
              data-tooltip="Clear filters"
            >
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} <X size={10} />
            </button>
          )}

          <IconButton
            label="Filters"
            icon={Filter}
            pressed={showFilters}
            aria-controls={showFilters ? "filter-bar" : undefined}
            onClick={() => setShowFilters(v => !v)}
          />

          <Menu
            label="Sort by"
            align="end"
            items={SORT_OPTIONS.map(o => ({ label: o.label, checked: sortBy === o.value, onSelect: () => dispatch({ type: 'SET_SORT', sortBy: o.value }) }))}
            trigger={(props) => (
              <button type="button" className="btn btn-ghost" style={{ fontSize: '.8rem', padding: '6px 8px', color: 'var(--text-2)' }} aria-label={`Sort: ${SORT_OPTIONS.find(o => o.value === sortBy)?.label}`} data-tooltip="Sort tasks" {...props}>
                <ArrowDownUp size={13} />
                {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
                <ChevronDown size={11} />
              </button>
            )}
          />
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div id="filter-bar" role="group" aria-label="Filters" className="anim-slide-up flex flex-wrap gap-2 mb-4 p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
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
      <div className="flex-1 overflow-y-auto" style={{ padding: '4px 12px 16px' }} onKeyDown={moveTaskFocus}>

        {/* Upcoming: grouped by date */}
        {upcomingGroups ? (
          upcomingGroups.length === 0 ? <ViewEmpty view={view} searching={!!searchQuery} /> :
          upcomingGroups.map(([date, dateTasks]) => (
            <section key={date} className="mb-5" aria-labelledby={`group-${date}`}>
              <h2 id={`group-${date}`} className="group-label">{formatGroupDate(date)}</h2>
              <ul className="task-ul">
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
              </ul>
            </section>
          ))
        ) : (
          <>
            {activeTasks.length === 0 && view !== 'completed' && <ViewEmpty view={view} searching={!!searchQuery} />}
            {activeTasks.length > 0 && (
              <ul className="task-ul" aria-label={`${viewTitle} tasks`}>
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
              </ul>
            )}
          </>
        )}

        {/* Completed section (inline in non-completed views) */}
        {completedTasks.length > 0 && view !== 'completed' && (
          <section className="mt-2" aria-labelledby="completed-toggle">
            <h2>
              <button
                id="completed-toggle"
                className="sidebar-heading"
                style={{ padding: '8px 4px', fontSize: '.75rem', letterSpacing: 0, textTransform: 'none', fontWeight: 600 }}
                aria-expanded={completedOpen}
                onClick={() => setCompletedOpen(v => !v)}
              >
                {completedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                Completed · {completedTasks.length}
              </button>
            </h2>
            {completedOpen && (
              <ul className="task-ul">
                {completedTasks.map(task => (
                  <TaskRow
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  isChecked={bulkSelected.has(task.id)}
                  onSelect={handleSelect}
                  onBulkToggle={handleBulkToggle}
                />
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Completed view */}
        {view === 'completed' && (
          completedTasks.length === 0
            ? <ViewEmpty view={view} searching={!!searchQuery} />
            : (
              <ul className="task-ul" aria-label="Completed tasks">
                {completedTasks.map(task => (
                  <TaskRow
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  isChecked={bulkSelected.has(task.id)}
                  onSelect={handleSelect}
                  onBulkToggle={handleBulkToggle}
                />
                ))}
              </ul>
            )
        )}
      </div>
    </div>
  )
}
