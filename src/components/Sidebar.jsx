// ── Sidebar ────────────────────────────────────────────────
import { useMemo, useState, useCallback } from 'react'
import {
  Inbox, Sun, CalendarDays, LayoutList, CheckCircle2, Calendar, BarChart3,
  Plus, Folder, ChevronDown, ChevronRight, Pencil,
  Star, Briefcase, Home, Heart, Book, Code, Music, Camera, Coffee
} from 'lucide-react'
import { useStore } from '../store/context.js'
import { todayISO, addDaysISO } from '../utils/dates.js'
import { tint, ink } from '../utils/colors.js'

const ICON_MAP = {
  Folder, Star, Briefcase, Home, Heart, Book, Code, Music, Camera, Coffee,
  Inbox, LayoutList, Sun, CalendarDays, Calendar, CheckCircle2
}

const VIEWS = [
  { id: 'inbox',     label: 'Inbox',     icon: 'Inbox' },
  { id: 'today',     label: 'Today',     icon: 'Sun' },
  { id: 'upcoming',  label: 'Upcoming',  icon: 'CalendarDays' },
  { id: 'all',       label: 'All Tasks', icon: 'LayoutList' },
  { id: 'completed', label: 'Completed', icon: 'CheckCircle2' },
  { id: 'calendar',  label: 'Calendar',  icon: 'Calendar' },
  { id: 'stats',     label: 'Stats',     icon: 'BarChart3' },
]

