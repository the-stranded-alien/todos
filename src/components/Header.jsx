// ── Header ─────────────────────────────────────────────────
import { useRef, useEffect } from 'react'
import { Search, Command, HelpCircle, Download, Upload, CheckSquare, PanelLeftClose, PanelLeft, X, Settings } from '../icons.jsx'
import { useStore } from '../store/context.js'
import { usePrefs, setPrefs, resolvedTheme, withThemeTransition } from '../prefs.js'
import { useBackup } from '../hooks/useBackup.js'
import { getTheme, nextTheme } from '../themes.js'
import { ThemeIcon } from './ThemeIcon.jsx'
import { IconButton } from './ui/IconButton.jsx'
import { MenuButton } from './ui/Menu.jsx'

export const Header = ({ onOpenHelp, onOpenSettings, onOpenCommandPalette, sidebarVisible, onToggleSidebar }) => {
  const { state, dispatch } = useStore()
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

  const { downloadBackup, downloadCSV, restoreFromInput } = useBackup()

  const themeLabel = `Theme: ${getTheme(theme).label} (switch to ${getTheme(upcoming).label})`

  return (
    <header className="app-header surface-header no-print">
      <div className="header-start">
        <IconButton
          label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          icon={sidebarVisible ? PanelLeftClose : PanelLeft}
          onClick={onToggleSidebar}
          aria-expanded={sidebarVisible}
          tooltipAlign="start"
        />
        <div className="flex items-center gap-2">
          <div className="logo-tile rounded-lg p-1.5 flex">
            <CheckSquare size={15} variant="filled" />
          </div>
          <span className="logo-text">Todos</span>
        </div>
      </div>

      <div className="header-search relative" role="search" aria-label="Search tasks">
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

      <div className="header-end">
        <IconButton label="Command palette" tooltip="Command palette (Ctrl/⌘+K)" icon={Command} onClick={onOpenCommandPalette} />
        <MenuButton
          label="Download and restore"
          icon={Download}
          buttonProps={{ 'data-feat': 'success' }}
          items={[
            { label: 'Download backup (.json)', icon: Download, onSelect: downloadBackup },
            { label: 'Export tasks as CSV', icon: Download, onSelect: downloadCSV },
            { separator: true },
            { label: 'Restore from backup…', icon: Upload, onSelect: () => fileRef.current?.click() },
          ]}
        />
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={restoreFromInput} aria-label="Restore from backup file" tabIndex={-1} />
        <IconButton label="Help" icon={HelpCircle} onClick={onOpenHelp} />
        <IconButton label="Settings" tooltip="Settings (Ctrl/⌘+,)" icon={Settings} onClick={onOpenSettings} />
        <IconButton label={themeLabel} onClick={cycleTheme} tooltipAlign="end">
          <ThemeIcon key={theme} theme={theme} size={16} className="theme-icon-enter" />
        </IconButton>
      </div>
    </header>
  )
}
