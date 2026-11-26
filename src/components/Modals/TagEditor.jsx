// ── Tag editor dialog ──────────────────────────────────────
import { useState } from 'react'
import { useStore } from '../../store/context.js'
import { SWATCHES, DEFAULT_SWATCH, tint, ink } from '../../utils/colors.js'
import { Dialog } from '../ui/Dialog.jsx'
import { ColorPicker } from './ColorPicker.jsx'

export const TagEditor = ({ tag, onClose }) => {
  const { createTag, updateTag } = useStore()
  const [name, setName] = useState(tag?.name || '')
  const [color, setColor] = useState(tag?.color || DEFAULT_SWATCH)

  const save = async () => {
    if (!name.trim()) return
    if (tag) await updateTag(tag.id, { name: name.trim(), color })
    else await createTag({ name: name.trim(), color })
    onClose()
  }

  return (
    <Dialog
      title={tag ? 'Edit tag' : 'New tag'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>{tag ? 'Save' : 'Create'}</button>
      </>}
    >
      <div className="mb-4">
        <span className="tag-chip" style={{ background: tint(color), color: ink(color) }}>#{name || 'tag-name'}</span>
      </div>
      <label className="field-label" htmlFor="tag-name">Name</label>
      <input
        id="tag-name"
        data-autofocus
        className="input-base mb-4"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="tag-name"
        onKeyDown={e => e.key === 'Enter' && save()}
      />
      <ColorPicker label="Colour" value={color} onChange={setColor} swatches={SWATCHES} />
    </Dialog>
  )
}
