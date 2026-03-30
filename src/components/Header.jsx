// ── Header ─────────────────────────────────────────────────
import { useRef, useState, useCallback, useEffect } from 'react'
import { Search, Moon, Sun, Command, HelpCircle, Download, Upload, CheckSquare, PanelLeftClose, PanelLeft } from 'lucide-react'
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

  // Focus search via global event (triggered by '/' hotkey)
  useEffect(() => {
    const focus = () => { searchRef.current?.focus(); searchRef.current?.select() }
    window.addEventListener('focus-search', focus)
    return () => window.removeEventListener('focus-search', focus)
  }, [])

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return
    const close = (e) => {
      if (!e.target.closest('[data-export-menu]')) setShowExportMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showExportMenu])

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
    <header className="surface-header fixed top-0 left-0 right-0 z-30 flex items-center gap-2 px-4 h-14">

      {/* Sidebar toggle */}
      <button
        className="btn btn-ghost p-1.5"
        onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        aria-label="Toggle sidebar"
        style={{ flexShrink: 0 }}
      >
        {state.sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 mr-3" style={{ flexShrink: 0 }}>
        <div className="rounded-lg p-1.5" style={{ background: 'var(--accent)', color: '#fff' }}>
          <CheckSquare size={15} />
        </div>
        <span style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--text-1)' }}>Todos</span>
      </div>

      {/* Search */}
      <div className="flex-1 relative" style={{ maxWidth: 420 }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', pointerEvents: 'none' }} />
        <input
          ref={searchRef}
          className="input-base"
          style={{ paddingLeft: 30, paddingRight: state.searchQuery ? 28 : 10 }}
          placeholder="Search tasks…"
          value={state.searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
          aria-label="Search tasks"
        />
        {state.searchQuery && (
          <button
            onClick={() => dispatch({ type: 'SET_SEARCH', query: '' })}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', lineHeight: 1, padding: 2 }}
            aria-label="Clear search"
          >✕</button>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5 ml-auto">

        {/* Command palette */}
        <button
          className="btn btn-ghost p-1.5"
          onClick={onOpenCommandPalette}
          aria-label="Command palette (Ctrl+K)"
          title="Command palette (Ctrl+K)"
        >
          <Command size={16} />
        </button>

        {/* Export / Import */}
        <div className="relative" data-export-menu>
          <button
            className="btn btn-ghost p-1.5"
            onClick={() => setShowExportMenu(v => !v)}
            aria-label="Export / Import"
            title="Export / Import"
          >
            <Download size={16} />
          </button>
          {showExportMenu && (
            <div
              className="anim-drop-in absolute right-0 top-full mt-1 rounded-xl py-1 z-50"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', width: 160, minWidth: 'max-content' }}
            >
              <button className="btn btn-ghost w-full justify-start px-3 py-2 rounded-none" style={{ fontSize: '.825rem' }} onClick={handleExportJSON}>
                <Download size={13} /> Export JSON
              </button>
              <button className="btn btn-ghost w-full justify-start px-3 py-2 rounded-none" style={{ fontSize: '.825rem' }} onClick={handleExportCSV}>
                <Download size={13} /> Export CSV
              </button>
              <div style={{ height: 1, background: 'var(--border-light)', margin: '2px 0' }} />
              <button className="btn btn-ghost w-full justify-start px-3 py-2 rounded-none" style={{ fontSize: '.825rem' }} onClick={() => { fileRef.current?.click(); setShowExportMenu(false) }}>
                <Upload size={13} /> Import JSON
              </button>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} aria-label="Import JSON file" />

        {/* Keyboard shortcuts */}
        <button
          className="btn btn-ghost p-1.5"
          onClick={onShowShortcuts}
          aria-label="Keyboard shortcuts (?)"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircle size={16} />
        </button>

        {/* Dark mode */}
        <button
          className="btn btn-ghost p-1.5"
          onClick={toggleDark}
          aria-label="Toggle dark mode"
          title="Toggle dark mode"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  )
}
