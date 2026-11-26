// ── Calendar view ──────────────────────────────────────────
// A real table: weekday column headers, one button per day (arrow keys
// move between days), and task buttons that open the detail panel.
import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from '../icons.jsx'
import { useStore } from '../store/context.js'
import { todayISO } from '../utils/dates.js'
import { focusTaskDetail } from '../utils/focus.js'
import { IconButton } from './ui/IconButton.jsx'
import { usePrefs } from '../prefs.js'
import { EmptyState } from './ui/EmptyState.jsx'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export const CalendarView = () => {
  const { state, dispatch } = useStore()
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const { weekStart } = usePrefs()
  const firstDay = new Date(year, month, 1).getDay()
  const lead = (firstDay - weekStart + 7) % 7 // empty cells before day 1
  const weekdays = [...Array(7)].map((_, i) => (i + weekStart) % 7)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = todayISO()

  const tasksByDay = useMemo(() => {
    const map = {}
    for (const t of state.tasks) {
      if (!t.dueDate) continue
      const [y, m, d] = t.dueDate.split('-').map(Number)
      if (y === year && m === month + 1) (map[d] ??= []).push(t)
    }
    return map
  }, [state.tasks, year, month])

  const selectedTasks = selectedDay ? tasksByDay[selectedDay] ?? [] : []

  const goMonth = useCallback((delta) => {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))
    setSelectedDay(null)
  }, [])

  const openTask = (id, viaKeyboard) => {
    dispatch({ type: 'SELECT_TASK', id })
    if (viaKeyboard) focusTaskDetail()
  }

  const onDayKeyDown = (e, day) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (!step) return
    const next = day + step
    if (next < 1 || next > daysInMonth) return
    e.preventDefault()
    e.currentTarget.closest('table').querySelector(`[data-day="${next}"]`)?.focus()
  }

  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const rows = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  return (
    <div className="flex-1 overflow-auto p-4 cal-view" role="region" aria-labelledby="cal-title" tabIndex={-1}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 id="cal-title" style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '1.3rem' }}>
          {MONTHS[month]} {year}
        </h1>
        <div className="flex items-center gap-1">
          <IconButton label="Previous month" icon={ChevronLeft} onClick={() => goMonth(-1)} />
          <button type="button" className="btn btn-ghost" style={{ fontSize: '.8rem' }} onClick={() => { setViewDate(new Date()); setSelectedDay(null) }}>Today</button>
          <IconButton label="Next month" icon={ChevronRight} onClick={() => goMonth(1)} tooltipAlign="end" />
        </div>
      </div>

      <table className="cal" aria-labelledby="cal-title">
        <thead>
          <tr>
            {weekdays.map(i => <th key={i} scope="col" abbr={DAY_NAMES[i]}>{DAYS_OF_WEEK[i]}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((day, di) => {
                if (!day) return <td key={di} className="cal-empty" />
                const date = iso(year, month, day)
                const isToday = date === today
                const isSelected = selectedDay === day
                const list = tasksByDay[day] ?? []
                const open = list.filter(t => !t.completed).length
                return (
                  <td key={di} data-selected={isSelected || undefined}>
                    <button
                      type="button"
                      className="cal-day"
                      data-day={day}
                      data-today={isToday || undefined}
                      aria-pressed={isSelected}
                      aria-current={isToday ? 'date' : undefined}
                      tabIndex={isSelected || (!selectedDay && (isToday || (day === 1 && !date.startsWith(today.slice(0, 7))))) ? 0 : -1}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      onKeyDown={e => onDayKeyDown(e, day)}
                    >
                      <span className="cal-num">{day}</span>
                      <span className="sr-only">{`, ${DAY_NAMES[(firstDay + day - 1) % 7]} ${MONTHS[month]}${list.length ? `, ${list.length} ${list.length === 1 ? 'task' : 'tasks'}` : ''}`}</span>
                      {open > 0 && <span className="cal-dot" aria-hidden="true">{open}</span>}
                    </button>
                    {list.length > 0 && (
                      <ul className="cal-tasks">
                        {list.slice(0, 3).map(t => (
                          <li key={t.id}>
                            <button
                              type="button"
                              className="cal-task"
                              data-done={t.completed || undefined}
                              title={t.title}
                              tabIndex={-1}
                              onClick={() => openTask(t.id)}
                            >
                              {t.title}
                            </button>
                          </li>
                        ))}
                        {list.length > 3 && (
                          <li className="cal-more">+{list.length - 3} more</li>
                        )}
                      </ul>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {selectedDay && (
        <section className="mt-4 anim-slide-up" aria-labelledby="cal-day-title">
          <h2 id="cal-day-title" style={{ color: 'var(--text-2)', fontWeight: 600, marginBottom: 8, fontSize: '.95rem' }}>
            {DAY_NAMES[(firstDay + selectedDay - 1) % 7]}, {MONTHS[month]} {selectedDay}
          </h2>
          {selectedTasks.length === 0 ? (
            <EmptyState icon={Calendar} title="Nothing due this day." compact>Set a due date on a task to see it here.</EmptyState>
          ) : (
            <ul className="task-ul">
              {selectedTasks.map(t => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={e => openTask(t.id, e.detail === 0)}
                    className="cal-list-item"
                    data-done={t.completed || undefined}
                  >
                    <span className={`custom-checkbox ${t.completed ? 'checked' : ''}`} aria-hidden="true" style={{ width: 15, height: 15 }}>
                      {t.completed && <svg width="8" height="6" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 4l3 3 5-6" /></svg>}
                    </span>
                    <span className="flex-1 truncate">{t.title}</span>
                    {t.completed && <span className="sr-only">(completed)</span>}
                    {t.dueTime && <span style={{ color: 'var(--text-3)', fontSize: '.75rem' }}>{t.dueTime}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
