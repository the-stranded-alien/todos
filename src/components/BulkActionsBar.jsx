// ── Bulk actions bar ───────────────────────────────────────
import { useState } from 'react'
import { CheckCircle2, Trash2, FolderInput, Tag, X } from '../icons.jsx'
import { useStore } from '../store/context.js'

export const BulkActionsBar = () => {
  const { state, dispatch, bulkComplete, bulkDelete, bulkMoveToProject, bulkAddTag } = useStore()
  const { bulkSelected, projects, tags } = state
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [showTagPicker, setShowTagPicker] = useState(false)

  const count = bulkSelected.size
  if (count === 0) return null

  return (
    <div className="bulk-bar">
      <span style={{ color: 'var(--text-3)', fontSize: '.8rem', fontWeight: 600, marginRight: 4 }}>
        {count} selected
      </span>

      <button
        className="btn btn-ghost p-1.5"
        onClick={bulkComplete}
        data-feat="success"
        aria-label="Complete selected"
        title="Complete selected"
        style={{ fontSize: '.8rem' }}
      >
        <CheckCircle2 size={15} />
      </button>

      <div className="relative">
        <button
          className="btn btn-ghost p-1.5"
          onClick={() => { setShowProjectPicker(v => !v); setShowTagPicker(false) }}
          aria-label="Move to project"
          title="Move to project"
        >
          <FolderInput size={15} />
        </button>
        {showProjectPicker && (
          <div
            className="absolute bottom-full mb-2 left-0 rounded-xl py-1 w-44"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', zIndex: 60 }}
          >
            <div style={{ color: 'var(--text-4)', fontSize: '.7rem', padding: '4px 12px', fontWeight: 600 }}>MOVE TO PROJECT</div>
            <button className="btn btn-ghost w-full justify-start px-3 py-1.5 text-sm" onClick={() => { bulkMoveToProject(null); setShowProjectPicker(false) }}>
              Inbox
            </button>
            {projects.map(p => (
              <button key={p.id} className="btn btn-ghost w-full justify-start px-3 py-1.5 text-sm" onClick={() => { bulkMoveToProject(p.id); setShowProjectPicker(false) }}>
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          className="btn btn-ghost p-1.5"
          onClick={() => { setShowTagPicker(v => !v); setShowProjectPicker(false) }}
          aria-label="Add tag"
          title="Add tag"
        >
          <Tag size={15} />
        </button>
        {showTagPicker && (
          <div
            className="absolute bottom-full mb-2 left-0 rounded-xl py-1 w-40"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', zIndex: 60 }}
          >
            <div style={{ color: 'var(--text-4)', fontSize: '.7rem', padding: '4px 12px', fontWeight: 600 }}>ADD TAG</div>
            {tags.map(t => (
              <button key={t.id} className="btn btn-ghost w-full justify-start px-3 py-1.5 text-sm" onClick={() => { bulkAddTag(t.id); setShowTagPicker(false) }}>
                <div className="rounded-full" style={{ width: 8, height: 8, background: t.color }} />
                #{t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

      <button
        className="btn btn-danger p-1.5"
        onClick={bulkDelete}
        data-feat="danger"
        aria-label="Delete selected"
        title="Delete selected"
      >
        <Trash2 size={15} />
      </button>

      <button
        className="btn btn-ghost p-1.5"
        onClick={() => dispatch({ type: 'CLEAR_BULK' })}
        aria-label="Clear selection"
        title="Clear selection"
      >
        <X size={15} />
      </button>
    </div>
  )
}