export const Sidebar = ({ onNewProject, onEditProject, onNewTag, onEditTag }) => {
  const { state, dispatch, updateTask } = useStore()
  const { tasks, projects, view, sidebarOpen } = state
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [dragOverId, setDragOverId] = useState(null)

  const taskCounts = useMemo(() => {
    const today = todayISO()
    const counts = { inbox: 0, today: 0, upcoming: 0, all: 0 }
    const activeTasks = tasks.filter(t => !t.completed)
    counts.all = activeTasks.length
    counts.inbox = activeTasks.filter(t => !t.projectId && !t.parentId).length
    counts.today = activeTasks.filter(t => t.dueDate && t.dueDate <= today).length
    const in7str = addDaysISO(7)
    counts.upcoming = activeTasks.filter(t => t.dueDate && t.dueDate > today && t.dueDate <= in7str).length
    return counts
  }, [tasks])

  const projectTaskCounts = useMemo(() => {
    const counts = {}
    for (const t of tasks) {
      if (!t.completed && t.projectId) {
        counts[t.projectId] = (counts[t.projectId] || 0) + 1
      }
    }
    return counts
  }, [tasks])

  const tagTaskCounts = useMemo(() => {
    const counts = {}
    for (const t of tasks) {
      if (!t.completed) {
        for (const tid of t.tags || []) {
          counts[tid] = (counts[tid] || 0) + 1
        }
      }
    }
    return counts
  }, [tasks])

  const setView = useCallback((v) => dispatch({ type: 'SET_VIEW', view: v }), [dispatch])

  const sortedProjects = useMemo(() =>
    [...projects].sort((a, b) => a.order - b.order), [projects])

  // Drop a task (dragged from the list) onto a project to move it there
  const handleDragOver = useCallback((e, id) => {
    if (!e.dataTransfer.types.includes('taskid')) return
    e.preventDefault()
    setDragOverId(id)
  }, [])

  const handleDrop = useCallback((e, projectId) => {
    e.preventDefault()
    setDragOverId(null)
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) updateTask(taskId, { projectId })
  }, [updateTask])

  if (!sidebarOpen) return null

  return (
    <aside
      className="flex flex-col h-full overflow-y-auto py-3"
      style={{
        width: 240,
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* ── Views ───────────────────────────── */}
      <section className="px-2 mb-4">
        {VIEWS.map(({ id, label, icon }) => {
          const Ic = ICON_MAP[icon] || Folder
          const count = taskCounts[id]
          const active = view === id

          return (
            <button
              key={id}
              className="w-full flex items-center gap-2.5 px-3 rounded-lg text-left transition-colors"
              style={{
                paddingBlock: 'var(--nav-py)',
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-2)',
                fontWeight: active ? 600 : 400,
                fontSize: '.875rem',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={() => setView(id)}
            >
              <Ic size={15} style={{ flexShrink: 0 }} />
              <span className="flex-1">{label}</span>
              {count > 0 && (
                <span style={{
                  background: active ? 'var(--accent)' : 'var(--bg-card)',
                  color: active ? 'var(--on-accent)' : 'var(--text-3)',
                  borderRadius: 99,
                  fontSize: '.7rem',
                  fontWeight: 600,
                  padding: '1px 6px',
                  minWidth: 20,
                  textAlign: 'center',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </section>

      <div style={{ height: 1, background: 'var(--border)', margin: '0 12px 12px' }} />

      {/* ── Projects ────────────────────────── */}
      <section className="px-2 mb-4">
        <div className="flex items-center px-3 mb-1">
          <button
            className="flex items-center gap-1 flex-1 text-left"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: '.7rem', fontWeight: 700, letterSpacing: '.06em' }}
            onClick={() => setProjectsOpen(v => !v)}
          >
            {projectsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            PROJECTS
          </button>
          <button
            className="btn btn-ghost p-1"
            onClick={onNewProject}
            aria-label="New project"
            style={{ marginRight: -4 }}
          >
            <Plus size={14} />
          </button>
        </div>

        {projectsOpen && sortedProjects.map(project => {
          const Ic = ICON_MAP[project.icon] || Folder
          const active = view === `project:${project.id}`
          const count = projectTaskCounts[project.id] || 0

          return (
            <div
              key={project.id}
              className="group flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{
                background: active ? 'var(--accent-soft)' : dragOverId === project.id ? 'var(--accent-soft)' : 'transparent',
                cursor: 'pointer',
                borderTop: dragOverId === project.id ? '2px solid var(--accent)' : '2px solid transparent',
              }}
              onClick={() => setView(`project:${project.id}`)}
              onDragOver={e => handleDragOver(e, project.id)}
              onDrop={e => handleDrop(e, project.id)}
              onDragLeave={() => setDragOverId(null)}
            >
              <div className="rounded p-1" style={{ background: tint(project.color), color: ink(project.color) }}>
                <Ic size={12} />
              </div>
              <span className="flex-1 truncate" style={{ color: active ? 'var(--accent)' : 'var(--text-2)', fontSize: '.875rem', fontWeight: active ? 600 : 400 }}>
                {project.name}
              </span>
              {count > 0 && (
                <span style={{ color: 'var(--text-4)', fontSize: '.7rem' }}>{count}</span>
              )}
              <div className="hidden group-hover:flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                <button className="btn btn-ghost p-0.5" onClick={() => onEditProject(project)} aria-label="Edit project"><Pencil size={11} /></button>
              </div>
            </div>
          )
        })}

        {projectsOpen && sortedProjects.length === 0 && (
          <p style={{ color: 'var(--text-4)', fontSize: '.8rem', padding: '4px 12px' }}>No projects yet</p>
        )}
      </section>

      <div style={{ height: 1, background: 'var(--border)', margin: '0 12px 12px' }} />

      {/* ── Tags ────────────────────────────── */}
      <section className="px-2">
        <div className="flex items-center px-3 mb-1">
          <button
            className="flex items-center gap-1 flex-1 text-left"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: '.7rem', fontWeight: 700, letterSpacing: '.06em' }}
            onClick={() => setTagsOpen(v => !v)}
          >
            {tagsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            TAGS
          </button>
          <button
            className="btn btn-ghost p-1"
            onClick={onNewTag}
            aria-label="New tag"
            style={{ marginRight: -4 }}
          >
            <Plus size={14} />
          </button>
        </div>

        {tagsOpen && state.tags.map(tag => {
          const active = view === `tag:${tag.id}`
          const count = tagTaskCounts[tag.id] || 0

          return (
            <button
              key={tag.id}
              className="group w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left"
              style={{
                background: active ? 'var(--accent-soft)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={() => setView(`tag:${tag.id}`)}
            >
              <div className="rounded-full" style={{ width: 8, height: 8, background: tag.color, flexShrink: 0 }} />
              <span className="flex-1 truncate" style={{ color: active ? 'var(--accent)' : 'var(--text-2)', fontSize: '.875rem' }}>
                #{tag.name}
              </span>
              {count > 0 && (
                <span style={{ color: 'var(--text-4)', fontSize: '.7rem' }}>{count}</span>
              )}
              <div className="hidden group-hover:flex" onClick={e => e.stopPropagation()}>
                <button className="btn btn-ghost p-0.5" onClick={() => onEditTag(tag)} aria-label="Edit tag"><Pencil size={11} /></button>
              </div>
            </button>
          )
        })}

        {tagsOpen && state.tags.length === 0 && (
          <p style={{ color: 'var(--text-4)', fontSize: '.8rem', padding: '4px 12px' }}>No tags yet</p>
        )}
      </section>

      {/* ── Privacy note ─────────────────────────── */}
      <div className="mt-auto px-4 py-3">
        <p style={{ color: 'var(--text-4)', fontSize: '.65rem', lineHeight: 1.5 }}>
          All data stays in your browser. Nothing is ever sent anywhere.
        </p>
      </div>
    </aside>
  )
}
