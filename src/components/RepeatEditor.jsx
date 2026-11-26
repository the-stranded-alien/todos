// ── Repeat rule editor (task details) ──────────────────────
import { useId } from 'react'
import { describeRecurrence, nthOf, nextOccurrence } from '../utils/recurrence.js'
import { todayISO } from '../utils/dates.js'

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ORD = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', [-1]: 'last' }
const FREQS = [['none', 'Never'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']]
const UNIT = { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' }

export const RepeatEditor = ({ task, onChange, onSkip }) => {
  const id = useId()
  const rule = task.recurring
  const due = task.dueDate ?? todayISO()
  const set = (patch) => onChange({ from: 'due', count: 0, interval: 1, ...rule, ...patch })

  const setFreq = (freq) => {
    if (freq === 'none') { onChange(null); return }
    const base = { freq, interval: rule?.interval ?? 1, from: rule?.from ?? 'due', end: rule?.end ?? null, count: rule?.count ?? 0 }
    if (freq === 'weekly') base.weekdays = rule?.weekdays?.length ? rule.weekdays : [new Date(`${due}T12:00`).getDay()]
    if (freq === 'monthly') base.monthly = { mode: 'day', day: Number(due.slice(8)) }
    onChange(base)
  }

  const nth = nthOf(due)
  const next = rule ? nextOccurrence(rule, due, rule.anchor ?? due) : null

  return (
    <div>
      <h3 className="detail-label" id={`${id}-h`}>Repeat</h3>
      <div className="repeat-row">
        <label className="sr-only" htmlFor={`${id}-freq`}>Repeats</label>
        <select id={`${id}-freq`} className="input-base" style={{ width: 'auto' }} value={rule?.freq ?? 'none'} onChange={e => setFreq(e.target.value)}>
          {FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {rule && (
          <>
            <label htmlFor={`${id}-n`} className="repeat-text">every</label>
            <input id={`${id}-n`} type="number" min={1} max={99} className="input-base repeat-num" value={rule.interval ?? 1}
              onChange={e => set({ interval: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })} />
            <span className="repeat-text">{UNIT[rule.freq]}</span>
          </>
        )}
      </div>

      {rule?.freq === 'weekly' && (
        <div className="weekday-picker" role="group" aria-label="On these days">
          {DAYS.map((d, i) => {
            const on = rule.weekdays?.includes(i)
            return (
              <button key={i} type="button" aria-pressed={!!on} aria-label={DAY_NAMES[i]} data-tooltip={DAY_NAMES[i]}
                onClick={() => {
                  const next = on ? rule.weekdays.filter(x => x !== i) : [...(rule.weekdays ?? []), i].sort()
                  if (next.length) set({ weekdays: next })
                }}>
                {d}
              </button>
            )
          })}
        </div>
      )}

      {rule?.freq === 'monthly' && (
        <div className="segmented repeat-seg" role="radiogroup" aria-label="Which day of the month">
          <button type="button" role="radio" aria-checked={rule.monthly?.mode !== 'nth'} onClick={() => set({ monthly: { mode: 'day', day: Number(due.slice(8)) } })}>
            On day {Number(due.slice(8))}
          </button>
          <button type="button" role="radio" aria-checked={rule.monthly?.mode === 'nth' && rule.monthly.nth === nth.nth} onClick={() => set({ monthly: { mode: 'nth', nth: nth.nth, weekday: nth.weekday } })}>
            On the {ORD[nth.nth]} {DAY_NAMES[nth.weekday]}
          </button>
          {nth.isLast && nth.nth !== -1 && (
            <button type="button" role="radio" aria-checked={rule.monthly?.mode === 'nth' && rule.monthly.nth === -1} onClick={() => set({ monthly: { mode: 'nth', nth: -1, weekday: nth.weekday } })}>
              On the last {DAY_NAMES[nth.weekday]}
            </button>
          )}
        </div>
      )}

      {rule && (
        <>
          <div className="segmented repeat-seg" role="radiogroup" aria-label="Repeat from">
            <button type="button" role="radio" aria-checked={rule.from !== 'completion'} onClick={() => set({ from: 'due' })}>From the due date</button>
            <button type="button" role="radio" aria-checked={rule.from === 'completion'} onClick={() => set({ from: 'completion' })}>After completion</button>
          </div>
          <div className="repeat-row">
            <label htmlFor={`${id}-end`} className="repeat-text">Ends</label>
            <select id={`${id}-end`} className="input-base" style={{ width: 'auto' }}
              value={rule.end?.after ? 'after' : rule.end?.until ? 'until' : 'never'}
              onChange={e => set({ end: e.target.value === 'after' ? { after: 10 } : e.target.value === 'until' ? { until: due } : null })}>
              <option value="never">Never</option>
              <option value="after">After</option>
              <option value="until">On date</option>
            </select>
            {rule.end?.after != null && (
              <>
                <input type="number" min={1} max={999} className="input-base repeat-num" aria-label="Number of times" value={rule.end.after}
                  onChange={e => set({ end: { after: Math.max(1, Number(e.target.value) || 1) } })} />
                <span className="repeat-text">times{rule.count ? ` (${rule.count} so far)` : ''}</span>
              </>
            )}
            {rule.end?.until != null && (
              <input type="date" className="input-base" style={{ width: 'auto' }} aria-label="Last date" value={rule.end.until}
                onChange={e => set({ end: e.target.value ? { until: e.target.value } : null })} />
            )}
          </div>
          <p className="repeat-summary" aria-live="polite">
            {describeRecurrence(rule, due)}. {next ? `Next: ${new Date(`${next}T12:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}.` : 'This is the last one.'}
          </p>
          {next && !task.completed && (
            <button type="button" className="btn btn-ghost repeat-skip" onClick={onSkip}>Skip this one</button>
          )}
        </>
      )}
    </div>
  )
}
