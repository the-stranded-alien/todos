// ── Task detail panel ──────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X, Trash2, Play, Square, Calendar, Flag, Tag, Folder, RotateCcw,
  Plus, Eye, EyeOff, ChevronDown
} from '../icons.jsx'
import { useStore } from '../store/context.js'
import { getTaskHistory } from '../db.js'
import { DraftText } from './ui/DraftText.jsx'
import { scheduleNotification } from '../hooks/useNotifications.js'
import { useElapsed } from '../hooks/useElapsed.js'
import { renderMarkdown } from '../utils/markdown.js'
import { IconButton } from './ui/IconButton.jsx'
import { toast } from '../toast.js'
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
  const { state, updateTask, deleteTask, completeTask, uncompleteTask, startTimer, stopTimer, createTask, undo } = useStore()
  const task = state.tasks.find(t => t.id === state.selectedTaskId)

  const [showPreview, setShowPreview] = useState(false)
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

  // Deleting is immediate and undoable (subtasks included)
  const handleDelete = useCallback(async () => {
    const title = task.title || 'Untitled'
    const n = await deleteTask(task.id)
    onClose()
    toast({
      message: n > 1 ? `Deleted “${title}” and ${n - 1} subtask${n > 2 ? 's' : ''}.` : `Deleted “${title}”.`,
      action: { label: 'Undo', onClick: undo },
    })
  }, [task, deleteTask, onClose, undo])

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
    <aside
      aria-label="Task details"
      className="detail-panel flex flex-col h-full anim-slide-in-right overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <h2 id="task-detail-heading" tabIndex={-1} className="detail-label" style={{ margin: 0, outline: 'none' }}>Task details</h2>
        <IconButton label="Close details" icon={X} onClick={onClose} tooltipAlign="end" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Title */}
        <DraftText
          key={`title-${task.id}`}
          id="task-detail-title"
          className="detail-title"
          value={task.title}
          onCommit={v => updateTask(task.id, { title: v }, { coalesce: 'title' })}
          rows={2}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-1)',
            fontFamily: 'var(--font-sans)',
            fontSize: '1.15rem',
            fontWeight: 700,
            lineHeight: 1.4,
            width: '100%',
            resize: 'none',
            minHeight: 64,
          }}
          placeholder="Task name"
          aria-label="Task name"
        />

        {/* Complete / Priority */}
        <div className="flex items-center gap-2">
          <button
            className="btn flex-1"
            onClick={() => task.completed ? uncompleteTask(task.id) : completeTask(task.id)}
            aria-pressed={task.completed}
            style={{
              background: task.completed ? tint('var(--success)', 12) : 'var(--bg-card)',
              color: task.completed ? 'var(--success)' : 'var(--text-2)',
              border: '1px solid',
              borderColor: task.completed ? tint('var(--success)', 35) : 'var(--border)',
              fontSize: '.8rem',
            }}
          >
            <span aria-hidden="true">{task.completed ? '✓' : '○'}</span>
            {task.completed ? 'Completed' : 'Mark complete'}
          </button>
        </div>

        {/* Priority */}
        <div>
          <h3 className="detail-label" id="detail-priority">Priority</h3>
          <div className="flex gap-1.5 mt-1" role="group" aria-labelledby="detail-priority">
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
                aria-pressed={task.priority === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Due date + time */}
        <div>
          <h3 className="detail-label" id="detail-due">Due date</h3>
          <div className="flex gap-2 mt-1" role="group" aria-labelledby="detail-due">
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
          <h3 className="detail-label" id="detail-project-label">Project</h3>
          <select
            id="detail-project"
            aria-labelledby="detail-project-label"
            className="input-base mt-1"
            value={task.projectId || ''}
            onChange={e => update({ projectId: e.target.value || null })}
          >
            <option value="">Inbox (no project)</option>
            {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Tags */}
        <div>
          <h3 className="detail-label" id="detail-tags">Tags</h3>
          <div className="mt-1 relative">
            <div
              className="tag-input flex flex-wrap gap-1 p-2 rounded-lg cursor-text min-h-8"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={() => setShowTagDropdown(true)}
              role="group"
              aria-labelledby="detail-tags"
            >
              {tagObjs.map(tag => (
                <span key={tag.id} className="tag-chip" style={{ background: tint(tag.color), color: ink(tag.color) }}>
                  #{tag.name}
                  <IconButton
                    label={`Remove tag ${tag.name}`}
                    tooltip="Remove tag"
                    icon={X}
                    size={10}
                    small
                    onClick={e => { e.stopPropagation(); toggleTag(tag.id) }}
                    style={{ minWidth: 18, height: 18, color: 'inherit', marginRight: -4 }}
                  />
                </span>
              ))}
              <input
                value={tagSearch}
                onChange={e => { setTagSearch(e.target.value); setShowTagDropdown(true) }}
                onFocus={() => setShowTagDropdown(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && filteredTags[0]) { e.preventDefault(); toggleTag(filteredTags[0].id); setTagSearch('') }
                  if (e.key === 'Escape' && showTagDropdown) { e.preventDefault(); e.stopPropagation(); setShowTagDropdown(false) }
                  if (e.key === 'ArrowDown') { e.preventDefault(); e.currentTarget.closest('.relative')?.querySelector('.tag-option')?.focus() }
                }}
                placeholder={tagObjs.length === 0 ? 'Add tags…' : ''}
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: '.8rem', color: 'var(--text-1)', minWidth: 60, flex: 1 }}
                aria-label="Find a tag to add"
              />
            </div>
            {showTagDropdown && (
              <div
                id="detail-tag-options"
                role="group"
                aria-label="Tags"
                className="absolute z-10 w-full mt-1 rounded-xl py-1"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', maxHeight: 200, overflowY: 'auto' }}
                onMouseDown={e => e.preventDefault()}
                onKeyDown={e => {
                  const opts = [...e.currentTarget.querySelectorAll('.tag-option')]
                  const i = opts.indexOf(document.activeElement)
                  if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(i + 1, opts.length - 1)]?.focus() }
                  if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) e.currentTarget.parentElement.querySelector('input')?.focus(); else opts[i - 1].focus() }
                  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setShowTagDropdown(false); e.currentTarget.parentElement.querySelector('input')?.focus() }
                }}
              >
                {filteredTags.map(tag => {
                  const on = (task.tags || []).includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className="tag-option menu-item"
                      aria-pressed={on}
                      onClick={() => { toggleTag(tag.id); setTagSearch('') }}
                    >
                      <span aria-hidden="true" className="menu-swatch" style={{ background: tag.color }} />
                      <span className="menu-item-label">#{tag.name}</span>
                      {on && <span aria-hidden="true" className="menu-item-check">✓</span>}
                    </button>
                  )
                })}
                {filteredTags.length === 0 && (
                  <div style={{ padding: '8px 12px', color: 'var(--text-3)', fontSize: '.8rem' }}>
                    {state.tags.length ? 'No matching tags.' : 'No tags yet. Create one from the sidebar.'}
                  </div>
                )}
                <button
                  className="btn btn-ghost w-full justify-start px-3 py-1.5"
                  style={{ fontSize: '.8rem', borderTop: '1px solid var(--border-light)', borderRadius: 0 }}
                  onClick={() => setShowTagDropdown(false)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recurring */}
        <div>
          <h3 className="detail-label" id="detail-repeat">Repeat</h3>
          <div className="flex gap-1.5 mt-1" role="group" aria-labelledby="detail-repeat">
            {FREQ_OPTIONS.map(freq => (
              <button
                key={freq}
                className="btn flex-1"
                aria-pressed={task.recurring?.freq === freq || (!task.recurring && freq === 'none')}
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
          <h3 className="detail-label" id="detail-time">Time tracked</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="timer-digits" style={{ color: 'var(--text-1)', fontSize: '1.1rem', fontWeight: 600 }}>
              {formatDuration(totalTracked)}
            </span>
            <IconButton
              label={isTimerRunning ? 'Stop timer' : 'Start timer'}
              icon={isTimerRunning ? Square : Play}
              pressed={isTimerRunning}
              data-feat="warning"
              className="ml-auto"
              onClick={handleTimerToggle}
            />
            {isTimerRunning && (
              <span role="status" style={{ color: 'var(--accent)', fontSize: '.75rem' }} className="anim-pulse-glow">
                Running
              </span>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="detail-label" id="detail-notes-label">Notes</h3>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowPreview(v => !v)}
              aria-pressed={showPreview}
              style={{ fontSize: '.75rem', padding: '3px 8px' }}
            >
              {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
              Preview
            </button>
          </div>
          {showPreview ? (
            <div
              className="markdown-preview rounded-lg p-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', minHeight: 80, fontSize: '.875rem', color: 'var(--text-2)' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(task.notes) || '<span style="color:var(--text-4);font-style:italic">No notes</span>' }}
            />
          ) : (
            <DraftText
              key={`notes-${task.id}`}
              className="input-base"
              value={task.notes || ''}
              onCommit={v => updateTask(task.id, { notes: v }, { coalesce: 'notes' })}
              placeholder="Add notes (markdown supported)…"
              style={{ minHeight: 100, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '.8rem' }}
              aria-labelledby="detail-notes-label"
            />
          )}
        </div>

        {/* Subtasks */}
        <div>
          <h3 className="detail-label" id="detail-subtasks">Subtasks ({subtasks.length})</h3>
          <div className="mt-1 space-y-1">
            {subtasks.map(sub => (
              <div key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <button
                  className={`custom-checkbox ${sub.completed ? 'checked' : ''}`}
                  onClick={() => sub.completed ? uncompleteTask(sub.id) : completeTask(sub.id)}
                  style={{ width: 15, height: 15 }}
                  aria-label={sub.completed ? 'Mark subtask incomplete' : 'Mark subtask complete'}
                  data-tooltip={sub.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {sub.completed && <svg width="8" height="6" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 4l3 3 5-6"/></svg>}
                </button>
                <span style={{ flex: 1, fontSize: '.825rem', color: sub.completed ? 'var(--text-4)' : 'var(--text-1)', textDecoration: sub.completed ? 'line-through' : 'none' }}>
                  {sub.title}
                </span>
                <IconButton
                  label={`Delete subtask ${sub.title}`}
                  tooltip="Delete subtask"
                  icon={X}
                  size={12}
                  small
                  danger
                  tooltipAlign="end"
                  onClick={() => {
                    deleteTask(sub.id)
                    toast({ message: `Deleted subtask “${sub.title}”.`, action: { label: 'Undo', onClick: undo } })
                  }}
                />
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
            <h3 className="detail-label" id="detail-activity">Activity</h3>
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
          onClick={handleDelete}
        >
          <Trash2 size={14} /> Delete task
        </button>
      </div>

    </aside>
  )
}
