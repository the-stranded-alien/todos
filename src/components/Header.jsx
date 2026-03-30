// ── Header ─────────────────────────────────────────────────
import { useRef, useState, useCallback } from 'react'
import { Search, Moon, Sun, Keyboard, Download, Upload, CheckSquare, PanelLeftClose, PanelLeft } from 'lucide-react'
import { useStore } from '../useStore.jsx'
import { useIsDark, toggleDark } from '../hooks/useIsDark.js'
import * as dbUtils from '../db.js'
import { exportJSON, exportCSV } from '../utils/export.js'

export const Header = ({ onShowShortcuts, onOpenCommandPalette }) => {
  const { state, dispatch, importData } = useStore()
  const isDark = useIsDark()
  const searchRef = useRef(null)
  const fileRef = useRef(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const focusSearch = useCallback(() => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }, [])

  // Expose focus search to parent via global event
  useCallback(() => {
    window.addEventListener('focus-search', focusSearch)
    return () => window.removeEventListener('focus-search', focusSearch)
  }, [focusSearch])

  const handleExportJSON = async () => {
    const data = await dbUtils.exportAll()
    exportJSON(data)
    setShowExportMenu(false)
  }

  const handleExportCSV = async () => {
    const data = await dbUtils.exportAll()
    exportCSV(data.tasks, data.projects, data.tags)
    setShowExportMenu(false)
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const data = JSON.parse(text)
      await importData(data)
    } catch {
      alert('Invalid JSON file')
    }
    e.target.value = ''
  }

  return (
    <header
      className="surface-header fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 h-14"
    >
      {/* Sidebar toggle */}
      <button
        className="btn btn-ghost p-1.5"
        onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        aria-label="Toggle sidebar"
      >
        {state.sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="rounded-lg p-1.5" style={{ background: 'var(--accent)', color: '#fff' }}>
          <CheckSquare size={16} />
        </div>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-1)' }}>Todos</span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search
          size={14}
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }}
        />
        <input
          ref={searchRef}
          className="input-base"
          style={{ paddingLeft: 30, fontSize: '.875rem' }}
          placeholder="Search tasks… (/)"
          value={state.searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
          aria-label="Search tasks"
        />
        {state.searchQuery && (
          <button
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => dispatch({ type: 'SET_SEARCH', query: '' })}
            aria-label="Clear search"
          >✕</button>
        )}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* Privacy note */}
        <span style={{ fontSize: '.7rem', color: 'var(--text-4)', display: 'none' }} className="sm:inline">
          All data stays in your browser
        </span>

        {/* Command palette */}
        <button
          className="btn btn-ghost p-1.5"
          onClick={onOpenCommandPalette}
          aria-label="Command palette (Ctrl+K)"
          title="Command palette (Ctrl+K)"
        >
          <Keyboard size={17} />
        </button>

        {/* Export/Import */}
        <div className="relative">
          <button
            className="btn btn-ghost p-1.5"
            onClick={() => setShowExportMenu(v => !v)}
            aria-label="Export / Import"
            title="Export / Import"
          >
            <Download size={17} />
          </button>
          {showExportMenu && (
            <div
              className="anim-drop-in absolute right-0 top-full mt-1 rounded-xl py-1 w-44 z-50"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
            >
              <button className="btn btn-ghost w-full text-left rounded-none justify-start px-3 py-2" onClick={handleExportJSON}>
                <Download size={14} /> Export JSON
              </button>
              <button className="btn btn-ghost w-full text-left rounded-none justify-start px-3 py-2" onClick={handleExportCSV}>
                <Download size={14} /> Export CSV
              </button>
              <button className="btn btn-ghost w-full text-left rounded-none justify-start px-3 py-2" onClick={() => { fileRef.current?.click(); setShowExportMenu(false) }}>
                <Upload size={14} /> Import JSON
              </button>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} aria-label="Import file" />

        {/* Shortcuts */}
        <button
          className="btn btn-ghost p-1.5"
          onClick={onShowShortcuts}
          aria-label="Keyboard shortcuts (?)"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard size={17} />
        </button>

        {/* Dark mode */}
        <button
          className="btn btn-ghost p-1.5"
          onClick={toggleDark}
          aria-label="Toggle dark mode"
          title="Toggle dark mode"
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  )
}
