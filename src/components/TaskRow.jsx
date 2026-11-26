// ── Task row ───────────────────────────────────────────────
import { useState, useCallback } from 'react'
import { Play, Square, ChevronRight, ChevronDown, Calendar, RotateCcw, Eye, Copy, Flag, Trash2, Pencil } from '../icons.jsx'
import { IconButton } from './ui/IconButton.jsx'
import { ContextMenu } from './ui/Menu.jsx'
import { toast } from '../toast.js'
import { useStore } from '../store/context.js'
import { todayISO, addDaysISO, parseLocalISO } from '../utils/dates.js'
import { useElapsed } from '../hooks/useElapsed.js'
import { PRIORITY_VARS, tint, ink } from '../utils/colors.js'

const PRIORITY_COLORS = ['transparent', ...PRIORITY_VARS.slice(1)]

const formatDuration = (ms) => {
  if (!ms) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const formatDate = (d) => {
  if (!d) return null
  const today = todayISO()
  const tomorrow = addDaysISO(1)
  if (d === today) return 'Today'
  if (d === tomorrow) return 'Tomorrow'
  return parseLocalISO(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const TaskRow = ({
  task,
  depth = 0,
  isSelected,
  isChecked,
  onSelect,
  onBulkToggle,
  onDragStart,
  onDragOver,
  onDrop,
  dragging,
  dropTarget,
}) => {
  const { state, completeTask, uncompleteTask, updateTask, startTimer, stopTimer, deleteTask, createTask, undo } = useStore()
  const [menuAt, setMenuAt] = useState(null) // { x, y, returnFocus }
  const [completing, setCompleting]   = useState(false)
  const [subtasksOpen, setSubtasksOpen] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal]       = useState(task.title)
  const [hovered, setHovered]         = useState(false)

  const subtasks    = state.tasks.filter(t => t.parentId === task.id && !t.completed)
  const hasSubtasks = subtasks.length > 0

  const today    = todayISO()
  const isOverdue = task.dueDate && task.dueDate < today && !task.completed
  const isTimerRunning = task.timerStartedAt != null

  const elapsed = useElapsed(task.timerStartedAt)

  const handleCheck = useCallback(async (e) => {
    e.stopPropagation()
    if (task.completed) { await uncompleteTask(task.id); return }
    setCompleting(true)
    setTimeout(async () => {
      await completeTask(task.id)
      setCompleting(false)
    }, 280)
  }, [task.completed, task.id, completeTask, uncompleteTask])

  const handleTitleBlur = useCallback(async () => {
    setEditingTitle(false)
    const trimmed = titleVal.trim()
    if (trimmed === task.title) return
    if (!trimmed) await deleteTask(task.id)
    else          await updateTask(task.id, { title: trimmed })
  }, [titleVal, task.title, task.id, updateTask, deleteTask])

  const handleTitleKeyDown = useCallback((e) => {
    if (e.key === 'Enter')   { e.target.blur() }
    if (e.key === 'Escape')  { setTitleVal(task.title); setEditingTitle(false) }
    if (e.key === 'Backspace' && !titleVal) { e.preventDefault(); deleteTask(task.id) }
  }, [task.title, task.id, titleVal, deleteTask])

  const handleTimerToggle = useCallback(async (e) => {
    e.stopPropagation()
    if (isTimerRunning) await stopTimer(task.id)
    else                await startTimer(task.id)
  }, [isTimerRunning, task.id, startTimer, stopTimer])

  const removeWithUndo = useCallback(async () => {
    await deleteTask(task.id)
    toast({ message: `Deleted “${task.title || 'Untitled'}”.`, action: { label: 'Undo', onClick: undo } })
  }, [deleteTask, task.id, task.title, undo])

  const openMenu = (x, y, returnFocus) => setMenuAt({ x, y, returnFocus })
  const menuItems = [
    { label: 'Open details', icon: Eye, kbd: 'Enter', onSelect: () => onSelect(task.id) },
    { label: 'Rename', icon: Pencil, onSelect: () => { setTitleVal(task.title); setEditingTitle(true) } },
    { label: 'Duplicate', icon: Copy, onSelect: () => {
      const { id: _id, createdAt: _c, updatedAt: _u, completed: _d, completedAt: _a, timerStartedAt: _t, ...rest } = task
      createTask({ ...rest, title: `${task.title} (copy)`, timeTracked: 0, order: task.order + 0.5 })
    } },
    { separator: true },
    { heading: 'Priority' },
    ...['None', 'Low', 'Medium', 'High'].map((label, p) => ({
      label, checked: task.priority === p, icon: p ? Flag : undefined, feat: ['', 'info', 'warning', 'danger'][p] || undefined,
      onSelect: () => updateTask(task.id, { priority: p }),
    })),
    { separator: true },
    { label: 'Delete', icon: Trash2, danger: true, kbd: 'Del', onSelect: removeWithUndo },
  ]

  const handleRowKeyDown = (e) => {
    if (e.target !== e.currentTarget) return
    if (e.key === ' ') { e.preventDefault(); handleCheck(e) }
    else if (e.key === 'Enter') { e.preventDefault(); onSelect(task.id) }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeWithUndo() }
    else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault()
      const r = e.currentTarget.getBoundingClientRect()
      openMenu(r.left + 40, r.top + r.height / 2, e.currentTarget)
    }
  }

  const timerDisplay = isTimerRunning
    ? formatDuration((task.timeTracked || 0) + elapsed)
    : formatDuration(task.timeTracked)

  const tagObjs = (task.tags || [])
    .map(tid => state.tags.find(t => t.id === tid))
    .filter(Boolean)

  const hasMeta = task.dueDate || task.recurring || tagObjs.length > 0 || timerDisplay

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div
        className={`group ${completing ? 'completing' : ''} ${dragging ? 'dragging' : ''} ${dropTarget === 'above' ? 'drop-target-above' : ''}`}
        style={{
          display: 'flex',
          alignItems: hasMeta ? 'flex-start' : 'center',
          gap: 8,
          padding: 'var(--row-py) 10px',
          marginBottom: 3,
          borderRadius: 10,
          cursor: 'pointer',
          background: isSelected
            ? 'var(--accent-soft)'
            : hovered ? 'var(--bg-card)' : 'transparent',
          border: `1px solid ${isSelected ? 'var(--accent-border)' : hovered ? 'var(--border)' : 'transparent'}`,
          boxShadow: isSelected || hovered ? 'var(--shadow-sm)' : 'none',
          borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}`,
          transition: 'background .1s, border-color .1s, box-shadow .1s',
          userSelect: 'none',
          opacity: task.completed ? 0.6 : 1,
        }}
        onClick={() => onSelect(task.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        draggable={!editingTitle}
        onDragStart={e => { e.dataTransfer.setData('taskId', task.id); onDragStart?.(task.id) }}
        onDragOver={e => { e.preventDefault(); onDragOver?.(task.id) }}
        onDrop={e => { e.preventDefault(); onDrop?.(task.id) }}
        role="row"
        aria-label={task.title}
        tabIndex={0}
        onKeyDown={handleRowKeyDown}
        onContextMenu={e => { e.preventDefault(); openMenu(e.clientX, e.clientY, e.currentTarget) }}
      >
        {/* Bulk checkbox — shows on hover */}
        <input
          type="checkbox"
          checked={isChecked}
          onChange={e => { e.stopPropagation(); onBulkToggle?.(task.id) }}
          className="opacity-0 group-hover:opacity-100"
          style={{ width: 13, height: 13, flexShrink: 0, marginTop: 2, accentColor: 'var(--accent)', cursor: 'pointer' }}
          aria-label={`Select ${task.title}`}
          onClick={e => e.stopPropagation()}
        />

        {/* Subtask collapse toggle */}
        {hasSubtasks ? (
          <IconButton
            label={subtasksOpen ? 'Hide subtasks' : 'Show subtasks'}
            icon={subtasksOpen ? ChevronDown : ChevronRight}
            size={12}
            small
            aria-expanded={subtasksOpen}
            onClick={e => { e.stopPropagation(); setSubtasksOpen(v => !v) }}
            style={{ minWidth: 20, width: 20, height: 20, marginTop: hasMeta ? 0 : 0 }}
          />
        ) : (
          <div style={{ width: 20, flexShrink: 0 }} />
        )}

        {/* Completion circle */}
        <button
          className={`custom-checkbox ${task.completed ? 'checked' : ''}`}
          onClick={handleCheck}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
          data-tooltip={task.completed ? 'Mark incomplete' : 'Mark complete'}
          style={{
            marginTop: hasMeta ? 1 : 0,
            borderColor: task.priority > 0 ? PRIORITY_COLORS[task.priority] : undefined,
          }}
        >
          {task.completed && (
            <svg width="9" height="7" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4l3 3 5-6" />
            </svg>
          )}
        </button>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              style={{
                background: 'none', border: 'none', outline: 'none',
                color: 'var(--text-1)', fontFamily: 'var(--font-sans)',
                fontSize: '.875rem', width: '100%',
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              onDoubleClick={e => { e.stopPropagation(); setTitleVal(task.title); setEditingTitle(true) }}
              style={{
                color: task.completed ? 'var(--text-4)' : 'var(--text-1)',
                textDecoration: task.completed ? 'line-through' : 'none',
                fontSize: '.875rem',
                lineHeight: 1.45,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {task.title || <em style={{ color: 'var(--text-4)' }}>Untitled</em>}
            </span>
          )}

          {/* Meta row */}
          {hasMeta && (
            <div className="flex items-center flex-wrap mt-0.5" style={{ gap: '6px' }}>
              {task.dueDate && (
                <span style={{ fontSize: '.7rem', color: isOverdue ? 'var(--danger)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Calendar size={10} />
                  {formatDate(task.dueDate)}{task.dueTime ? ` · ${task.dueTime}` : ''}
                </span>
              )}
              {task.recurring && (
                <span style={{ fontSize: '.7rem', color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <RotateCcw size={10} /> recurring
                </span>
              )}
              {tagObjs.map(tag => (
                <span key={tag.id} className="tag-chip" style={{ background: tint(tag.color), color: ink(tag.color), fontSize: '.65rem', padding: '1px 6px' }}>
                  {tag.name}
                </span>
              ))}
              {timerDisplay && (
                <span className="timer-digits" style={{ fontSize: '.68rem', color: isTimerRunning ? 'var(--accent)' : 'var(--text-4)' }}>
                  {isTimerRunning ? `▶ ${timerDisplay}` : timerDisplay}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timer toggle — shows on hover or focus */}
        <IconButton
          label={isTimerRunning ? 'Stop timer' : 'Start timer'}
          icon={isTimerRunning ? Square : Play}
          size={13}
          small
          pressed={isTimerRunning}
          data-feat="warning"
          className={isTimerRunning ? '' : 'row-reveal'}
          tooltipAlign="end"
          onClick={handleTimerToggle}
        />
      </div>

      {menuAt && (
        <ContextMenu
          x={menuAt.x}
          y={menuAt.y}
          label={`Actions for ${task.title || 'Untitled'}`}
          items={menuItems}
          returnFocus={menuAt.returnFocus}
          onClose={() => setMenuAt(null)}
        />
      )}

      {/* Subtasks */}
      {hasSubtasks && subtasksOpen && (
        <div style={{ marginBottom: 2 }}>
          {subtasks.map(sub => (
            <TaskRow
              key={sub.id}
              task={sub}
              depth={depth + 1}
              isSelected={state.selectedTaskId === sub.id}
              isChecked={state.bulkSelected.has(sub.id)}
              onSelect={onSelect}
              onBulkToggle={onBulkToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
