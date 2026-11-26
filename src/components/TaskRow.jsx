// ── Task row ───────────────────────────────────────────────
// A list item. The title is a real button (Enter opens details, Space
// completes, Delete deletes with Undo, Shift+F10 opens the actions menu);
// the other controls are sibling buttons, never nested.
import { useState, useCallback, useId } from 'react'
import { Play, Square, ChevronRight, ChevronDown, Calendar, RotateCcw, Eye, Copy, Flag, Trash2, Pencil } from '../icons.jsx'
import { IconButton } from './ui/IconButton.jsx'
import { ContextMenu } from './ui/Menu.jsx'
import { toast } from '../toast.js'
import { useStore } from '../store/context.js'
import { todayISO, addDaysISO, parseLocalISO } from '../utils/dates.js'
import { useElapsed } from '../hooks/useElapsed.js'
import { PRIORITY_VARS, tint, ink } from '../utils/colors.js'
import { focusTaskRow } from '../utils/focus.js'
import { usePrefs } from '../prefs.js'

const PRIORITY_COLORS = ['transparent', ...PRIORITY_VARS.slice(1)]
const PRIORITY_NAMES = ['', 'Low priority', 'Medium priority', 'High priority']

const formatDuration = (ms) => {
  if (!ms) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const formatDate = (d) => {
  if (!d) return null
  if (d === todayISO()) return 'Today'
  if (d === addDaysISO(1)) return 'Tomorrow'
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
  const [completing, setCompleting] = useState(false)
  const [subtasksOpen, setSubtasksOpen] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(task.title)
  const metaId = useId()
  const prefs = usePrefs()

  const subtasks = state.tasks.filter(t => t.parentId === task.id && !t.completed)
  const hasSubtasks = subtasks.length > 0

  const isOverdue = task.dueDate && task.dueDate < todayISO() && !task.completed
  const isTimerRunning = task.timerStartedAt != null
  const elapsed = useElapsed(task.timerStartedAt)

  const handleCheck = useCallback(async (e) => {
    e?.stopPropagation()
    if (task.completed) { await uncompleteTask(task.id); return }
    setCompleting(true)
    setTimeout(async () => {
      await completeTask(task.id)
      setCompleting(false)
    }, 280)
  }, [task.completed, task.id, completeTask, uncompleteTask])

  const removeWithUndo = useCallback(async () => {
    const n = await deleteTask(task.id)
    const title = task.title || 'Untitled'
    toast({
      message: n > 1 ? `Deleted “${title}” and ${n - 1} subtask${n > 2 ? 's' : ''}.` : `Deleted “${title}”.`,
      action: { label: 'Undo', onClick: undo },
    })
  }, [deleteTask, task.id, task.title, undo])

  const startRename = () => { setTitleVal(task.title); setEditingTitle(true) }

  const handleTitleBlur = useCallback(async () => {
    setEditingTitle(false)
    const trimmed = titleVal.trim()
    if (trimmed === task.title) return
    if (!trimmed) await removeWithUndo()
    else await updateTask(task.id, { title: trimmed })
    focusTaskRow(task.id)
  }, [titleVal, task.title, task.id, updateTask, removeWithUndo])

  const handleTitleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
    if (e.key === 'Escape') { e.preventDefault(); setTitleVal(task.title); setEditingTitle(false); focusTaskRow(task.id) }
  }, [task.title, task.id])

  const handleTimerToggle = useCallback(async (e) => {
    e.stopPropagation()
    if (isTimerRunning) await stopTimer(task.id)
    else await startTimer(task.id)
  }, [isTimerRunning, task.id, startTimer, stopTimer])

  const openMenu = (x, y, returnFocus) => setMenuAt({ x, y, returnFocus })
  const menuItems = [
    { label: 'Open details', icon: Eye, kbd: 'Enter', onSelect: () => onSelect(task.id, { focus: true }) },
    { label: 'Rename', icon: Pencil, onSelect: startRename },
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

  const handleTitleButtonKeyDown = (e) => {
    if (e.key === ' ') { e.preventDefault(); handleCheck() }
    else if (e.key === 'Enter') { e.preventDefault(); onSelect(task.id, { focus: true }) }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeWithUndo() }
    else if (e.key === 'F2') { e.preventDefault(); startRename() }
    else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault()
      const r = e.currentTarget.getBoundingClientRect()
      openMenu(r.left + 24, r.bottom, e.currentTarget)
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
    <li
      className="task-li"
      data-task-id={task.id}
      style={{ marginLeft: depth * 24 }}
    >
      <div
        className={`group task-row ${completing ? 'completing' : ''} ${dragging ? 'dragging' : ''} ${dropTarget === 'above' ? 'drop-target-above' : ''}`}
        data-selected={isSelected || undefined}
        data-done={task.completed || undefined}
        style={{ alignItems: hasMeta ? 'flex-start' : 'center', borderLeftColor: PRIORITY_COLORS[task.priority] }}
        onClick={() => onSelect(task.id)}
        draggable={!editingTitle}
        onDragStart={e => { e.dataTransfer.setData('taskId', task.id); onDragStart?.(task.id) }}
        onDragOver={e => { e.preventDefault(); onDragOver?.(task.id) }}
        onDrop={e => { e.preventDefault(); onDrop?.(task.id) }}
        onContextMenu={e => { e.preventDefault(); openMenu(e.clientX, e.clientY, e.currentTarget.querySelector('.task-title')) }}
      >
        {/* Bulk select — shows on hover or keyboard focus */}
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onBulkToggle?.(task.id)}
          className={isChecked ? 'bulk-check' : 'bulk-check row-reveal'}
          aria-label={`Select “${task.title || 'Untitled'}”`}
          onClick={e => e.stopPropagation()}
        />

        {hasSubtasks ? (
          <IconButton
            label={subtasksOpen ? 'Hide subtasks' : 'Show subtasks'}
            icon={subtasksOpen ? ChevronDown : ChevronRight}
            size={12}
            small
            aria-expanded={subtasksOpen}
            onClick={e => { e.stopPropagation(); setSubtasksOpen(v => !v) }}
            style={{ minWidth: 20, width: 20, height: 20 }}
          />
        ) : (
          <span aria-hidden="true" style={{ width: 20, flexShrink: 0 }} />
        )}

        <button
          type="button"
          className={`custom-checkbox ${task.completed ? 'checked' : ''}`}
          onClick={handleCheck}
          aria-label={task.completed ? `Mark “${task.title}” incomplete` : `Complete “${task.title}”`}
          data-tooltip={task.completed ? 'Mark incomplete' : 'Mark complete'}
          style={{
            marginTop: hasMeta ? 1 : 0,
            borderColor: task.priority > 0 ? PRIORITY_COLORS[task.priority] : undefined,
          }}
        >
          {task.completed && (
            <svg aria-hidden="true" width="9" height="7" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4l3 3 5-6" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              className="task-title-input"
              value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              aria-label="Rename task"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              className="task-title"
              aria-describedby={hasMeta || task.priority || isOverdue ? metaId : undefined}
              aria-current={isSelected ? 'true' : undefined}
              aria-keyshortcuts="Enter Space Delete F2 Shift+F10"
              onClick={e => { e.stopPropagation(); onSelect(task.id) }}
              onDoubleClick={e => { e.stopPropagation(); startRename() }}
              onKeyDown={handleTitleButtonKeyDown}
            >
              {task.title || <em>Untitled</em>}
            </button>
          )}

          <div id={metaId} className={hasMeta ? 'task-meta' : 'sr-only'}>
            {task.priority > 0 && <span className="sr-only">{PRIORITY_NAMES[task.priority]}. </span>}
            {task.dueDate && (
              <span className="task-meta-item" style={{ color: isOverdue ? 'var(--danger)' : undefined }}>
                <Calendar size={10} />
                {isOverdue && <span className="sr-only">Overdue, due </span>}
                {formatDate(task.dueDate)}{task.dueTime ? ` · ${task.dueTime}` : ''}
              </span>
            )}
            {task.recurring && (
              <span className="task-meta-item">
                <RotateCcw size={10} /> Repeats {task.recurring.freq}
              </span>
            )}
            {tagObjs.map(tag => (
              <span key={tag.id} className="tag-chip" style={{ background: tint(tag.color), color: ink(tag.color), fontSize: '.65rem', padding: '1px 6px' }}>
                #{tag.name}
              </span>
            ))}
            {timerDisplay && (
              <span className="timer-digits task-meta-item" style={{ color: isTimerRunning ? 'var(--accent)' : undefined }}>
                {isTimerRunning ? `Timer running: ${timerDisplay}` : `${timerDisplay} tracked`}
              </span>
            )}
          </div>
        </div>

        {(prefs.timers || isTimerRunning) && <IconButton
          label={isTimerRunning ? 'Stop timer' : 'Start timer'}
          icon={isTimerRunning ? Square : Play}
          size={13}
          small
          pressed={isTimerRunning}
          data-feat="warning"
          className={isTimerRunning ? '' : 'row-reveal'}
          tooltipAlign="end"
          onClick={handleTimerToggle}
        />}
      </div>

      {menuAt && (
        <ContextMenu
          x={menuAt.x}
          y={menuAt.y}
          label={`Actions for “${task.title || 'Untitled'}”`}
          items={menuItems}
          returnFocus={menuAt.returnFocus}
          onClose={() => setMenuAt(null)}
        />
      )}

      {hasSubtasks && subtasksOpen && (
        <ul className="task-ul" aria-label={`Subtasks of “${task.title}”`}>
          {subtasks.map(sub => (
            <TaskRow
              key={sub.id}
              task={sub}
              depth={1}
              isSelected={state.selectedTaskId === sub.id}
              isChecked={state.bulkSelected.has(sub.id)}
              onSelect={onSelect}
              onBulkToggle={onBulkToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
