// ── Quick Add bar ──────────────────────────────────────────
import { useState, useCallback } from 'react'
import { Plus, Mic, MicOff, Calendar, Flag, Hash, AtSign } from '../icons.jsx'
import { useStore } from '../store/context.js'
import { todayISO } from '../utils/dates.js'
import { parseTaskInput } from '../utils/nlpParse.js'
import { useSpeech } from '../hooks/useSpeech.js'
import { PRIORITY_VARS, tint } from '../utils/colors.js'

const PRIORITY_LABELS = ['none', 'low', 'med', 'high']
const PRIORITY_COLORS = PRIORITY_VARS

export const QuickAdd = ({ inputRef, defaultProjectId, defaultDueDate }) => {
  const { createTask, state } = useStore()
  const [value, setValue] = useState('')
  const [parsed, setParsed] = useState(null)

  const onSpeechResult = useCallback((text) => {
    setValue(text)
    setParsed(parseTaskInput(text))
  }, [])

  const { listening, start: startListening, stop: stopListening, supported: speechSupported } = useSpeech(onSpeechResult)

  const handleChange = useCallback((e) => {
    const v = e.target.value
    setValue(v)
    setParsed(v.trim() ? parseTaskInput(v) : null)
  }, [])

  const submit = useCallback(async () => {
    if (!value.trim()) return

    const p = parseTaskInput(value)

    // Resolve project name to id
    let projectId = defaultProjectId || null
    if (p.projectName) {
      const found = state.projects.find(proj =>
        proj.name.toLowerCase() === p.projectName.toLowerCase()
      )
      if (found) projectId = found.id
    }

    // Resolve tag names to existing ids
    const tagIds = []
    for (const tagName of p.tags) {
      const found = state.tags.find(t => t.name.toLowerCase() === tagName.toLowerCase())
      if (found) tagIds.push(found.id)
    }

    // Use view's default due date if no date was parsed from input
    const dueDate = p.dueDate || defaultDueDate || null

    await createTask({
      title: p.title || value.trim(),
      priority: p.priority,
      dueDate,
      dueTime: p.dueTime,
      projectId,
      tags: tagIds,
      order: Date.now(),
    })

    setValue('')
    setParsed(null)
    inputRef?.current?.focus()
  }, [value, defaultProjectId, defaultDueDate, state.projects, state.tags, createTask, inputRef])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') submit()
    if (e.key === 'Escape') { setValue(''); setParsed(null) }
  }, [submit])

  // Show chips if something meaningful was parsed
  const hasParsed = parsed && (parsed.dueDate || parsed.priority > 0 || parsed.tags.length > 0 || parsed.projectName)

  // Effective due date to preview (parsed or default)
  const effectiveDueDate = parsed?.dueDate || (value.trim() ? defaultDueDate : null)

  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
          transition: 'border-color .15s, box-shadow .15s',
        }}
        onFocus={() => {}}
      >
        <Plus size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Add a task…"
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text-1)',
            fontFamily: 'var(--font-sans)',
            fontSize: '.875rem',
          }}
          aria-label="Quick add task"
        />
        {speechSupported && (
          <button
            className={`btn btn-ghost p-1 ${listening ? 'mic-listening' : ''}`}
            onClick={listening ? stopListening : startListening}
            aria-label={listening ? 'Stop listening' : 'Start voice input'}
            style={{ borderRadius: '50%', flexShrink: 0 }}
          >
            {listening
              ? <MicOff size={14} style={{ color: 'var(--accent)' }} />
              : <Mic size={14} style={{ color: 'var(--text-4)' }} />
            }
          </button>
        )}
        {value && (
          <button
            className="btn btn-primary"
            onClick={submit}
            style={{ padding: '3px 12px', fontSize: '.8rem', flexShrink: 0 }}
          >
            Add
          </button>
        )}
      </div>

      {/* Parsed / default chips */}
      {(hasParsed || (value.trim() && defaultDueDate && !parsed?.dueDate)) && (
        <div className="flex items-center gap-1.5 mt-2 px-1 flex-wrap">
          {effectiveDueDate && (
            <span className="tag-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
              <Calendar size={10} /> {effectiveDueDate === todayISO() ? 'Today' : effectiveDueDate}
            </span>
          )}
          {parsed?.priority > 0 && (
            <span className="tag-chip" style={{ background: tint(PRIORITY_COLORS[parsed.priority]), color: PRIORITY_COLORS[parsed.priority], border: `1px solid ${tint(PRIORITY_COLORS[parsed.priority], 35)}` }}>
              <Flag size={10} /> {PRIORITY_LABELS[parsed.priority]}
            </span>
          )}
          {parsed?.tags.map(tag => (
            <span key={tag} className="tag-chip" style={{ background: 'var(--bg-surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
              <Hash size={10} /> {tag}
            </span>
          ))}
          {parsed?.projectName && (
            <span className="tag-chip" style={{ background: 'var(--bg-surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
              <AtSign size={10} /> {parsed.projectName}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
