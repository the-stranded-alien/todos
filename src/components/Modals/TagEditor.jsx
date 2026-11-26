// ── Tag editor modal ───────────────────────────────────────
import { useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../../store/context.js'
import { SWATCHES, DEFAULT_SWATCH, tint, ink } from '../../utils/colors.js'


export const TagEditor = ({ tag, onClose }) => {
  const { createTag, updateTag } = useStore()
  const [name, setName] = useState(tag?.name || '')
  const [color, setColor] = useState(tag?.color || DEFAULT_SWATCH)

  const save = async () => {
    if (!name.trim()) return
    if (tag) {
      await updateTag(tag.id, { name: name.trim(), color })
    } else {
      await createTag({ name: name.trim(), color })
    }
    onClose()
  }

  return (
    <div
      className="backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="anim-drop-in rounded-2xl p-6 w-full max-w-xs"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '1.1rem' }}>
            {tag ? 'Edit Tag' : 'New Tag'}
          </h2>
          <button className="btn btn-ghost p-1" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Preview */}
        <div className="mb-4">
          <span className="tag-chip" style={{ background: tint(color), color: ink(color) }}>
            #{name || 'tag-name'}
          </span>
        </div>

        <label style={{ color: 'var(--text-3)', fontSize: '.8rem', fontWeight: 600 }}>NAME</label>
        <input
          className="input-base mt-1 mb-4"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="tag-name"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && save()}
        />

        <label style={{ color: 'var(--text-3)', fontSize: '.8rem', fontWeight: 600 }}>COLOR</label>
        <div className="flex flex-wrap gap-2 mt-1 mb-5">
          {SWATCHES.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 24, height: 24, borderRadius: '50%', background: c, border: 'none',
                cursor: 'pointer',
                outline: color === c ? `3px solid ${c}` : 'none',
                outlineOffset: 2,
              }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={save}>
            {tag ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
