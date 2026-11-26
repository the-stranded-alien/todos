// ── Command palette ────────────────────────────────────────
import { useState, useCallback, useMemo, useRef, useEffect, useId } from 'react'
import { Search, Plus, Folder, Tag, LayoutList, Sun, Palette, Contrast, Rows3, CheckSquare, Download, Settings, HelpCircle, Keyboard } from '../icons.jsx'
import { useStore } from '../store/context.js'
import { Dialog } from './ui/Dialog.jsx'
import { requestPersist, PERSIST_DENIED_HELP } from '../utils/persist.js'
import { toast } from '../toast.js'
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

export const CommandPalette = ({ onClose, onNewProject, onNewTag, onOpenSettings, onOpenHelp, onShowShortcuts, quickAddRef }) => {
  const { state, dispatch } = useStore()
  const prefs = usePrefs()
  const appearanceCmds = useMemo(() => [
    ...availableThemes(prefs.extraThemes).map(t => ({
      id: `theme:${t.id}`, label: `Theme: ${t.label}${resolvedTheme(prefs) === t.id ? ' (current)' : ''}`, icon: Palette, group: 'Appearance',
    })),
    { id: 'toggle-extra-themes', label: prefs.extraThemes ? 'Hide additional themes' : 'Show additional themes', icon: Palette, group: 'Appearance' },
    { id: 'toggle-high-contrast', label: prefs.highContrast ? 'Turn off high contrast' : 'Turn on high contrast', icon: Contrast, group: 'Appearance' },
    { id: 'settings:Workspace', label: 'Open settings', icon: Settings, group: 'App' },
    { id: 'settings:Appearance', label: 'Settings: Appearance and themes', icon: Palette, group: 'App' },
    { id: 'settings:Features', label: 'Settings: Features', icon: Settings, group: 'App' },
    { id: 'settings:Storage', label: 'Settings: Storage and backups', icon: Settings, group: 'App' },
    { id: 'help', label: 'Open help', icon: HelpCircle, group: 'App' },
    { id: 'shortcuts', label: 'Keyboard shortcuts', icon: Keyboard, group: 'App' },
    { id: 'toggle-reduce-motion', label: prefs.reduceMotion ? 'Allow animations' : 'Reduce motion', icon: Settings, group: 'Appearance' },
    { id: 'persist-storage', label: 'Keep my data on this device (persistent storage)', icon: Download, group: 'Data' },
    { id: 'toggle-density', label: prefs.density === 'compact' ? 'Use comfortable density' : 'Use compact density', icon: Rows3, group: 'Appearance' },
  ], [prefs])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)


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
    else if (item.id.startsWith('settings:')) onOpenSettings(item.id.slice(9))
    else if (item.id === 'help') onOpenHelp()
    else if (item.id === 'shortcuts') onShowShortcuts()
    else if (item.id === 'toggle-reduce-motion') { setPrefs(p => ({ reduceMotion: !p.reduceMotion })); onClose() }
    else if (item.id === 'persist-storage') {
      onClose()
      requestPersist().then(r => toast(
        r === 'granted' ? { message: 'Your browser will keep this data until you clear it.', tone: 'success' }
          : r === 'unsupported' ? { message: 'This browser can’t promise to keep data. Download a backup to be safe.', tone: 'warning' }
          : { message: PERSIST_DENIED_HELP, tone: 'warning', duration: 9000 },
      ))
    }
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
  }, [onClose, onNewProject, onNewTag, onOpenSettings, onOpenHelp, onShowShortcuts, quickAddRef, dispatch])

  // Group items; `ordered` is the display order used for highlighting and Enter
  const { groups, ordered } = useMemo(() => {
    const g = {}
    for (const item of items) (g[item.group] ??= []).push(item)
    return { groups: Object.entries(g), ordered: Object.values(g).flat() }
  }, [items])

  const listId = useId()
  const optionId = (i) => `${listId}-opt-${i}`
  const listRef = useRef(null)

  // Keep the highlighted option in view
  useEffect(() => {
    listRef.current?.querySelector(`#${CSS.escape(optionId(selected))}`)?.scrollIntoView({ block: 'nearest' })
  })

  const handleKeyDown = (e) => {
    const last = ordered.length - 1
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => (s >= last ? 0 : s + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => (s <= 0 ? last : s - 1)) }
    else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setSelected(0) }
    else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); setSelected(last) }
    else if (e.key === 'Enter') { e.preventDefault(); if (ordered[selected]) execute(ordered[selected]) }
  }

  let idx = -1

  return (
    <Dialog title="Command palette" onClose={onClose} hideHeader placement="top" size="md" initialFocus={inputRef} className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <Search size={17} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(0) }}
          onKeyDown={handleKeyDown}
          placeholder="Type a command or search…"
          className="palette-input"
          role="combobox"
          aria-label="Search commands, views and tasks"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={ordered.length ? optionId(selected) : undefined}
        />
        <kbd className="kbd">Esc</kbd>
      </div>

      <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="palette-list">
        {groups.map(([group, groupItems]) => (
          <div key={group} role="group" aria-labelledby={`${listId}-${group.replace(/\W/g, '')}`}>
            <div id={`${listId}-${group.replace(/\W/g, '')}`} role="presentation" className="menu-heading" style={{ padding: '8px 16px 4px' }}>
              {group}
            </div>
            {groupItems.map((item) => {
              const i = ++idx
              const isSelected = i === selected
              const Ic = item.icon
              return (
                <div
                  key={item.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSelected}
                  className="palette-option"
                  onClick={() => execute(item)}
                  onMouseMove={() => { if (!isSelected) setSelected(i) }}
                >
                  <Ic size={15} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {isSelected && <kbd className="kbd" aria-hidden="true">↵</kbd>}
                </div>
              )
            })}
          </div>
        ))}
        {ordered.length === 0 && (
          <div role="presentation" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: '.875rem' }}>
            No results for “{query}”. Try a shorter word.
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">{query ? `${ordered.length} results` : ''}</p>
    </Dialog>
  )
}
