// ── Sidebar ────────────────────────────────────────────────
import { useMemo, useState, useCallback } from 'react'
import {
  Inbox, Sun, CalendarDays, LayoutList, CheckCircle2, Calendar, BarChart3,
  Plus, Folder, ChevronDown, ChevronRight, Pencil, PROJECT_ICONS, Trash2, Filter,
} from '../icons.jsx'
import { useStore } from '../store/context.js'
import { todayISO, addDaysISO } from '../utils/dates.js'
import { tint, ink } from '../utils/colors.js'
import { IconButton } from './ui/IconButton.jsx'
import { matchesRules } from '../utils/smartLists.js'

const ICON_MAP = {
  ...PROJECT_ICONS,
  Inbox, LayoutList, Sun, CalendarDays, Calendar, CheckCircle2, BarChart3, Trash2,
}

const VIEWS = [
  { id: 'inbox',     label: 'Inbox',     icon: 'Inbox' },
  { id: 'today',     label: 'Today',     icon: 'Sun' },
  { id: 'upcoming',  label: 'Upcoming',  icon: 'CalendarDays' },
  { id: 'all',       label: 'All Tasks', icon: 'LayoutList' },
  { id: 'completed', label: 'Completed', icon: 'CheckCircle2' },
  { id: 'calendar',  label: 'Calendar',  icon: 'Calendar' },
  { id: 'stats',     label: 'Stats',     icon: 'BarChart3' },
  { id: 'trash',     label: 'Trash',     icon: 'Trash2' },
]

