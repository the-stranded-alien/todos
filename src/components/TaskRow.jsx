// ── Task row ───────────────────────────────────────────────
import { useState, useCallback, useRef, useEffect } from 'react'
import { Play, Square, ChevronRight, ChevronDown, Calendar, Flag, RotateCcw } from 'lucide-react'
import { useStore } from '../useStore.jsx'

const PRIORITY_COLORS = ['transparent', '#3b82f6', '#eab308', '#ef4444']
const PRIORITY_LABELS = ['', 'low', 'med', 'high']

const formatDuration = (ms) => {
  if (!ms) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const formatDate = (d) => {
  if (!d) return null
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  if (d === today) return 'Today'
  if (d === tomorrow) return 'Tomorrow'
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
  const { state, completeTask, uncompleteTask, updateTask, startTimer, stopTimer, deleteTask } = useStore()
  const [completing, setCompleting] = useState(false)
  const [subtasksOpen, setSubtasksOpen] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(task.title)
  const titleRef = useRef(null)

  const subtasks = state.tasks.filter(t => t.parentId === task.id)
  const hasSubtasks = subtasks.length > 0

  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = task.dueDate && task.dueDate < today && !task.completed
  const isTimerRunning = task.timerStartedAt != null

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!isTimerRunning) { setElapsed(0); return }
    const tick = () => setElapsed(Date.now() - task.timerStartedAt)
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isTimerRunning, task.timerStartedAt])

  const handleCheck = useCallback(async (e) => {
    e.stopPropagation()
    if (task.completed) {
      await uncompleteTask(task.id)
      return
    }
    setCompleting(true)
    setTimeout(async () => {
      await completeTask(task.id)
      setCompleting(false)
    }, 300)
  }, [task.completed, task.id, completeTask, uncompleteTask])

  const handleTitleBlur = useCallback(async () => {
    setEditingTitle(false)
    if (titleVal.trim() !== task.title) {
      if (!titleVal.trim()) {
        await deleteTask(task.id)
      } else {
        await updateTask(task.id, { title: titleVal.trim() })
      }
    }
  }, [titleVal, task.title, task.id, updateTask, deleteTask])

  const handleTitleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.target.blur() }
    if (e.key === 'Escape') { setTitleVal(task.title); setEditingTitle(false) }
    if (e.key === 'Backspace' && !titleVal) {
      e.preventDefault()
      deleteTask(task.id)
    }
  }, [task.title, task.id, titleVal, deleteTask])

  const handleTimerToggle = useCallback(async (e) => {
    e.stopPropagation()
    if (isTimerRunning) await stopTimer(task.id)
    else await startTimer(task.id)
  }, [isTimerRunning, task.id, startTimer, stopTimer])

  const timerDisplay = isTimerRunning
    ? formatDuration((task.timeTracked || 0) + elapsed)
    : formatDuration(task.timeTracked)

  const tagObjs = (task.tags || [])
    .map(tid => state.tags.find(t => t.id === tid))
    .filter(Boolean)

  const project = task.projectId ? state.projects.find(p => p.id === task.projectId) : null

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div
        className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer priority-border-${task.priority} ${completing ? 'completing' : ''} ${dragging ? 'dragging' : ''} ${dropTarget === 'above' ? 'drop-target-above' : ''} ${dropTarget === 'below' ? 'drop-target-below' : ''}`}
        style={{
          background: isSelected ? 'var(--accent-soft)' : 'transparent',
          borderRight: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
          transition: 'background .1s',
          userSelect: 'none',
        }}
        onClick={() => onSelect(task.id)}
        draggable={!editingTitle}
        onDragStart={e => { e.dataTransfer.setData('taskId', task.id); onDragStart?.(task.id) }}
        onDragOver={e => { e.preventDefault(); onDragOver?.(task.id) }}
        onDrop={e => { e.preventDefault(); onDrop?.(task.id) }}
        role="row"
        aria-label={task.title}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === ' ') { e.preventDefault(); handleCheck(e) }
        }}
      >
        {/* Bulk checkbox */}
        <input
          type="checkbox"
          checked={isChecked}
          onChange={e => { e.stopPropagation(); onBulkToggle(task.id) }}
          className="opacity-0 group-hover:opacity-100 w-3 h-3 flex-shrink-0"
          style={{ accentColor: 'var(--accent)' }}
          aria-label={`Select ${task.title}`}
          onClick={e => e.stopPropagation()}
        />

        {/* Subtask toggle */}
        {hasSubtasks ? (
          <button
            className="btn btn-ghost p-0"
            onClick={e => { e.stopPropagation(); setSubtasksOpen(v => !v) }}
            aria-label={subtasksOpen ? 'Collapse subtasks' : 'Expand subtasks'}
            style={{ width: 16, height: 16, flexShrink: 0, color: 'var(--text-4)' }}
          >
            {subtasksOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <div style={{ width: 16, flexShrink: 0 }} />
        )}

        {/* Checkbox */}
        <button
          className={`custom-checkbox ${task.completed ? 'checked' : ''}`}
          onClick={handleCheck}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
          style={{ borderColor: task.priority > 0 ? PRIORITY_COLORS[task.priority] : undefined }}
        >
          {task.completed && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4l3 3 5-6" />
            </svg>
          )}
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              ref={titleRef}
              value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              style={{
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--text-1)',
                fontFamily: 'var(--font-sans)',
                fontSize: '.875rem',
                width: '100%',
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              onDoubleClick={e => { e.stopPropagation(); setEditingTitle(true) }}
              style={{
                color: task.completed ? 'var(--text-4)' : 'var(--text-1)',
                textDecoration: task.completed ? 'line-through' : 'none',
                fontSize: '.875rem',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {task.title || <span style={{ color: 'var(--text-4)', fontStyle: 'italic' }}>Untitled</span>}
            </span>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {task.dueDate && (
              <span style={{ fontSize: '.7rem', color: isOverdue ? '#ef4444' : 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Calendar size={10} />
                {formatDate(task.dueDate)}{task.dueTime ? ` ${task.dueTime}` : ''}
              </span>
            )}
            {task.recurring && (
              <span style={{ fontSize: '.7rem', color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 2 }}>
                <RotateCcw size={10} /> recurring
              </span>
            )}
            {tagObjs.map(tag => (
              <span key={tag.id} className="tag-chip" style={{ background: tag.color + '22', color: tag.color, fontSize: '.65rem', padding: '1px 5px' }}>
                #{tag.name}
              </span>
            ))}
            {timerDisplay && (
              <span className="timer-digits" style={{ fontSize: '.7rem', color: isTimerRunning ? 'var(--accent)' : 'var(--text-4)' }}>
                {isTimerRunning ? `▶ ${timerDisplay}` : timerDisplay}
              </span>
            )}
          </div>
        </div>

        {/* Timer button */}
        <button
          className="btn btn-ghost p-1 opacity-0 group-hover:opacity-100"
          onClick={handleTimerToggle}
          aria-label={isTimerRunning ? 'Stop timer' : 'Start timer'}
          style={{ color: isTimerRunning ? 'var(--accent)' : 'var(--text-4)', flexShrink: 0 }}
        >
          {isTimerRunning ? <Square size={13} /> : <Play size={13} />}
        </button>

        {/* Priority dot */}
        {task.priority > 0 && (
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: PRIORITY_COLORS[task.priority],
              flexShrink: 0,
            }}
            title={`Priority: ${PRIORITY_LABELS[task.priority]}`}
          />
        )}
      </div>

      {/* Subtasks */}
      {hasSubtasks && subtasksOpen && (
        <div>
          {subtasks
            .filter(t => !t.completed)
            .map(sub => (
              <TaskRow
                key={sub.id}
                task={sub}
                depth={depth + 1}
                isSelected={state.selectedTaskId === sub.id}
                isChecked={state.bulkSelected.has(sub.id)}
                onSelect={id => {}}
                onBulkToggle={() => {}}
              />
            ))
          }
        </div>
      )}
    </div>
  )
}
