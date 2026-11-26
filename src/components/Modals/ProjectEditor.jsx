// ── Project editor modal ───────────────────────────────────
import { useState } from 'react'
import { X, Folder, Star, Briefcase, Home, Heart, Book, Code, Music, Camera, Coffee } from 'lucide-react'
import { useStore } from '../../store/context.js'
import { SWATCHES, DEFAULT_SWATCH, tint, ink } from '../../utils/colors.js'

const ICONS = ['Folder','Star','Briefcase','Home','Heart','Book','Code','Music','Camera','Coffee']
const ICON_MAP = { Folder, Star, Briefcase, Home, Heart, Book, Code, Music, Camera, Coffee }

export const ProjectEditor = ({ project, onClose }) => {
  const { createProject, updateProject } = useStore()
  const [name, setName] = useState(project?.name || '')
  const [color, setColor] = useState(project?.color || DEFAULT_SWATCH)
  const [icon, setIcon] = useState(project?.icon || 'Folder')

  const save = async () => {
    if (!name.trim()) return
    if (project) {
      await updateProject(project.id, { name: name.trim(), color, icon })
    } else {
      await createProject({ name: name.trim(), color, icon })
    }
    onClose()
  }

  const IconComp = ICON_MAP[icon] || Folder

  return (
    <div
      className="backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="anim-drop-in rounded-2xl p-6 w-full max-w-sm"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '1.1rem' }}>
            {project ? 'Edit Project' : 'New Project'}
          </h2>
          <button className="btn btn-ghost p-1" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
          <div className="rounded-lg p-2" style={{ background: tint(color), color: ink(color) }}>
            <IconComp size={20} />
          </div>
          <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{name || 'Project Name'}</span>
        </div>

        <label style={{ color: 'var(--text-3)', fontSize: '.8rem', fontWeight: 600 }}>NAME</label>
        <input
          className="input-base mt-1 mb-4"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Project name"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && save()}
        />

        <label style={{ color: 'var(--text-3)', fontSize: '.8rem', fontWeight: 600 }}>COLOR</label>
        <div className="flex flex-wrap gap-2 mt-1 mb-4">
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

        <label style={{ color: 'var(--text-3)', fontSize: '.8rem', fontWeight: 600 }}>ICON</label>
        <div className="flex flex-wrap gap-2 mt-1 mb-5">
          {ICONS.map(name => {
            const Ic = ICON_MAP[name]
            return (
              <button
                key={name}
                onClick={() => setIcon(name)}
                className="btn btn-ghost p-2"
                style={{
                  borderRadius: 8,
                  background: icon === name ? 'var(--accent-soft)' : 'transparent',
                  color: icon === name ? 'var(--accent)' : 'var(--text-3)',
                  border: icon === name ? '1px solid var(--accent-border)' : '1px solid transparent',
                }}
                aria-label={name}
              >
                <Ic size={16} />
              </button>
            )
          })}
        </div>

        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={save}>
            {project ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
