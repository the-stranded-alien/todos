// ── Reminder picker (task details) ─────────────────────────
import { useId } from 'react'
import { REMINDER_PRESETS, describeReminder, reminderTime } from '../utils/reminders.js'
import { exportCalendar } from '../utils/calendarExport.js'
import { usePrefs } from '../prefs.js'
import { Calendar } from '../icons.jsx'

const toLocalInput = (ms) => {
  const d = new Date(ms), p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export const ReminderField = ({ task, onChange }) => {
  const id = useId()
  const prefs = usePrefs()
  const r = task.reminder
  const value = !r ? 'none' : r.mode === 'at' ? 'at' : String(r.minutes)
  const systemOn = prefs.reminders && typeof Notification !== 'undefined' && Notification.permission === 'granted'
  const at = reminderTime(task)

  const pick = (v) => {
    if (v === 'none') onChange(null)
    else if (v === 'at') onChange({ mode: 'at', at: toLocalInput(at ?? Date.now() + 3600000) })
    else onChange({ mode: 'offset', minutes: Number(v) })
  }

  return (
    <div>
      <h3 className="detail-label" id={`${id}-h`}>Reminder</h3>
      <div className="repeat-row">
        <select aria-labelledby={`${id}-h`} className="input-base" style={{ width: 'auto' }} value={value} onChange={e => pick(e.target.value)}>
          {REMINDER_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {r?.mode === 'at' && (
          <input type="datetime-local" className="input-base" style={{ width: 'auto' }} aria-label="Remind me at" value={r.at}
            onChange={e => e.target.value && onChange({ mode: 'at', at: e.target.value })} />
        )}
      </div>
      {r && (
        <p className="repeat-summary">
          {r.mode === 'offset' && !task.dueDate ? describeReminder(task) : at ? `Reminds you ${new Date(at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.` : ''}
          {' '}{systemOn ? 'You’ll get a notification while Todos is open.' : 'It shows inside Todos while it’s open. Turn on notifications in Settings → Features to see it outside the app.'}
        </p>
      )}
      {task.dueDate && (
        <>
          <button type="button" className="btn btn-ghost repeat-skip" onClick={() => exportCalendar([task], `${(task.title || 'task').replace(/[^\w-]+/g, '-').slice(0, 40)}.ics`)}>
            <Calendar size={13} /> Add to calendar
          </button>
          <p className="switch-desc" style={{ marginTop: 2 }}>For an alarm even when Todos is closed, add it to your calendar.</p>
        </>
      )}
    </div>
  )
}
