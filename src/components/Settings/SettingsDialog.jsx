// ── Settings ───────────────────────────────────────────────
// Vertical tabs: Workspace, Appearance, Features, Storage, About.
import { useEffect, useId, useRef, useState } from 'react'
import { Dialog } from '../ui/Dialog.jsx'
import { Switch } from '../ui/Switch.jsx'
import { ThemePreview } from './ThemePreview.jsx'
import { useStore } from '../../store/context.js'
import { usePrefs, setPrefs, withThemeTransition } from '../../prefs.js'
import { availableThemes, getTheme } from '../../themes.js'
import { useBackup } from '../../hooks/useBackup.js'
import { getSnapshots } from '../../db.js'
import { canPersist, isPersisted, requestPersist, storageEstimate, PERSIST_DENIED_HELP } from '../../utils/persist.js'
import { requestNotificationPermission } from '../../hooks/useNotifications.js'
import { toast } from '../../toast.js'
import { Download, Upload, Trash2 } from '../../icons.jsx'

const SETTINGS_SECTIONS = ['Workspace', 'Appearance', 'Features', 'Storage', 'About']

const VIEWS = [['inbox', 'Inbox'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['all', 'All tasks']]

const formatBytes = (n) => {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(1)} GB`
}

const Section = ({ title, children }) => (
  <section className="settings-section">
    <h3 className="detail-label">{title}</h3>
    {children}
  </section>
)

const Segmented = ({ label, value, options, onChange }) => {
  const id = useId()
  return (
    <div className="switch-row">
      <span className="switch-text"><span className="switch-label" id={id}>{label}</span></span>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {options.map(([v, text]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  )
}

// ── Panels ─────────────────────────────────────────────────

const Workspace = ({ prefs }) => (
  <>
    <Section title="Start-up">
      <div className="switch-row">
        <label className="switch-text" htmlFor="pref-default-view">
          <span className="switch-label">Open on</span>
          <span className="switch-desc">The view you see when the app starts.</span>
        </label>
        <select id="pref-default-view" className="input-base" style={{ width: 'auto' }} value={prefs.defaultView} onChange={e => setPrefs({ defaultView: e.target.value })}>
          {VIEWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
    </Section>
    <Section title="Calendar">
      <Segmented label="Week starts on" value={prefs.weekStart} options={[[0, 'Sunday'], [1, 'Monday']]} onChange={v => setPrefs({ weekStart: v })} />
    </Section>
  </>
)

const Appearance = ({ prefs }) => {
  const themes = availableThemes(prefs.extraThemes)
  const pick = (id) => withThemeTransition(() => setPrefs({ theme: id }))
  const labelId = useId()
  return (
    <>
      <Section title="Theme">
        <div className="theme-grid" role="radiogroup" aria-labelledby={labelId}>
          <span id={labelId} className="sr-only">Theme</span>
          <button type="button" role="radio" aria-checked={prefs.theme == null} className="theme-card" onClick={() => pick(null)}>
            <span className="theme-mini-split"><ThemePreview theme={getTheme('light')} /><ThemePreview theme={getTheme('dark')} /></span>
            <span className="theme-card-label">Match device</span>
          </button>
          {themes.map(t => (
            <button key={t.id} type="button" role="radio" aria-checked={prefs.theme === t.id} className="theme-card" onClick={() => pick(t.id)}>
              <ThemePreview theme={t} />
              <span className="theme-card-label">{t.label}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Options">
        <Switch label="Additional themes" description="Show Ocean, Forest, Sun, Nord, Monokai, Solarized and the Neon themes." checked={prefs.extraThemes} onChange={v => setPrefs({ extraThemes: v })} />
        <Switch label="High contrast" description="Stronger text and borders. Works with every theme." checked={prefs.highContrast} onChange={v => setPrefs({ highContrast: v })} />
        <Switch label="Reduce motion" description="Turn off animations, even if your device allows them." checked={prefs.reduceMotion} onChange={v => setPrefs({ reduceMotion: v })} />
        <Segmented label="Density" value={prefs.density} options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]} onChange={v => setPrefs({ density: v })} />
      </Section>
    </>
  )
}

const Features = ({ prefs }) => {
  const voiceSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  const notifySupported = typeof window !== 'undefined' && 'Notification' in window
  const toggleReminders = async (on) => {
    if (!on) { setPrefs({ reminders: false }); return }
    const ok = await requestNotificationPermission()
    if (ok) setPrefs({ reminders: true })
    else toast({ message: 'Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.', tone: 'warning', duration: 9000 })
  }
  return (
    <Section title="Features">
      <Switch
        label="Voice input"
        description={voiceSupported ? 'Show the microphone in the add-task box.' : 'Your browser can’t do speech recognition. Use Chrome, Edge or Safari.'}
        checked={voiceSupported && prefs.voice}
        disabled={!voiceSupported}
        onChange={v => setPrefs({ voice: v })}
      />
      <Switch label="Time tracking" description="Show start/stop timers on tasks and in focus mode." checked={prefs.timers} onChange={v => setPrefs({ timers: v })} />
      <Switch
        label="Due-time reminders"
        description={notifySupported ? 'Notify you when a task with a due time is due (while the app is open).' : 'Your browser doesn’t support notifications.'}
        checked={notifySupported && prefs.reminders}
        disabled={!notifySupported}
        onChange={toggleReminders}
      />
      <Switch
        label="Hide AI features"
        description="Removes “Suggest subtasks”. When shown, it runs on your device with Chrome’s built-in AI and nothing is sent anywhere."
        checked={prefs.hideAI}
        onChange={v => setPrefs({ hideAI: v })}
      />
    </Section>
  )
}

const Storage = ({ onClose }) => {
  const { state, clearCompleted, undo, dispatch } = useStore()
  const { downloadBackup, restoreFromInput, restoreSnapshot } = useBackup()
  const [info, setInfo] = useState({ estimate: null, persisted: null, snapshots: [] })
  const fileRef = useRef(null)

  useEffect(() => {
    let alive = true
    Promise.all([storageEstimate(), isPersisted(), getSnapshots()]).then(([estimate, persisted, snapshots]) => {
      if (alive) setInfo({ estimate, persisted, snapshots })
    })
    return () => { alive = false }
  }, [state.tasks])

  const persist = async () => {
    const r = await requestPersist()
    if (r === 'granted') { setInfo(i => ({ ...i, persisted: true })); toast({ message: 'Your browser will keep this data until you clear it.', tone: 'success' }) }
    else toast({ message: r === 'unsupported' ? 'This browser can’t promise to keep data. Download a backup to be safe.' : PERSIST_DENIED_HELP, tone: 'warning', duration: 9000 })
  }

  const done = state.tasks.filter(t => t.completed && !t.parentId).length
  const usage = info.estimate?.usage, quota = info.estimate?.quota

  return (
    <>
      <Section title="On this device">
        <p className="settings-text">Everything is stored in this browser, on this device. Nothing is uploaded.</p>
        <dl className="settings-stats">
          <div><dt>Tasks</dt><dd>{state.tasks.length}</dd></div>
          <div><dt>Projects</dt><dd>{state.projects.length}</dd></div>
          <div><dt>Tags</dt><dd>{state.tags.length}</dd></div>
          <div><dt>Space used</dt><dd>{formatBytes(usage)}</dd></div>
        </dl>
        {quota ? (
          <div className="usage-bar" role="meter" aria-label="Storage used" aria-valuemin={0} aria-valuemax={quota} aria-valuenow={usage} aria-valuetext={`${formatBytes(usage)} of ${formatBytes(quota)}`}>
            <span style={{ width: `${Math.max(1, Math.min(100, (usage / quota) * 100))}%` }} />
          </div>
        ) : null}
        <div className="switch-row">
          <span className="switch-text">
            <span className="switch-label">Persistent storage</span>
            <span className="switch-desc">
              {info.persisted ? 'On: the browser won’t clear this data to free up space.'
                : canPersist() ? 'Off: the browser may clear data from sites you rarely use.'
                : 'Not available in this browser. Download backups now and then.'}
            </span>
          </span>
          {!info.persisted && canPersist() && <button type="button" className="btn btn-ghost" onClick={persist}>Keep my data</button>}
        </div>
      </Section>

      <Section title="Backups">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={downloadBackup}><Download size={14} /> Download backup</button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={14} /> Restore from backup…</button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" tabIndex={-1} aria-label="Restore from backup file" onChange={restoreFromInput} />
        </div>
        <p className="settings-text">A backup is one .json file with your tasks, projects, tags, activity and settings. Restoring saves a copy of your current data first.</p>
      </Section>

      <Section title="Saved copies">
        {info.snapshots.length === 0 ? (
          <p className="settings-text">None yet. A copy is saved automatically before every restore.</p>
        ) : (
          <ul className="snapshot-list">
            {info.snapshots.map(s => (
              <li key={s.id}>
                <span>
                  <span className="switch-label">{new Date(s.createdAt).toLocaleString()}</span>
                  <span className="switch-desc">{s.reason} · {s.counts?.tasks ?? s.data.tasks.length} tasks</span>
                </span>
                <button type="button" className="btn btn-ghost" onClick={() => restoreSnapshot(s)}>Restore this copy</button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Trash">
        <div className="switch-row">
          <span className="switch-text">
            <span className="switch-label">Deleted tasks</span>
            <span className="switch-desc">{state.trash.length ? `${state.trash.length} in the trash, each kept for 30 days.` : 'The trash is empty.'}</span>
          </span>
          <button type="button" className="btn btn-ghost" onClick={() => { onClose(); dispatch({ type: 'SET_VIEW', view: 'trash' }) }}>Open trash</button>
        </div>
      </Section>

      <Section title="Clean up">
        <div className="switch-row">
          <span className="switch-text">
            <span className="switch-label">Completed tasks</span>
            <span className="switch-desc">{done ? `${done} completed task${done > 1 ? 's' : ''} (and their subtasks) move to the trash.` : 'Nothing to clear.'}</span>
          </span>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!done}
            onClick={async () => {
              const n = await clearCompleted()
              toast({ message: `Cleared ${n} completed task${n === 1 ? '' : 's'}.`, action: { label: 'Undo', onClick: undo } })
            }}
          >
            <Trash2 size={14} /> Clear completed
          </button>
        </div>
      </Section>
    </>
  )
}

const About = ({ onOpenHelp, onOpenShortcuts }) => (
  <>
    <Section title="Todos">
      <p className="settings-text">Version {__APP_VERSION__} · built {__BUILD_DATE__}</p>
      <p className="settings-text">
        <strong>Private by default.</strong> Everything runs and is stored in your browser. There’s no server involved: no account, no uploads, no tracking. Backups are files you keep.
      </p>
      <p className="settings-text">Works offline once loaded, and can be installed as an app from your browser’s menu.</p>
    </Section>
    <Section title="Learn more">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={onOpenHelp}>Open help</button>
        <button type="button" className="btn btn-ghost" onClick={onOpenShortcuts}>Keyboard shortcuts</button>
      </div>
    </Section>
  </>
)

// ── Dialog ─────────────────────────────────────────────────

export const SettingsDialog = ({ initialSection = 'Workspace', onClose, onOpenHelp, onOpenShortcuts }) => {
  const prefs = usePrefs()
  const [tab, setTab] = useState(SETTINGS_SECTIONS.includes(initialSection) ? initialSection : 'Workspace')
  const base = useId()

  const onTabKey = (e) => {
    const i = SETTINGS_SECTIONS.indexOf(tab)
    const next = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: SETTINGS_SECTIONS.length - 1 }[e.key]
    if (next == null) return
    e.preventDefault()
    const n = (next + SETTINGS_SECTIONS.length) % SETTINGS_SECTIONS.length
    setTab(SETTINGS_SECTIONS[n])
    e.currentTarget.parentElement.children[n]?.focus()
  }

  return (
    <Dialog title="Settings" onClose={onClose} size="lg" className="settings-dialog">
      <div className="settings-layout">
        <div className="settings-tabs" role="tablist" aria-orientation="vertical" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map(s => (
            <button
              key={s}
              type="button"
              role="tab"
              id={`${base}-tab-${s}`}
              aria-selected={tab === s}
              aria-controls={`${base}-panel`}
              tabIndex={tab === s ? 0 : -1}
              data-autofocus={tab === s ? true : undefined}
              onClick={() => setTab(s)}
              onKeyDown={onTabKey}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="settings-panel" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${tab}`} tabIndex={0}>
          {tab === 'Workspace' && <Workspace prefs={prefs} />}
          {tab === 'Appearance' && <Appearance prefs={prefs} />}
          {tab === 'Features' && <Features prefs={prefs} />}
          {tab === 'Storage' && <Storage onClose={onClose} />}
          {tab === 'About' && <About onOpenHelp={onOpenHelp} onOpenShortcuts={onOpenShortcuts} />}
        </div>
      </div>
    </Dialog>
  )
}