export const Sidebar = ({ onNewProject, onEditProject, onNewTag, onEditTag, onEditList, onNavigate, drawer = false }) => {
  const { state, dispatch, updateTask } = useStore()
  const { tasks, projects, view } = state
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [listsOpen, setListsOpen] = useState(true)
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
    const byId = new Map(state.trash.map(e => [e.id, e]))
    counts.trash = state.trash.filter(e => !(e.task.parentId && byId.get(e.task.parentId)?.batch === e.batch)).length
    return counts
  }, [tasks, state.trash])

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

  const setView = useCallback((v) => { dispatch({ type: 'SET_VIEW', view: v }); onNavigate?.() }, [dispatch, onNavigate])

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


  return (
    <nav
      aria-label="Views, projects and tags"
      className={`sidebar flex flex-col h-full overflow-y-auto py-3 no-print${drawer ? ' sidebar-drawer' : ''}`}

    >
      {/* ── Views ───────────────────────────── */}
      <section className="px-2 mb-4" aria-label="Views">
        {VIEWS.map(({ id, label, icon }) => {
          const Ic = ICON_MAP[icon] || Folder
          const count = taskCounts[id]
          const active = view === id

          return (
            <button
              key={id}
              className="sidebar-view w-full flex items-center gap-2.5 px-3 rounded-lg text-left transition-colors"
              aria-current={active ? 'page' : undefined}
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
                  {count}<span className="sr-only"> open tasks</span>
                </span>
              )}
            </button>
          )
        })}
      </section>

      <div style={{ height: 1, background: 'var(--border)', margin: '0 12px 12px' }} />

      {/* ── Projects ────────────────────────── */}
      <section className="px-2 mb-4" aria-label="Projects">
        <div className="flex items-center pl-3 mb-1">
          <h2 className="flex-1">
            <button
              className="sidebar-heading"
              aria-expanded={projectsOpen}
              onClick={() => setProjectsOpen(v => !v)}
            >
              {projectsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Projects
            </button>
          </h2>
          <IconButton label="New project" icon={Plus} size={14} small onClick={onNewProject} tooltipAlign="end" />
        </div>

        {projectsOpen && sortedProjects.map(project => {
          const Ic = ICON_MAP[project.icon] || Folder
          const active = view === `project:${project.id}`
          const count = projectTaskCounts[project.id] || 0

          return (
            <div
              key={project.id}
              className="group sidebar-row"
              data-active={active || dragOverId === project.id || undefined}
              style={{ borderTop: dragOverId === project.id ? '2px solid var(--accent)' : '2px solid transparent' }}
              onDragOver={e => handleDragOver(e, project.id)}
              onDrop={e => handleDrop(e, project.id)}
              onDragLeave={() => setDragOverId(null)}
            >
              <button className="sidebar-row-main" aria-current={active ? 'page' : undefined} onClick={() => setView(`project:${project.id}`)}>
                <span className="rounded p-1 flex" style={{ background: tint(project.color), color: ink(project.color) }}>
                  <Ic size={12} />
                </span>
                <span className="flex-1 truncate">{project.name}</span>
                {count > 0 && <span className="sidebar-count">{count}<span className="sr-only"> open tasks</span></span>}
              </button>
              <IconButton label={`Edit project ${project.name}`} tooltip="Edit project" icon={Pencil} size={12} small className="row-reveal" onClick={() => onEditProject(project)} tooltipAlign="end" />
            </div>
          )
        })}

        {projectsOpen && sortedProjects.length === 0 && (
          <p style={{ color: 'var(--text-3)', fontSize: '.8rem', padding: '4px 12px' }}>No projects yet. Use + to add one.</p>
        )}
      </section>

      <div style={{ height: 1, background: 'var(--border)', margin: '0 12px 12px' }} />

      {/* ── Smart lists ─────────────────────── */}
      <section className="px-2 mb-4" aria-label="Smart lists">
        <div className="flex items-center pl-3 mb-1">
          <h2 className="flex-1">
            <button className="sidebar-heading" aria-expanded={listsOpen} onClick={() => setListsOpen(v => !v)}>
              {listsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Smart lists
            </button>
          </h2>
          <IconButton label="New smart list" icon={Plus} size={14} small onClick={() => onEditList?.({})} tooltipAlign="end" />
        </div>
        {listsOpen && state.lists.map(list => {
          const active = view === `list:${list.id}`
          const count = tasks.filter(t => !t.parentId && matchesRules(t, list.rules)).length
          return (
            <div key={list.id} className="group sidebar-row" data-active={active || undefined}>
              <button className="sidebar-row-main" aria-current={active ? 'page' : undefined} onClick={() => setView(`list:${list.id}`)}>
                <span className="rounded p-1 flex" style={{ background: tint(list.color), color: ink(list.color) }}><Filter size={12} /></span>
                <span className="flex-1 truncate">{list.name}</span>
                {count > 0 && <span className="sidebar-count">{count}<span className="sr-only"> tasks</span></span>}
              </button>
              <IconButton label={`Edit smart list ${list.name}`} tooltip="Edit smart list" icon={Pencil} size={12} small className="row-reveal" onClick={() => onEditList?.({ list })} tooltipAlign="end" />
            </div>
          )
        })}
        {listsOpen && state.lists.length === 0 && (
          <p style={{ color: 'var(--text-3)', fontSize: '.8rem', padding: '4px 12px' }}>Save filters as a list with +.</p>
        )}
      </section>

      <div style={{ height: 1, background: 'var(--border)', margin: '0 12px 12px' }} />

      {/* ── Tags ────────────────────────────── */}
      <section className="px-2" aria-label="Tags">
        <div className="flex items-center pl-3 mb-1">
          <h2 className="flex-1">
            <button
              className="sidebar-heading"
              aria-expanded={tagsOpen}
              onClick={() => setTagsOpen(v => !v)}
            >
              {tagsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Tags
            </button>
          </h2>
          <IconButton label="New tag" icon={Plus} size={14} small onClick={onNewTag} tooltipAlign="end" />
        </div>

        {tagsOpen && state.tags.map(tag => {
          const active = view === `tag:${tag.id}`
          const count = tagTaskCounts[tag.id] || 0

          return (
            <div key={tag.id} className="group sidebar-row" data-active={active || undefined}>
              <button className="sidebar-row-main" aria-current={active ? 'page' : undefined} onClick={() => setView(`tag:${tag.id}`)}>
                <span aria-hidden="true" className="rounded-full" style={{ width: 8, height: 8, background: tag.color, flexShrink: 0, margin: '0 4px' }} />
                <span className="flex-1 truncate">#{tag.name}</span>
                {count > 0 && <span className="sidebar-count">{count}<span className="sr-only"> open tasks</span></span>}
              </button>
              <IconButton label={`Edit tag ${tag.name}`} tooltip="Edit tag" icon={Pencil} size={12} small className="row-reveal" onClick={() => onEditTag(tag)} tooltipAlign="end" />
            </div>
          )
        })}

        {tagsOpen && state.tags.length === 0 && (
          <p style={{ color: 'var(--text-3)', fontSize: '.8rem', padding: '4px 12px' }}>No tags yet. Use + or type #tag in a task.</p>
        )}
      </section>

      {/* ── Privacy note ─────────────────────────── */}
      <div className="mt-auto px-4 py-3">
        <p style={{ color: 'var(--text-4)', fontSize: '.65rem', lineHeight: 1.5 }}>
          All data stays in your browser. Nothing is ever sent anywhere.
        </p>
      </div>
    </nav>
  )
}
