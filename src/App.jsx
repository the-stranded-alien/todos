// ── App root ───────────────────────────────────────────────
import { useRef, useState, useMemo, useEffect } from 'react'
import { StoreProvider } from './useStore.jsx'
import { useStore } from './store/context.js'
import { IconStyleContext } from './icons.jsx'
import { usePrefs, resolvedTheme } from './prefs.js'
import { getTheme } from './themes.js'
import { useHotkeys } from './hooks/useHotkeys.js'
import { useNotifications } from './hooks/useNotifications.js'

import { Header } from './components/Header.jsx'
import { Sidebar } from './components/Sidebar.jsx'
import { TaskList } from './components/TaskList.jsx'
import { TaskDetail } from './components/TaskDetail.jsx'
import { CalendarView } from './components/CalendarView.jsx'
import { StatsPanel } from './components/StatsPanel.jsx'
import { FocusMode } from './components/FocusMode.jsx'
import { BulkActionsBar } from './components/BulkActionsBar.jsx'
import { CommandPalette } from './components/CommandPalette.jsx'
import { ShortcutsHelp } from './components/Modals/ShortcutsHelp.jsx'
import { ProjectEditor } from './components/Modals/ProjectEditor.jsx'
import { TagEditor } from './components/Modals/TagEditor.jsx'

// ── Inner app (needs store context) ───────────────────────
const AppInner = () => {
  const { state, dispatch, undo, redo } = useStore()
  const prefs = usePrefs()
  const iconStyle = getTheme(resolvedTheme(prefs)).dark ? 'filled' : 'two-tone'
  const quickAddRef = useRef(null)

  const [showShortcuts, setShowShortcuts]       = useState(false)
  const [showCommandPalette, setCommandPalette] = useState(false)
  const [focusMode, setFocusMode]               = useState(false)
  const [projectEditor, setProjectEditor]       = useState(null) // null | 'new' | project
  const [tagEditor, setTagEditor]               = useState(null)

  useNotifications()

  // ── Service worker message handler ──────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (e) => {
      if (e.data?.type === 'OPEN_TASK') {
        dispatch({ type: 'SELECT_TASK', id: e.data.taskId })
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [dispatch])

  // ── Programmatic view switch (used by browser checks and OS shortcuts)
  useEffect(() => {
    const onSetView = (e) => { if (typeof e.detail === 'string') dispatch({ type: 'SET_VIEW', view: e.detail }) }
    window.addEventListener('todos:set-view', onSetView)
    return () => window.removeEventListener('todos:set-view', onSetView)
  }, [dispatch])

  // ── Hotkeys ──────────────────────────────────────────────
  const hotkeys = useMemo(() => [
    { key: 'n',  ctrl: false, shift: false, handler: () => quickAddRef.current?.focus() },
    { key: '/',  ctrl: false, shift: false, handler: () => window.dispatchEvent(new CustomEvent('focus-search')) },
    { key: '?',  ctrl: false, shift: false, handler: () => setShowShortcuts(true) },
    { key: 'k',  ctrl: true,  shift: false, handler: () => setCommandPalette(true) },
    { key: 'z',  ctrl: true,  shift: false, handler: () => undo() },
    { key: 'z',  ctrl: true,  shift: true,  handler: () => redo() },
    { key: 'Escape', ctrl: false, shift: false, handler: () => {
        if (showShortcuts) { setShowShortcuts(false); return }
        if (showCommandPalette) { setCommandPalette(false); return }
        if (focusMode) { setFocusMode(false); return }
        if (state.detailOpen) { dispatch({ type: 'CLOSE_DETAIL' }); return }
      }
    },
    { key: '1', ctrl: false, shift: false, handler: () => dispatch({ type: 'SET_VIEW', view: 'inbox' }) },
    { key: '2', ctrl: false, shift: false, handler: () => dispatch({ type: 'SET_VIEW', view: 'today' }) },
    { key: '3', ctrl: false, shift: false, handler: () => dispatch({ type: 'SET_VIEW', view: 'upcoming' }) },
    { key: '4', ctrl: false, shift: false, handler: () => dispatch({ type: 'SET_VIEW', view: 'all' }) },
    { key: 'f', ctrl: false, shift: false, handler: () => setFocusMode(v => !v) },
    { key: 'F', ctrl: false, shift: true,  handler: () => setFocusMode(v => !v) },
  ], [dispatch, undo, redo, showShortcuts, showCommandPalette, focusMode, state.detailOpen])

  useHotkeys(hotkeys)

  const { view, detailOpen, loading } = state

  const isCalendar = view === 'calendar'
  const isStats = view === 'stats'

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center min-h-screen">
        <div style={{ color: 'var(--text-4)', fontSize: '.9rem' }}>Loading…</div>
      </div>
    )
  }

  return (
    <IconStyleContext.Provider value={iconStyle}>
    <div className="app-shell">
      {/* Header */}
      <Header
        onShowShortcuts={() => setShowShortcuts(true)}
        onOpenCommandPalette={() => setCommandPalette(true)}
      />

      {/* Main layout */}
      <div
        className="flex"
        style={{ paddingTop: 56, height: '100vh' }}
      >
        {/* Sidebar */}
        <Sidebar
          onNewProject={() => setProjectEditor('new')}
          onEditProject={(p) => setProjectEditor(p)}
          onNewTag={() => setTagEditor('new')}
          onEditTag={(t) => setTagEditor(t)}
        />

        {/* Main content */}
        <main className="flex flex-1 min-w-0 overflow-hidden">
          {/* Task list or special view */}
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
            {isCalendar ? (
              <CalendarView />
            ) : isStats ? (
              <StatsPanel />
            ) : (
              <TaskList quickAddRef={quickAddRef} />
            )}
          </div>

          {/* Detail panel */}
          {detailOpen && (
            <TaskDetail onClose={() => dispatch({ type: 'CLOSE_DETAIL' })} />
          )}
        </main>
      </div>

      {/* Overlays */}
      {focusMode && <FocusMode onClose={() => setFocusMode(false)} />}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setCommandPalette(false)}
          onNewProject={() => { setCommandPalette(false); setProjectEditor('new') }}
          onNewTag={() => { setCommandPalette(false); setTagEditor('new') }}
          quickAddRef={quickAddRef}
        />
      )}
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
      {projectEditor && (
        <ProjectEditor
          project={projectEditor === 'new' ? null : projectEditor}
          onClose={() => setProjectEditor(null)}
        />
      )}
      {tagEditor && (
        <TagEditor
          tag={tagEditor === 'new' ? null : tagEditor}
          onClose={() => setTagEditor(null)}
        />
      )}

      {/* Bulk actions */}
      <BulkActionsBar />
    </div>
    </IconStyleContext.Provider>
  )
}

// ── App (with provider) ────────────────────────────────────
export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  )
}
