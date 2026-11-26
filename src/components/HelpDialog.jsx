// ── Help: sectioned how-to with search ─────────────────────
import { useDeferredValue, useMemo, useState } from 'react'
import { Dialog } from './ui/Dialog.jsx'
import { EmptyState } from './ui/EmptyState.jsx'
import { Search, HelpCircle } from '../icons.jsx'
import { HELP_SECTIONS } from '../help.js'

const highlight = (text, q) => {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q)
  if (i < 0) return text
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
}

export const HelpDialog = ({ onClose }) => {
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim().toLowerCase())

  const sections = useMemo(() => {
    if (!q) return HELP_SECTIONS
    return HELP_SECTIONS
      .map(s => s.title.toLowerCase().includes(q) ? s : { ...s, body: s.body.filter(b => b.toLowerCase().includes(q)) })
      .filter(s => s.body.length)
  }, [q])

  return (
    <Dialog title="Help" onClose={onClose} size="lg">
      <div className="relative mb-4" role="search" aria-label="Search help">
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
        <input
          data-autofocus
          type="search"
          className="input-base"
          style={{ paddingLeft: 30 }}
          placeholder="Search help…"
          aria-label="Search help"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <p className="sr-only" aria-live="polite">{q ? `${sections.length} matching topics` : ''}</p>
      {sections.length === 0 ? (
        <EmptyState icon={HelpCircle} title="No help topics match." compact>Try a different word, like “backup” or “repeat”.</EmptyState>
      ) : (
        <div className="help-sections">
          {sections.map(s => (
            <div key={s.id} className="help-topic">
              <h3 id={`help-${s.id}`} className="help-title">{highlight(s.title, q)}</h3>
              <ul className="help-list">
                {s.body.map((b, i) => <li key={i}>{highlight(b, q)}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}
