// ── Header ─────────────────────────────────────────────────
import { useRef, useEffect } from 'react'
import { Search, Command, HelpCircle, Download, Upload, CheckSquare, PanelLeftClose, PanelLeft, X } from '../icons.jsx'
import { useStore } from '../store/context.js'
import { usePrefs, setPrefs, resolvedTheme, withThemeTransition } from '../prefs.js'
import { getTheme, nextTheme } from '../themes.js'
import { ThemeIcon } from './ThemeIcon.jsx'
import { IconButton } from './ui/IconButton.jsx'
import { MenuButton } from './ui/Menu.jsx'
import * as dbUtils from '../db.js'
import { exportJSON, exportCSV } from '../utils/export.js'
import { toast } from '../toast.js'

export const Header = ({ onShowShortcuts, onOpenCommandPalette }) => {
  const { state, dispatch, importData } = useStore()
  const prefs = usePrefs()
  const theme = resolvedTheme(prefs)
  const upcoming = nextTheme(theme, prefs.extraThemes)
  const cycleTheme = () => withThemeTransition(() => setPrefs({ theme: upcoming }))
  const searchRef = useRef(null)
  const fileRef = useRef(null)

  // Focus search via global event (triggered by '/' hotkey)
  useEffect(() => {
    const focus = () => { searchRef.current?.focus(); searchRef.current?.select() }
    window.addEventListener('focus-search', focus)
    return () => window.removeEventListener('focus-search', focus)
  }, [])

  const handleExportJSON = async () => {
    exportJSON(await dbUtils.exportAll())
    toast({ message: 'Backup downloaded.', tone: 'success' })
  }

  const handleExportCSV = async () => {
    const data = await dbUtils.exportAll()
    exportCSV(data.tasks, data.projects, data.tags)
    toast({ message: 'CSV downloaded.', tone: 'success' })
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    let data
    try {
      data = JSON.parse(await file.text())
    } catch {
      toast({ message: `“${file.name}” isn’t a Todos backup: it isn’t valid JSON.`, tone: 'warning' })
      return
    }
    await importData(data)
    toast({ message: `Restored ${data.tasks?.length ?? 0} tasks from “${file.name}”.`, tone: 'success' })
  }

  const themeLabel = `Theme: ${getTheme(theme).label} (switch to ${getTheme(upcoming).label})`

  return (
    <header className="surface-header fixed top-0 left-0 right-0 z-30 flex items-center gap-2 px-3 h-14 no-print">
      <IconButton
        label={state.sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        icon={state.sidebarOpen ? PanelLeftClose : PanelLeft}
        onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        aria-expanded={state.sidebarOpen}
        tooltipAlign="start"
      />

      <div className="flex items-center gap-2 mr-3" style={{ flexShrink: 0 }}>
        <div className="logo-tile rounded-lg p-1.5 flex">
          <CheckSquare size={15} variant="filled" />
        </div>
        <span style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--text-1)' }}>Todos</span>
      </div>

      <div className="flex-1 relative" style={{ maxWidth: 420 }} role="search">
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
        <input
          ref={searchRef}
          className="input-base"
          type="search"
          style={{ paddingLeft: 30, paddingRight: state.searchQuery ? 34 : 10 }}
          placeholder="Search tasks…"
          value={state.searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
          onKeyDown={e => { if (e.key === 'Escape' && state.searchQuery) { e.preventDefault(); dispatch({ type: 'SET_SEARCH', query: '' }) } }}
          aria-label="Search tasks"
        />
        {state.searchQuery && (
          <IconButton
            label="Clear search"
            icon={X}
            size={12}
            small
            onClick={() => { dispatch({ type: 'SET_SEARCH', query: '' }); searchRef.current?.focus() }}
            style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)' }}
          />
        )}
      </div>

      <div className="flex items-center gap-0.5 ml-auto">
        <IconButton label="Command palette" tooltip="Command palette (Ctrl/⌘+K)" icon={Command} onClick={onOpenCommandPalette} />
        <MenuButton
          label="Download and restore"
          icon={Download}
          buttonProps={{ 'data-feat': 'success' }}
          items={[
            { label: 'Download backup (.json)', icon: Download, onSelect: handleExportJSON },
            { label: 'Export tasks as CSV', icon: Download, onSelect: handleExportCSV },
            { separator: true },
            { label: 'Restore from backup…', icon: Upload, onSelect: () => fileRef.current?.click() },
          ]}
        />
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} aria-label="Restore from backup file" tabIndex={-1} />
        <IconButton label="Keyboard shortcuts" tooltip="Keyboard shortcuts (?)" icon={HelpCircle} onClick={onShowShortcuts} />
        <IconButton label={themeLabel} onClick={cycleTheme} tooltipAlign="end">
          <ThemeIcon key={theme} theme={theme} size={16} className="theme-icon-enter" />
        </IconButton>
      </div>
    </header>
  )
}
