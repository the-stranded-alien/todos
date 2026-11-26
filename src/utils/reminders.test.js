import { describe, it, expect } from 'vitest'
import { reminderTime, nextReminder, missedReminders, describeReminder } from './reminders.js'
import { buildCalendar, rrule, escapeText, fold } from './ics.js'

const at = (y, m, d, h, mi) => new Date(y, m - 1, d, h, mi).getTime()

describe('reminders', () => {
  it('computes offset and fixed reminder times; all-day tasks use 9am', () => {
    expect(reminderTime({ dueDate: '2026-11-27', dueTime: '14:00', reminder: { mode: 'offset', minutes: 10 } })).toBe(at(2026, 11, 27, 13, 50))
    expect(reminderTime({ dueDate: '2026-11-27', reminder: { mode: 'offset', minutes: 1440 } })).toBe(at(2026, 11, 26, 9, 0))
    expect(reminderTime({ reminder: { mode: 'at', at: '2026-11-30T08:15' } })).toBe(at(2026, 11, 30, 8, 15))
    expect(reminderTime({ reminder: { mode: 'offset', minutes: 0 } })).toBeNull()
    expect(reminderTime({ dueDate: '2026-11-27', completed: true, reminder: { mode: 'offset', minutes: 0 } })).toBeNull()
  })
  it('finds the next one and skips already-fired reminders', () => {
    const now = at(2026, 11, 26, 10, 0)
    const a = { id: 'a', dueDate: '2026-11-26', dueTime: '12:00', reminder: { mode: 'offset', minutes: 0 } }
    const b = { id: 'b', dueDate: '2026-11-26', dueTime: '11:00', reminder: { mode: 'offset', minutes: 0 } }
    expect(nextReminder([a, b], now).task.id).toBe('b')
    expect(nextReminder([a, { ...b, reminderDone: at(2026, 11, 26, 11, 0) }], now).task.id).toBe('a')
  })
  it('a snooze replaces the reminder until it fires', () => {
    const now = at(2026, 11, 26, 10, 0)
    const t = { id: 's', dueDate: '2026-11-26', dueTime: '09:00', reminder: { mode: 'offset', minutes: 0 }, reminderDone: at(2026, 11, 26, 9, 0), snoozeUntil: at(2026, 11, 26, 10, 10) }
    expect(nextReminder([t], now).at).toBe(at(2026, 11, 26, 10, 10))
    expect(nextReminder([{ ...t, snoozeUntil: null }], now)).toBeNull()
  })
  it('lists reminders missed while closed (last 24h only)', () => {
    const now = at(2026, 11, 26, 10, 0)
    const recent = { id: 'r', dueDate: '2026-11-26', dueTime: '08:00', reminder: { mode: 'offset', minutes: 0 } }
    const old = { id: 'o', dueDate: '2026-11-20', dueTime: '08:00', reminder: { mode: 'offset', minutes: 0 } }
    expect(missedReminders([recent, old], now).map(x => x.task.id)).toEqual(['r'])
  })
  it('describes reminders', () => {
    expect(describeReminder({ dueDate: '2026-11-27', reminder: { mode: 'offset', minutes: 60 } })).toBe('1 hour before')
    expect(describeReminder({ reminder: { mode: 'offset', minutes: 10 } })).toMatch(/Set a due date/)
  })
})

describe('ics', () => {
  it('escapes and folds per RFC 5545', () => {
    expect(escapeText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne')
    const long = 'SUMMARY:' + 'x'.repeat(200)
    expect(fold(long).split('\r\n ').every(l => new TextEncoder().encode(l).length <= 75)).toBe(true)
    expect(fold(long).replace(/\r\n /g, '')).toBe(long)
  })
  it('converts repeat rules', () => {
    expect(rrule({ freq: 'weekly', interval: 2, weekdays: [5, 1] })).toBe('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR')
    expect(rrule({ freq: 'monthly', interval: 1, monthly: { mode: 'nth', nth: -1, weekday: 5 } })).toBe('RRULE:FREQ=MONTHLY;BYDAY=-1FR')
    expect(rrule({ freq: 'monthly', interval: 1, monthly: { mode: 'nth', nth: -1, weekday: 'weekday' } })).toBe('RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1')
    expect(rrule({ freq: 'daily', interval: 1, end: { after: 5 }, count: 2 })).toBe('RRULE:FREQ=DAILY;COUNT=3')
    expect(rrule({ freq: 'yearly', interval: 1, end: { until: '2027-01-31' } })).toBe('RRULE:FREQ=YEARLY;UNTIL=20270131')
  })
  it('builds a calendar with timed, all-day, repeating and alarmed events', () => {
    const ics = buildCalendar([
      { id: 't1', title: 'Call, the bank', dueDate: '2026-11-27', dueTime: '16:30', reminder: { mode: 'offset', minutes: 10 } },
      { id: 't2', title: 'Bins', dueDate: '2026-11-30', recurring: { freq: 'weekly', interval: 1, weekdays: [1] } },
      { id: 't3', title: 'No date' },
      { id: 't4', title: 'Done', dueDate: '2026-11-27', completed: true },
    ], { now: Date.UTC(2026, 10, 26, 9, 0, 0) })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('SUMMARY:Call\\, the bank')
    expect(ics).toContain('DTSTART:20261127T163000')
    expect(ics).toContain('TRIGGER:-PT10M')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261130\r\nDTEND;VALUE=DATE:20261201')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO')
    expect(ics).toContain('DTSTAMP:20261126T090000Z')
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
  })
})
