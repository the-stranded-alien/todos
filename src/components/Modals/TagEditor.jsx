// ── Tag editor dialog ──────────────────────────────────────
import { useState } from 'react'
import { useStore } from '../../store/context.js'
import { Trash2 } from '../../icons.jsx'
import { toast } from '../../toast.js'
import { SWATCHES, DEFAULT_SWATCH, tint, ink } from '../../utils/colors.js'
import { Dialog } from '../ui/Dialog.jsx'
import { ColorPicker } from './ColorPicker.jsx'

export const TagEditor = ({ tag, onClose }) => {
  const { createTag, updateTag, deleteTag, undo } = useStore()
  const [name, setName] = useState(tag?.name || '')
  const [color, setColor] = useState(tag?.color || DEFAULT_SWATCH)

  const save = async () => {
    if (!name.trim()) return
    if (tag) await updateTag(tag.id, { name: name.trim(), color })
    else await createTag({ name: name.trim(), color })
    onClose()
  }

  const remove = async () => {
    const n = await deleteTag(tag.id)
    onClose()
    toast({
      message: n ? `Deleted tag “#${tag.name}” and removed it from ${n} task${n > 1 ? 's' : ''}.` : `Deleted tag “#${tag.name}”.`,
      action: { label: 'Undo', onClick: undo },
    })
  }

  return (
    <Dialog
      title={tag ? 'Edit tag' : 'New tag'}
      onClose={onClose}
      footer={<>
        {tag && (
          <button className="btn btn-danger" style={{ marginRight: 'auto' }} data-feat="danger" onClick={remove}>
            <Trash2 size={14} /> Delete tag
          </button>
        )}
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
