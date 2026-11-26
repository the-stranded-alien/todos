// ── Calendar view ──────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from '../icons.jsx'
import { useStore } from '../store/context.js'
import { todayISO } from '../utils/dates.js'
import { IconButton } from './ui/IconButton.jsx'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export const CalendarView = () => {
  const { state, dispatch } = useStore()
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = todayISO()

  // Count tasks per day
  const tasksByDay = useMemo(() => {
    const map = {}
    for (const t of state.tasks) {
      if (t.dueDate) {
        const [y, m, d] = t.dueDate.split('-').map(Number)
        if (y === year && m === month + 1) {
          if (!map[d]) map[d] = { total: 0, completed: 0, tasks: [] }
          map[d].total++
          if (t.completed) map[d].completed++
          map[d].tasks.push(t)
        }
      }
    }
    return map
  }, [state.tasks, year, month])

  const selectedTasks = useMemo(() => {
    if (!selectedDay) return []
    return tasksByDay[selectedDay]?.tasks || []
  }, [selectedDay, tasksByDay])

  const prevMonth = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)), [])
  const nextMonth = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)), [])

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const rows = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '1.2rem' }}>
          {MONTHS[month]} {year}
        </h2>
        <div className="flex gap-1">
          <IconButton label="Previous month" icon={ChevronLeft} onClick={prevMonth} />
          <button className="btn btn-ghost p-2" onClick={() => setViewDate(new Date())} style={{ fontSize: '.8rem' }}>Today</button>
          <IconButton label="Next month" icon={ChevronRight} onClick={nextMonth} tooltipAlign="end" />
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {/* Weekday headers */}
        <div className="grid grid-cols-7" style={{ background: 'var(--bg-surface)' }}>
          {DAYS_OF_WEEK.map(d => (
            <div key={d} style={{ textAlign: 'center', padding: '8px 4px', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-4)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day rows */}
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7" style={{ borderTop: '1px solid var(--border)' }}>
            {row.map((day, di) => {
              if (!day) return <div key={di} style={{ background: 'var(--bg-surface)', minHeight: 72, borderRight: di < 6 ? '1px solid var(--border-light)' : 'none' }} />
              const isoDate = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const isToday = isoDate === today
              const isSelected = selectedDay === day
              const dayData = tasksByDay[day]

              return (
                <div
                  key={di}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  style={{
                    minHeight: 72,
                    padding: '6px',
                    cursor: dayData ? 'pointer' : 'default',
                    background: isSelected ? 'var(--accent-soft)' : 'var(--bg-card)',
                    borderRight: di < 6 ? '1px solid var(--border-light)' : 'none',
                    transition: 'background .1s',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span style={{
                      fontSize: '.8rem',
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? 'var(--on-accent)' : isSelected ? 'var(--accent)' : 'var(--text-2)',
                      background: isToday ? 'var(--accent)' : 'transparent',
                      borderRadius: '50%',
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {day}
                    </span>
                  </div>
                  {dayData && (
                    <div>
                      {dayData.tasks.slice(0, 3).map(t => (
                        <div
                          key={t.id}
                          onClick={e => { e.stopPropagation(); dispatch({ type: 'SELECT_TASK', id: t.id }) }}
                          style={{
                            fontSize: '.65rem',
                            color: t.completed ? 'var(--text-4)' : 'var(--text-2)',
                            textDecoration: t.completed ? 'line-through' : 'none',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            padding: '1px 2px',
                            borderRadius: 3,
                            marginBottom: 1,
                            background: t.completed ? 'transparent' : 'var(--accent-soft)',
                            cursor: 'pointer',
                          }}
                          title={t.title}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dayData.tasks.length > 3 && (
                        <div style={{ fontSize: '.6rem', color: 'var(--text-4)' }}>+{dayData.tasks.length - 3} more</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Selected day tasks */}
      {selectedDay && selectedTasks.length > 0 && (
        <div className="mt-4 anim-slide-up">
          <h3 style={{ color: 'var(--text-2)', fontWeight: 600, marginBottom: 8, fontSize: '.9rem' }}>
            {MONTHS[month]} {selectedDay}
          </h3>
          {selectedTasks.map(t => (
            <div
              key={t.id}
              onClick={() => dispatch({ type: 'SELECT_TASK', id: t.id })}
              className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1 cursor-pointer"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className={`custom-checkbox ${t.completed ? 'checked' : ''}`} style={{ width: 15, height: 15, pointerEvents: 'none' }}>
                {t.completed && <svg width="8" height="6" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 4l3 3 5-6"/></svg>}
              </div>
              <span style={{ color: t.completed ? 'var(--text-4)' : 'var(--text-1)', fontSize: '.875rem', textDecoration: t.completed ? 'line-through' : 'none' }}>
                {t.title}
              </span>
              {t.dueTime && <span style={{ color: 'var(--text-4)', fontSize: '.75rem', marginLeft: 'auto' }}>{t.dueTime}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
