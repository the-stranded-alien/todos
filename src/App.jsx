// ── App root ───────────────────────────────────────────────
import { useRef, useState, useMemo, useEffect, useCallback } from 'react'
import { StoreProvider } from './useStore.jsx'
import { useStore } from './store/context.js'
import { IconStyleContext } from './icons.jsx'
import { usePrefs, resolvedTheme } from './prefs.js'
import { getTheme } from './themes.js'
import { focusTaskRow } from './utils/focus.js'
import { useMediaQuery, NARROW } from './hooks/useMediaQuery.js'
import { Drawer } from './components/ui/Drawer.jsx'
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
import { SettingsDialog } from './components/Settings/SettingsDialog.jsx'
import { HelpDialog } from './components/HelpDialog.jsx'
import { Toaster } from './components/ui/Toaster.jsx'
import { toast } from './toast.js'
import { TooltipLayer } from './components/ui/TooltipLayer.jsx'

// ── Inner app (needs store context) ───────────────────────
const AppInner = () => {
  const { state, dispatch, undo, redo } = useStore()
  const prefs = usePrefs()
  const iconStyle = getTheme(resolvedTheme(prefs)).dark ? 'filled' : 'two-tone'
  const quickAddRef = useRef(null)
  const narrow = useMediaQuery(NARROW)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const toggleSidebar = useCallback(() => {
    if (narrow) setDrawerOpen(v => !v)
    else dispatch({ type: 'TOGGLE_SIDEBAR' })
  }, [narrow, dispatch])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  const [showShortcuts, setShowShortcuts]       = useState(false)
  const [settingsAt, setSettingsAt]             = useState(null) // null | section name
  const [showHelp, setShowHelp]                 = useState(false)
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

  // Close the detail panel; if focus was in it, put focus back on the task
  const selectedId = state.selectedTaskId
  const closeDetail = useCallback(() => {
    const inside = document.querySelector('.detail-panel')?.contains(document.activeElement)
    dispatch({ type: 'CLOSE_DETAIL' })
    if (inside && selectedId) focusTaskRow(selectedId)
  }, [dispatch, selectedId])

  // ── Hotkeys ──────────────────────────────────────────────
  const hotkeys = useMemo(() => [
    { key: 'n',  ctrl: false, shift: false, handler: () => quickAddRef.current?.focus() },
    { key: '/',  ctrl: false, shift: false, handler: () => window.dispatchEvent(new CustomEvent('focus-search')) },
    { key: '?',  ctrl: false, shift: false, handler: () => setShowShortcuts(true) },
    { key: 'k',  ctrl: true,  shift: false, handler: () => setCommandPalette(true) },
    { key: ',',  ctrl: true,  shift: false, handler: () => setSettingsAt('Workspace'), allowInInput: true },
    { key: 'z',  ctrl: true,  shift: false, handler: async () => toast(await undo() ? 'Undone.' : 'Nothing to undo.') },
    { key: 'z',  ctrl: true,  shift: true,  handler: async () => toast(await redo() ? 'Redone.' : 'Nothing to redo.') },
    { key: 'Escape', ctrl: false, shift: false, allowInInput: true, handler: () => {
        if (state.detailOpen) { closeDetail(); return }
      }
    },
    { key: '1', ctrl: false, shift: false, handler: () => dispatch({ type: 'SET_VIEW', view: 'inbox' }) },
    { key: '2', ctrl: false, shift: false, handler: () => dispatch({ type: 'SET_VIEW', view: 'today' }) },
    { key: '3', ctrl: false, shift: false, handler: () => dispatch({ type: 'SET_VIEW', view: 'upcoming' }) },
    { key: '4', ctrl: false, shift: false, handler: () => dispatch({ type: 'SET_VIEW', view: 'all' }) },
    { key: 'f', ctrl: false, shift: false, handler: () => setFocusMode(v => !v) },
  ], [dispatch, undo, redo, state.detailOpen, closeDetail])

  useHotkeys(hotkeys)

  const { view, detailOpen, loading } = state

  const sidebarProps = {
    onNewProject: () => { setDrawerOpen(false); setProjectEditor('new') },
    onEditProject: (p) => { setDrawerOpen(false); setProjectEditor(p) },
    onNewTag: () => { setDrawerOpen(false); setTagEditor('new') },
    onEditTag: (t) => { setDrawerOpen(false); setTagEditor(t) },
  }

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
        onOpenHelp={() => setShowHelp(true)}
        onOpenSettings={() => setSettingsAt('Workspace')}
        onOpenCommandPalette={() => setCommandPalette(true)}
        sidebarVisible={narrow ? drawerOpen : state.sidebarOpen}
        onToggleSidebar={toggleSidebar}
      />

      {/* Main layout */}
      <div className="app-body">
        {/* Sidebar: inline on wide screens, a modal drawer on narrow ones */}
        {!narrow && state.sidebarOpen && <Sidebar {...sidebarProps} />}
        {narrow && drawerOpen && (
          <Drawer label="Navigation" onClose={closeDrawer}>
            <Sidebar {...sidebarProps} drawer onNavigate={closeDrawer} />
          </Drawer>
        )}

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
            <TaskDetail onClose={closeDetail} />
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
          onOpenSettings={(section) => { setCommandPalette(false); setSettingsAt(section || 'Workspace') }}
          onOpenHelp={() => { setCommandPalette(false); setShowHelp(true) }}
          onShowShortcuts={() => { setCommandPalette(false); setShowShortcuts(true) }}
          quickAddRef={quickAddRef}
        />
      )}
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
      {settingsAt && (
        <SettingsDialog
          initialSection={settingsAt}
          onClose={() => setSettingsAt(null)}
          onOpenHelp={() => { setSettingsAt(null); setShowHelp(true) }}
          onOpenShortcuts={() => { setSettingsAt(null); setShowShortcuts(true) }}
        />
      )}
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
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
      <Toaster />
      <TooltipLayer />
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
