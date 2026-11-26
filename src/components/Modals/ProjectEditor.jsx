// ── Project editor dialog ──────────────────────────────────
import { useState } from 'react'
import { Folder, Trash2, PROJECT_ICONS as ICON_MAP, PROJECT_ICON_NAMES as ICONS } from '../../icons.jsx'
import { toast } from '../../toast.js'
import { useStore } from '../../store/context.js'
import { SWATCHES, DEFAULT_SWATCH, tint, ink } from '../../utils/colors.js'
import { Dialog } from '../ui/Dialog.jsx'
import { ColorPicker } from './ColorPicker.jsx'

export const ProjectEditor = ({ project, onClose }) => {
  const { createProject, updateProject, deleteProject, undo } = useStore()
  const [name, setName] = useState(project?.name || '')
  const [color, setColor] = useState(project?.color || DEFAULT_SWATCH)
  const [icon, setIcon] = useState(project?.icon || 'Folder')

  const save = async () => {
    if (!name.trim()) return
    if (project) await updateProject(project.id, { name: name.trim(), color, icon })
    else await createProject({ name: name.trim(), color, icon })
    onClose()
  }

  const remove = async () => {
    const moved = await deleteProject(project.id)
    onClose()
    toast({
      message: moved ? `Deleted project “${project.name}”. Its ${moved} task${moved > 1 ? 's' : ''} moved to the Inbox.` : `Deleted project “${project.name}”.`,
      action: { label: 'Undo', onClick: undo },
    })
  }

  const IconComp = ICON_MAP[icon] || Folder

  return (
    <Dialog
      title={project ? 'Edit project' : 'New project'}
      onClose={onClose}
      footer={<>
        {project && (
          <button className="btn btn-danger" style={{ marginRight: 'auto' }} data-feat="danger" onClick={remove}>
            <Trash2 size={14} /> Delete project
          </button>
        )}
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>{project ? 'Save' : 'Create'}</button>
      </>}
    >
      <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
        <div className="rounded-lg p-2 flex" style={{ background: tint(color), color: ink(color) }}>
          <IconComp size={20} />
        </div>
        <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{name || 'Project name'}</span>
      </div>

      <label className="field-label" htmlFor="project-name">Name</label>
      <input
        id="project-name"
        data-autofocus
        className="input-base mb-4"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Project name"
        onKeyDown={e => e.key === 'Enter' && save()}
      />

      <ColorPicker label="Colour" value={color} onChange={setColor} swatches={SWATCHES} />

      <div className="field-label" id="project-icon-label">Icon</div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="project-icon-label">
        {ICONS.map(n => {
          const Ic = ICON_MAP[n]
          const on = icon === n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setIcon(n)}
              className="icon-btn"
              aria-label={n}
              data-tooltip={n}
              style={{
                border: `1px solid ${on ? 'var(--accent-border)' : 'transparent'}`,
                background: on ? 'var(--accent-soft)' : 'transparent',
                color: on ? 'var(--accent)' : 'var(--text-2)',
              }}
            >
              <Ic size={16} />
            </button>
          )
        })}
      </div>
    </Dialog>
  )
}
