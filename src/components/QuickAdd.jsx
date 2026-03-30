// ── Quick Add bar ──────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, Mic, MicOff, Calendar, Flag, Hash, AtSign } from 'lucide-react'
import { useStore } from '../useStore.jsx'
import { parseTaskInput } from '../utils/nlpParse.js'
import { useSpeech } from '../hooks/useSpeech.js'

const PRIORITY_LABELS = ['none', 'low', 'med', 'high']
const PRIORITY_COLORS = ['var(--text-4)', '#3b82f6', '#eab308', '#ef4444']

export const QuickAdd = ({ inputRef, defaultProjectId }) => {
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
    if (v.trim()) {
      setParsed(parseTaskInput(v))
    } else {
      setParsed(null)
    }
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

    // Resolve tag names to ids (create if needed)
    const tagIds = []
    for (const tagName of p.tags) {
      let found = state.tags.find(t => t.name.toLowerCase() === tagName.toLowerCase())
      if (!found) {
        // We'll just use the name as-is, no auto-create for now
        continue
      }
      tagIds.push(found.id)
    }

    await createTask({
      title: p.title || value.trim(),
      priority: p.priority,
      dueDate: p.dueDate,
      dueTime: p.dueTime,
      projectId,
      tags: tagIds,
      order: Date.now(),
    })

    setValue('')
    setParsed(null)
    inputRef?.current?.focus()
  }, [value, defaultProjectId, state.projects, state.tags, createTask, inputRef])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') submit()
    if (e.key === 'Escape') { setValue(''); setParsed(null) }
  }, [submit])

  const hasParsed = parsed && (parsed.dueDate || parsed.priority > 0 || parsed.tags.length > 0 || parsed.projectName)

  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light)' }}>
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
      >
        <Plus size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder='Add task… "Buy groceries tomorrow p2 #shopping"'
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
            style={{ borderRadius: '50%' }}
          >
            {listening ? <MicOff size={15} style={{ color: 'var(--accent)' }} /> : <Mic size={15} />}
          </button>
        )}
        {value && (
          <button
            className="btn btn-primary"
            onClick={submit}
            style={{ padding: '4px 12px', fontSize: '.8rem' }}
          >
            Add
          </button>
        )}
      </div>

      {/* Parsed chips */}
      {hasParsed && (
        <div className="flex items-center gap-1.5 mt-1.5 px-1 flex-wrap">
          {parsed.dueDate && (
            <span className="tag-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
              <Calendar size={10} /> {parsed.dueDate}
            </span>
          )}
          {parsed.priority > 0 && (
            <span className="tag-chip" style={{ background: PRIORITY_COLORS[parsed.priority] + '22', color: PRIORITY_COLORS[parsed.priority], border: `1px solid ${PRIORITY_COLORS[parsed.priority]}44` }}>
              <Flag size={10} /> {PRIORITY_LABELS[parsed.priority]}
            </span>
          )}
          {parsed.tags.map(tag => (
            <span key={tag} className="tag-chip" style={{ background: 'var(--bg-surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
              <Hash size={10} /> {tag}
            </span>
          ))}
          {parsed.projectName && (
            <span className="tag-chip" style={{ background: 'var(--bg-surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
              <AtSign size={10} /> {parsed.projectName}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
