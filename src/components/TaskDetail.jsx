// ── Task detail panel ──────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X, Trash2, Play, Square, Calendar, Flag, Tag, Folder, RotateCcw,
  Plus, Eye, EyeOff, ChevronDown
} from '../icons.jsx'
import { useStore } from '../store/context.js'
import { getTaskHistory } from '../db.js'
import { ConfirmDelete } from './Modals/ConfirmDelete.jsx'
import { scheduleNotification } from '../hooks/useNotifications.js'
import { useElapsed } from '../hooks/useElapsed.js'
import { renderMarkdown } from '../utils/markdown.js'
import { tint, ink } from '../utils/colors.js'

const PRIORITY_OPTIONS = [
  { value: 0, label: 'None',   color: 'var(--text-3)' },
  { value: 1, label: 'Low',    color: 'var(--prio-1)' },
  { value: 2, label: 'Medium', color: 'var(--prio-2)' },
  { value: 3, label: 'High',   color: 'var(--prio-3)' },
]

const FREQ_OPTIONS = ['none','daily','weekly','monthly']

const formatDuration = (ms) => {
  if (!ms) return '0m'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export const TaskDetail = ({ onClose }) => {
  const { state, updateTask, deleteTask, completeTask, uncompleteTask, startTimer, stopTimer, createTask } = useStore()
  const task = state.tasks.find(t => t.id === state.selectedTaskId)

  const [showPreview, setShowPreview] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [history, setHistory] = useState([])
  const [newSubtask, setNewSubtask] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [showTagDropdown, setShowTagDropdown] = useState(false)

  const isTimerRunning = task?.timerStartedAt != null
  const elapsed = useElapsed(task?.timerStartedAt ?? null)
  const taskId = task?.id
  const taskUpdatedAt = task?.updatedAt

  useEffect(() => {
    if (!taskId) return
    let alive = true
    getTaskHistory(taskId).then(h => {
      if (alive) setHistory(h.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10))
    })
    return () => { alive = false }
  }, [taskId, taskUpdatedAt])

  const subtasks = useMemo(() =>
    task ? state.tasks.filter(t => t.parentId === task.id) : []
  , [task, state.tasks])

  const update = useCallback((changes) => {
    if (!task) return
    updateTask(task.id, changes)
  }, [task, updateTask])

  const handleDelete = useCallback(async () => {
    await deleteTask(task.id)
    setShowConfirmDelete(false)
    onClose()
  }, [task, deleteTask, onClose])

  const handleAddSubtask = useCallback(async (e) => {
    if (e.key !== 'Enter' || !newSubtask.trim()) return
    await createTask({ title: newSubtask.trim(), parentId: task.id, projectId: task.projectId, order: Date.now() })
    setNewSubtask('')
  }, [newSubtask, task, createTask])

  const handleTimerToggle = useCallback(async () => {
    if (isTimerRunning) await stopTimer(task.id)
    else await startTimer(task.id)
  }, [isTimerRunning, task, startTimer, stopTimer])

  const handleScheduleNotification = useCallback(() => {
    if (task) scheduleNotification(task)
  }, [task])

  const toggleTag = useCallback((tagId) => {
    if (!task) return
    const tags = task.tags || []
    update({ tags: tags.includes(tagId) ? tags.filter(t => t !== tagId) : [...tags, tagId] })
  }, [task, update])

  const filteredTags = useMemo(() =>
    state.tags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
  , [state.tags, tagSearch])

  if (!task) return null

  const tagObjs = (task.tags || []).map(tid => state.tags.find(t => t.id === tid)).filter(Boolean)
  const totalTracked = (task.timeTracked || 0) + (isTimerRunning ? elapsed : 0)

  return (
    <div
      className="flex flex-col h-full anim-slide-in-right overflow-hidden"
      style={{
        width: 320,
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ color: 'var(--text-4)', fontSize: '.75rem', fontWeight: 600 }}>TASK DETAIL</span>
        <button className="btn btn-ghost p-1" onClick={onClose} aria-label="Close detail panel">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Title */}
        <textarea
          value={task.title}
          onChange={e => update({ title: e.target.value })}
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text-1)',
            fontFamily: 'var(--font-sans)',
            fontSize: '1.15rem',
            fontWeight: 700,
            lineHeight: 1.4,
            width: '100%',
            resize: 'none',
            minHeight: 64,
          }}
          placeholder="Task title"
          aria-label="Task title"
        />

        {/* Complete / Priority */}
        <div className="flex items-center gap-2">
          <button
            className="btn flex-1"
            onClick={() => task.completed ? uncompleteTask(task.id) : completeTask(task.id)}
            style={{
              background: task.completed ? tint('var(--success)', 12) : 'var(--bg-card)',
              color: task.completed ? 'var(--success)' : 'var(--text-2)',
              border: '1px solid',
              borderColor: task.completed ? tint('var(--success)', 35) : 'var(--border)',
              fontSize: '.8rem',
            }}
          >
            {task.completed ? '✓ Completed' : '○ Mark complete'}
          </button>
        </div>

        {/* Priority */}
        <div>
          <label style={{ color: 'var(--text-4)', fontSize: '.7rem', fontWeight: 600 }}>PRIORITY</label>
          <div className="flex gap-1.5 mt-1">
            {PRIORITY_OPTIONS.map(({ value, label, color }) => (
              <button
                key={value}
                className="btn flex-1"
                onClick={() => update({ priority: value })}
                style={{
                  fontSize: '.75rem',
                  padding: '4px 6px',
                  background: task.priority === value ? tint(color) : 'var(--bg-card)',
                  color: task.priority === value ? color : 'var(--text-3)',
                  border: `1px solid ${task.priority === value ? tint(color, 40) : 'var(--border)'}`,
                  fontWeight: task.priority === value ? 600 : 400,
                }}
                aria-label={`Priority: ${label}`}
                aria-pressed={task.priority === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Due date + time */}
        <div>
          <label style={{ color: 'var(--text-4)', fontSize: '.7rem', fontWeight: 600 }}>DUE DATE</label>
          <div className="flex gap-2 mt-1">
            <input
              type="date"
              className="input-base flex-1"
              value={task.dueDate || ''}
              onChange={e => {
                update({ dueDate: e.target.value || null })
                if (e.target.value && task.dueTime) handleScheduleNotification()
              }}
              aria-label="Due date"
            />
            <input
              type="time"
              className="input-base"
              style={{ width: 100 }}
              value={task.dueTime || ''}
              onChange={e => {
                update({ dueTime: e.target.value || null })
                if (task.dueDate && e.target.value) handleScheduleNotification()
              }}
              aria-label="Due time"
            />
          </div>
        </div>

        {/* Project */}
        <div>
          <label style={{ color: 'var(--text-4)', fontSize: '.7rem', fontWeight: 600 }}>PROJECT</label>
          <select
            className="input-base mt-1"
            value={task.projectId || ''}
            onChange={e => update({ projectId: e.target.value || null })}
            aria-label="Project"
          >
            <option value="">Inbox (no project)</option>
            {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Tags */}
        <div>
          <label style={{ color: 'var(--text-4)', fontSize: '.7rem', fontWeight: 600 }}>TAGS</label>
          <div className="mt-1 relative">
            <div
              className="flex flex-wrap gap-1 p-2 rounded-lg cursor-text min-h-8"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={() => setShowTagDropdown(true)}
            >
              {tagObjs.map(tag => (
                <span key={tag.id} className="tag-chip" style={{ background: tint(tag.color), color: ink(tag.color) }}>
                  #{tag.name}
                  <button
                    onClick={e => { e.stopPropagation(); toggleTag(tag.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 0 0 2px', fontSize: '.8rem' }}
                    aria-label={`Remove tag ${tag.name}`}
                  >✕</button>
                </span>
              ))}
              <input
                value={tagSearch}
                onChange={e => { setTagSearch(e.target.value); setShowTagDropdown(true) }}
                onFocus={() => setShowTagDropdown(true)}
                placeholder={tagObjs.length === 0 ? 'Add tags…' : ''}
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: '.8rem', color: 'var(--text-1)', minWidth: 60, flex: 1 }}
                aria-label="Search tags"
              />
            </div>
            {showTagDropdown && (
              <div
                className="absolute z-10 w-full mt-1 rounded-xl py-1"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', maxHeight: 160, overflowY: 'auto' }}
                onMouseDown={e => e.preventDefault()}
              >
                {filteredTags.map(tag => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
                    style={{ background: (task.tags || []).includes(tag.id) ? 'var(--accent-soft)' : 'transparent' }}
                    onClick={() => { toggleTag(tag.id); setShowTagDropdown(false); setTagSearch('') }}
                  >
                    <div className="rounded-full" style={{ width: 8, height: 8, background: tag.color }} />
                    <span style={{ fontSize: '.85rem', color: 'var(--text-1)' }}>#{tag.name}</span>
                    {(task.tags || []).includes(tag.id) && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: '.8rem' }}>✓</span>}
                  </div>
                ))}
                {filteredTags.length === 0 && (
                  <div style={{ padding: '8px 12px', color: 'var(--text-4)', fontSize: '.8rem' }}>No tags found</div>
                )}
                <button
                  className="btn btn-ghost w-full justify-start px-3 py-1.5"
                  style={{ fontSize: '.8rem', borderTop: '1px solid var(--border-light)', borderRadius: 0 }}
                  onClick={() => setShowTagDropdown(false)}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recurring */}
        <div>
          <label style={{ color: 'var(--text-4)', fontSize: '.7rem', fontWeight: 600 }}>RECURRING</label>
          <div className="flex gap-1.5 mt-1">
            {FREQ_OPTIONS.map(freq => (
              <button
                key={freq}
                className="btn flex-1"
                onClick={() => update({ recurring: freq === 'none' ? null : { freq, interval: 1 } })}
                style={{
                  fontSize: '.72rem',
                  padding: '4px 4px',
                  background: (task.recurring?.freq === freq || (!task.recurring && freq === 'none')) ? 'var(--accent-soft)' : 'var(--bg-card)',
                  color: (task.recurring?.freq === freq || (!task.recurring && freq === 'none')) ? 'var(--accent)' : 'var(--text-3)',
                  border: `1px solid ${(task.recurring?.freq === freq || (!task.recurring && freq === 'none')) ? 'var(--accent-border)' : 'var(--border)'}`,
                  textTransform: 'capitalize',
                }}
              >
                {freq}
              </button>
            ))}
          </div>
        </div>

        {/* Time tracking */}
        <div>
          <label style={{ color: 'var(--text-4)', fontSize: '.7rem', fontWeight: 600 }}>TIME TRACKED</label>
          <div className="flex items-center gap-2 mt-1">
            <span className="timer-digits" style={{ color: 'var(--text-1)', fontSize: '1.1rem', fontWeight: 600 }}>
              {formatDuration(totalTracked)}
            </span>
            <button
              className="btn btn-ghost p-1.5 ml-auto"
              onClick={handleTimerToggle}
              style={{ color: isTimerRunning ? 'var(--accent)' : 'var(--text-3)' }}
              aria-label={isTimerRunning ? 'Stop timer' : 'Start timer'}
            >
              {isTimerRunning ? <Square size={16} /> : <Play size={16} />}
            </button>
            {isTimerRunning && (
              <span style={{ color: 'var(--accent)', fontSize: '.75rem' }} className="anim-pulse-glow">
                Running
              </span>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label style={{ color: 'var(--text-4)', fontSize: '.7rem', fontWeight: 600 }}>NOTES</label>
            <button
              className="btn btn-ghost p-1"
              onClick={() => setShowPreview(v => !v)}
              aria-label={showPreview ? 'Edit notes' : 'Preview notes'}
              style={{ fontSize: '.7rem' }}
            >
              {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
              {showPreview ? ' Edit' : ' Preview'}
            </button>
          </div>
          {showPreview ? (
            <div
              className="markdown-preview rounded-lg p-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', minHeight: 80, fontSize: '.875rem', color: 'var(--text-2)' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(task.notes) || '<span style="color:var(--text-4);font-style:italic">No notes</span>' }}
            />
          ) : (
            <textarea
              className="input-base"
              value={task.notes || ''}
              onChange={e => update({ notes: e.target.value })}
              placeholder="Add notes (markdown supported)…"
              style={{ minHeight: 100, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '.8rem' }}
              aria-label="Notes"
            />
          )}
        </div>

        {/* Subtasks */}
        <div>
          <label style={{ color: 'var(--text-4)', fontSize: '.7rem', fontWeight: 600 }}>SUBTASKS ({subtasks.length})</label>
          <div className="mt-1 space-y-1">
            {subtasks.map(sub => (
              <div key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <button
                  className={`custom-checkbox ${sub.completed ? 'checked' : ''}`}
                  onClick={() => sub.completed ? uncompleteTask(sub.id) : completeTask(sub.id)}
                  style={{ width: 15, height: 15 }}
                  aria-label={sub.completed ? 'Mark subtask incomplete' : 'Mark subtask complete'}
                >
                  {sub.completed && <svg width="8" height="6" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 4l3 3 5-6"/></svg>}
                </button>
                <span style={{ flex: 1, fontSize: '.825rem', color: sub.completed ? 'var(--text-4)' : 'var(--text-1)', textDecoration: sub.completed ? 'line-through' : 'none' }}>
                  {sub.title}
                </span>
                <button
                  className="btn btn-ghost p-0.5"
                  onClick={() => deleteTask(sub.id)}
                  aria-label="Delete subtask"
                  style={{ opacity: 0.4 }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <input
              className="input-base"
              placeholder="Add subtask… (Enter)"
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={handleAddSubtask}
              aria-label="Add subtask"
              style={{ fontSize: '.825rem' }}
            />
          </div>
        </div>

        {/* Activity */}
        {history.length > 0 && (
          <div>
            <label style={{ color: 'var(--text-4)', fontSize: '.7rem', fontWeight: 600 }}>ACTIVITY</label>
            <div className="mt-1 space-y-1">
              {history.map(h => (
                <div key={h.id} className="flex items-start gap-2" style={{ fontSize: '.75rem', color: 'var(--text-4)' }}>
                  <span style={{ flexShrink: 0 }}>
                    {h.action === 'created' ? '✦' : h.action === 'completed' ? '✓' : h.action === 'deleted' ? '✕' : '✎'}
                  </span>
                  <span style={{ flex: 1 }}>
                    {h.action.charAt(0).toUpperCase() + h.action.slice(1)}
                  </span>
                  <span>{new Date(h.timestamp).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div style={{ fontSize: '.7rem', color: 'var(--text-4)' }}>
          <div>Created: {new Date(task.createdAt).toLocaleString()}</div>
          {task.updatedAt !== task.createdAt && <div>Updated: {new Date(task.updatedAt).toLocaleString()}</div>}
          {task.completedAt && <div>Completed: {new Date(task.completedAt).toLocaleString()}</div>}
        </div>

        {/* Delete */}
        <button
          className="btn btn-danger w-full"
          data-feat="danger"
          onClick={() => setShowConfirmDelete(true)}
          aria-label="Delete task"
        >
          <Trash2 size={14} /> Delete task
        </button>
      </div>

      {showConfirmDelete && (
        <ConfirmDelete
          message={`Delete "${task.title}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirmDelete(false)}
        />
      )}
    </div>
  )
}
