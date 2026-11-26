// ── Command palette ────────────────────────────────────────
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Search, Plus, Folder, Tag, LayoutList, Sun, Palette, Contrast, Rows3, CheckSquare } from 'lucide-react'
import { useStore } from '../store/context.js'
import { usePrefs, setPrefs, resolvedTheme, withThemeTransition } from '../prefs.js'
import { availableThemes } from '../themes.js'

const STATIC_COMMANDS = [
  { id: 'new-task',     label: 'New Task',         icon: Plus,       group: 'Actions' },
  { id: 'new-project',  label: 'New Project',       icon: Folder,     group: 'Actions' },
  { id: 'new-tag',      label: 'New Tag',           icon: Tag,        group: 'Actions' },
  { id: 'view-inbox',   label: 'Go to Inbox',       icon: LayoutList, group: 'Views' },
  { id: 'view-today',   label: 'Go to Today',       icon: Sun,        group: 'Views' },
  { id: 'view-all',     label: 'Go to All Tasks',   icon: LayoutList, group: 'Views' },
  { id: 'view-upcoming',label: 'Go to Upcoming',    icon: LayoutList, group: 'Views' },
  { id: 'view-completed',label:'Go to Completed',   icon: CheckSquare,group: 'Views' },
  { id: 'view-stats',   label: 'Go to Stats',       icon: LayoutList, group: 'Views' },
]

const fuzzyMatch = (str, query) => {
  const s = str.toLowerCase()
  const q = query.toLowerCase()
  let si = 0, qi = 0
  while (si < s.length && qi < q.length) {
    if (s[si] === q[qi]) qi++
    si++
  }
  return qi === q.length
}

export const CommandPalette = ({ onClose, onNewProject, onNewTag, quickAddRef }) => {
  const { state, dispatch } = useStore()
  const prefs = usePrefs()
  const appearanceCmds = useMemo(() => [
    ...availableThemes(prefs.extraThemes).map(t => ({
      id: `theme:${t.id}`, label: `Theme: ${t.label}${resolvedTheme(prefs) === t.id ? ' (current)' : ''}`, icon: Palette, group: 'Appearance',
    })),
    { id: 'toggle-extra-themes', label: prefs.extraThemes ? 'Hide additional themes' : 'Show additional themes', icon: Palette, group: 'Appearance' },
    { id: 'toggle-high-contrast', label: prefs.highContrast ? 'Turn off high contrast' : 'Turn on high contrast', icon: Contrast, group: 'Appearance' },
    { id: 'toggle-density', label: prefs.density === 'compact' ? 'Use comfortable density' : 'Use compact density', icon: Rows3, group: 'Appearance' },
  ], [prefs])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const items = useMemo(() => {
    if (!query) {
      // Show recent tasks when empty
      const recent = [...state.tasks]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5)
        .map(t => ({ id: `task:${t.id}`, label: t.title, icon: CheckSquare, group: 'Recent Tasks', taskId: t.id }))
      return [...STATIC_COMMANDS, ...recent]
    }

    const projectCmds = state.projects.map(p => ({
      id: `project:${p.id}`,
      label: `Go to ${p.name}`,
      icon: Folder,
      group: 'Projects',
    }))
    const tagCmds = state.tags.map(t => ({
      id: `tag:${t.id}`,
      label: `Filter by #${t.name}`,
      icon: Tag,
      group: 'Tags',
    }))
    const taskCmds = state.tasks
      .filter(t => !t.completed)
      .map(t => ({ id: `task:${t.id}`, label: t.title, icon: CheckSquare, group: 'Tasks', taskId: t.id }))

    const all = [...STATIC_COMMANDS, ...appearanceCmds, ...projectCmds, ...tagCmds, ...taskCmds]
    return all.filter(item => fuzzyMatch(item.label, query))
  }, [query, state.tasks, state.projects, state.tags, appearanceCmds])


  const execute = useCallback((item) => {
    if (item.id === 'new-task') { onClose(); setTimeout(() => quickAddRef?.current?.focus(), 50) }
    else if (item.id === 'new-project') { onClose(); onNewProject() }
    else if (item.id === 'new-tag') { onClose(); onNewTag() }
    else if (item.id.startsWith('theme:')) { onClose(); withThemeTransition(() => setPrefs({ theme: item.id.slice(6) })) }
    else if (item.id === 'toggle-extra-themes') { setPrefs(p => ({ extraThemes: !p.extraThemes })); onClose() }
    else if (item.id === 'toggle-high-contrast') { setPrefs(p => ({ highContrast: !p.highContrast })); onClose() }
    else if (item.id === 'toggle-density') { setPrefs(p => ({ density: p.density === 'compact' ? 'comfortable' : 'compact' })); onClose() }
    else if (item.id.startsWith('view-')) {
      dispatch({ type: 'SET_VIEW', view: item.id.slice(5) })
      onClose()
    } else if (item.id.startsWith('project:')) {
      dispatch({ type: 'SET_VIEW', view: item.id })
      onClose()
    } else if (item.id.startsWith('tag:')) {
      dispatch({ type: 'SET_VIEW', view: item.id })
      onClose()
    } else if (item.taskId) {
      dispatch({ type: 'SELECT_TASK', id: item.taskId })
      onClose()
    }
  }, [onClose, onNewProject, onNewTag, quickAddRef, dispatch])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, items.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); if (items[selected]) execute(items[selected]) }
    if (e.key === 'Escape')    { onClose() }
  }, [items, selected, execute, onClose])

  // Group items
  const groups = useMemo(() => {
    const g = {}
    for (const item of items) {
      if (!g[item.group]) g[item.group] = []
      g[item.group].push(item)
    }
    return g
  }, [items])

  let globalIdx = 0

  return (
    <div
      className="backdrop fixed inset-0 z-50 flex items-start justify-center pt-24"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="anim-drop-in w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <Search size={17} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-1)', fontFamily: 'var(--font-sans)', fontSize: '1rem',
            }}
            aria-label="Command search"
          />
          <kbd style={{ color: 'var(--text-4)', fontSize: '.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {Object.entries(groups).map(([group, groupItems]) => (
            <div key={group}>
              <div style={{ color: 'var(--text-4)', fontSize: '.7rem', fontWeight: 700, padding: '8px 16px 4px', letterSpacing: '.05em' }}>
                {group.toUpperCase()}
              </div>
              {groupItems.map((item) => {
                const idx = globalIdx++
                const isSelected = idx === selected
                const Ic = item.icon
                return (
                  <button
                    key={item.id}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                    style={{
                      background: isSelected ? 'var(--accent-soft)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: '.875rem',
                    }}
                    onClick={() => execute(item)}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <Ic size={15} style={{ flexShrink: 0 }} />
                    <span>{item.label}</span>
                    {isSelected && <kbd style={{ marginLeft: 'auto', color: 'var(--text-4)', fontSize: '.7rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>↵</kbd>}
                  </button>
                )
              })}
            </div>
          ))}
          {items.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-4)', fontSize: '.875rem' }}>
              No results for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
