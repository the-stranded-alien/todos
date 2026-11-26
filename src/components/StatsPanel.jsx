// ── Statistics panel ───────────────────────────────────────
import { useMemo, useState } from 'react'
import { useStore } from '../store/context.js'

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export const StatsPanel = () => {
  const { state } = useStore()
  const { tasks } = state

  const [now] = useState(() => Date.now())

  const stats = useMemo(() => {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const completedThisWeek = tasks.filter(t => t.completedAt && t.completedAt >= weekStart.getTime())
    const completedByDay = Array(7).fill(0)

    for (const t of completedThisWeek) {
      const d = new Date(t.completedAt).getDay()
      completedByDay[d]++
    }

    const totalTasks = tasks.filter(t => !t.parentId).length
    const completedTotal = tasks.filter(t => t.completed && !t.parentId).length
    const completionRate = totalTasks > 0 ? completedTotal / totalTasks : 0

    // Streak
    let streak = 0
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dEnd = new Date(d)
      dEnd.setDate(dEnd.getDate() + 1)
      const hadCompletion = tasks.some(t => t.completedAt && t.completedAt >= d.getTime() && t.completedAt < dEnd.getTime())
      if (hadCompletion) streak++
      else if (i > 0) break
    }

    // Time tracked this week
    const timeThisWeek = tasks
      .filter(t => t.completedAt && t.completedAt >= weekStart.getTime())
      .reduce((sum, t) => sum + (t.timeTracked || 0), 0)

    // Most productive day
    const maxIdx = completedByDay.indexOf(Math.max(...completedByDay))

    const maxCount = Math.max(...completedByDay, 1)

    return { completedByDay, completionRate, streak, timeThisWeek, maxDay: DAY_NAMES[maxIdx], maxCount, completedThisWeek: completedThisWeek.length }
  }, [tasks, now])

  const formatTime = (ms) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  // Radial progress ring
  const radius = 36
  const circ = 2 * Math.PI * radius
  const dashoffset = circ * (1 - stats.completionRate)

  return (
    <div className="flex-1 overflow-auto stats-view" role="region" aria-labelledby="stats-title" tabIndex={0}>
      <h1 id="stats-title" style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '1.3rem', marginBottom: 24 }}>Statistics</h1>

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {/* Completion rate */}
        <div className="rounded-2xl p-4 flex flex-col items-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <svg width="100" height="100" viewBox="0 0 100 100" role="img" aria-label={`${Math.round(stats.completionRate * 100)}% of tasks completed`}>
            <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="8"
              strokeDasharray={circ}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset .6s ease' }}
            />
            <text x="50" y="55" textAnchor="middle" aria-hidden="true" style={{ fill: 'var(--text-1)', fontSize: '1rem', fontWeight: 700 }}>
              {Math.round(stats.completionRate * 100)}%
            </text>
          </svg>
          <span style={{ color: 'var(--text-3)', fontSize: '.8rem', marginTop: 8 }}>Completion rate</span>
        </div>

        {/* Streak */}
        <div className="rounded-2xl p-4 flex flex-col items-center justify-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div aria-hidden="true" style={{ fontSize: '2.5rem' }}>🔥</div>
          <div style={{ color: 'var(--text-1)', fontSize: '1.75rem', fontWeight: 700 }}>{stats.streak}</div>
          <span style={{ color: 'var(--text-3)', fontSize: '.8rem' }}>Day streak</span>
        </div>

        {/* This week */}
        <div className="rounded-2xl p-4 flex flex-col items-center justify-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ color: 'var(--accent)', fontSize: '2rem', fontWeight: 700 }}>{stats.completedThisWeek}</div>
          <span style={{ color: 'var(--text-3)', fontSize: '.8rem' }}>Completed this week</span>
        </div>

        {/* Time tracked */}
        <div className="rounded-2xl p-4 flex flex-col items-center justify-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ color: 'var(--text-1)', fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatTime(stats.timeThisWeek)}</div>
          <span style={{ color: 'var(--text-3)', fontSize: '.8rem' }}>Time tracked this week</span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <h2 id="week-chart" style={{ color: 'var(--text-2)', fontWeight: 600, fontSize: '.9rem', marginBottom: 16 }}>Completions this week</h2>
        <div
          className="flex items-end justify-between gap-2"
          style={{ height: 80 }}
          role="img"
          aria-labelledby="week-chart"
          aria-describedby="week-chart-desc"
        >
          {stats.completedByDay.map((count, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <span style={{ color: 'var(--text-3)', fontSize: '.65rem' }}>{count > 0 ? count : ''}</span>
              <div
                className="w-full rounded-t-md chart-bar"
                style={{
                  height: count > 0 ? `${Math.round((count / stats.maxCount) * 60)}px` : '4px',
                  background: count > 0 ? 'var(--accent)' : 'var(--border)',
                  opacity: count > 0 ? 1 : 0.4,
                  minHeight: 4,
                }}
              />
              <span style={{ color: 'var(--text-3)', fontSize: '.65rem' }}>{DAY_NAMES[i]}</span>
            </div>
          ))}
        </div>
        <p id="week-chart-desc" className="sr-only">
          {stats.completedByDay.map((c, i) => `${DAY_NAMES[i]}: ${c}`).join(', ')}
        </p>
        <p style={{ color: 'var(--text-3)', fontSize: '.75rem', marginTop: 12 }}>
          {stats.completedThisWeek > 0
            ? <>Most productive day: <strong style={{ color: 'var(--text-2)' }}>{stats.maxDay}</strong></>
            : 'Complete a task to start your weekly chart.'}
        </p>
      </div>
    </div>
  )
}
