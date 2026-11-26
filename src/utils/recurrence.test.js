import { describe, it, expect } from 'vitest'
import { nextOccurrence, firstOccurrence, describeRecurrence, parseRecurrence, nthWeekdayOfMonth, nthOf } from './recurrence.js'
import { toLocalISO } from './dates.js'

describe('nextOccurrence', () => {
  it('keeps old { freq, interval } rules working', () => {
    expect(nextOccurrence({ freq: 'daily', interval: 1 }, '2026-11-26')).toBe('2026-11-27')
    expect(nextOccurrence({ freq: 'weekly', interval: 1 }, '2026-11-26')).toBe('2026-12-03')
    expect(nextOccurrence({ freq: 'monthly', interval: 1 }, '2026-11-26')).toBe('2026-12-26')
  })
  it('every N days / years', () => {
    expect(nextOccurrence({ freq: 'daily', interval: 3 }, '2026-12-30')).toBe('2027-01-02')
    expect(nextOccurrence({ freq: 'yearly', interval: 1 }, '2028-02-29')).toBe('2029-02-28')
  })
  it('monthly on a day clamps to short months and keeps the original day', () => {
    expect(nextOccurrence({ freq: 'monthly', interval: 1, monthly: { mode: 'day', day: 31 } }, '2027-01-31')).toBe('2027-02-28')
    expect(nextOccurrence({ freq: 'monthly', interval: 1, monthly: { mode: 'day', day: 31 } }, '2027-02-28')).toBe('2027-03-31')
    expect(nextOccurrence({ freq: 'monthly', interval: 1, monthly: { mode: 'day', day: 29 } }, '2028-01-29')).toBe('2028-02-29')
  })
  it('weekdays and every-2-weeks stay in step', () => {
    const wd = { freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] }
    expect(nextOccurrence(wd, '2026-11-27')).toBe('2026-11-30') // Fri → Mon
    const biweekly = { freq: 'weekly', interval: 2, weekdays: [1, 5] }
    expect(nextOccurrence(biweekly, '2026-11-23', '2026-11-23')).toBe('2026-11-27') // Mon → Fri same week
    expect(nextOccurrence(biweekly, '2026-11-27', '2026-11-23')).toBe('2026-12-07') // Fri → Mon two weeks on
  })
  it('nth weekday of the month: 2nd Tuesday, last Friday, last weekday', () => {
    expect(nextOccurrence({ freq: 'monthly', interval: 1, monthly: { mode: 'nth', nth: 2, weekday: 2 } }, '2026-11-10')).toBe('2026-12-08')
    expect(nextOccurrence({ freq: 'monthly', interval: 1, monthly: { mode: 'nth', nth: -1, weekday: 5 } }, '2026-11-27')).toBe('2026-12-25')
    expect(nextOccurrence({ freq: 'monthly', interval: 1, monthly: { mode: 'nth', nth: -1, weekday: 'weekday' } }, '2026-11-30')).toBe('2026-12-31')
    expect(nextOccurrence({ freq: 'monthly', interval: 1, monthly: { mode: 'nth', nth: 2, weekday: 2 } }, '2026-11-01')).toBe('2026-11-10')
  })
  it('ends after N times or on a date', () => {
    expect(nextOccurrence({ freq: 'daily', interval: 1, end: { after: 3 }, count: 1 }, '2026-11-26')).toBe('2026-11-27')
    expect(nextOccurrence({ freq: 'daily', interval: 1, end: { after: 3 }, count: 2 }, '2026-11-26')).toBeNull()
    expect(nextOccurrence({ freq: 'weekly', interval: 1, end: { until: '2026-12-01' } }, '2026-11-26')).toBeNull()
  })
  it('is not shifted by daylight saving (US/EU change weeks)', () => {
    let d = '2027-03-10'
    const seen = []
    for (let i = 0; i < 40; i++) { d = nextOccurrence({ freq: 'daily', interval: 1 }, d); seen.push(d) }
    expect(new Set(seen).size).toBe(40)
    expect(seen[19]).toBe('2027-03-30')
  })
})

describe('helpers', () => {
  it('nthWeekdayOfMonth / nthOf', () => {
    expect(toLocalISO(nthWeekdayOfMonth(2026, 10, 4, 4))).toBe('2026-11-26') // 4th Thursday = Thanksgiving
    expect(nthOf('2026-11-26')).toEqual({ nth: 4, weekday: 4, isLast: true })
    expect(nthOf('2026-10-30').nth).toBe(-1) // 5th Friday → last
  })
  it('firstOccurrence picks the next matching day including today', () => {
    expect(firstOccurrence({ freq: 'weekly', weekdays: [4] }, '2026-11-26')).toBe('2026-11-26')
    expect(firstOccurrence({ freq: 'weekly', weekdays: [5] }, '2026-11-26')).toBe('2026-11-27')
    expect(firstOccurrence({ freq: 'monthly', monthly: { mode: 'day', day: 15 } }, '2026-11-26')).toBe('2026-12-15')
    expect(firstOccurrence({ freq: 'daily' }, '2026-11-26')).toBe('2026-11-26')
  })
  it('describes rules in plain words', () => {
    expect(describeRecurrence({ freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] })).toBe('Every weekday')
    expect(describeRecurrence({ freq: 'weekly', interval: 2, weekdays: [1, 5] })).toBe('Every 2 weeks on Mon, Fri')
    expect(describeRecurrence({ freq: 'monthly', interval: 1, monthly: { mode: 'nth', nth: 2, weekday: 2 } })).toBe('Monthly on the 2nd Tuesday')
    expect(describeRecurrence({ freq: 'monthly', interval: 1 }, '2026-11-22')).toBe('Monthly on the 22nd')
    expect(describeRecurrence({ freq: 'daily', interval: 3, from: 'completion', end: { after: 5 } })).toBe('Every 3 days after completion, 5 times')
  })
})

describe('parseRecurrence', () => {
  it.each([
    ['standup every weekday', { freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] }, 'every weekday'],
    ['gym every 2 weeks on fri', { freq: 'weekly', interval: 2, weekdays: [5] }, 'every 2 weeks on fri'],
    ['call mum weekly on mon and thu', { freq: 'weekly', interval: 1, weekdays: [1, 4] }, 'weekly on mon and thu'],
    ['pay rent monthly on the 15th', { freq: 'monthly', interval: 1, monthly: { mode: 'day', day: 15 } }, 'monthly on the 15th'],
    ['review every month on the last friday', { freq: 'monthly', interval: 1, monthly: { mode: 'nth', nth: -1, weekday: 5 } }, 'every month on the last friday'],
    ['water plants every 3 days', { freq: 'daily', interval: 3 }, 'every 3 days'],
    ['renew yearly', { freq: 'yearly', interval: 1 }, 'yearly'],
    ['bins every tuesday', { freq: 'weekly', interval: 1, weekdays: [2] }, 'every tuesday'],
  ])('%s', (text, rule, match) => {
    const r = parseRecurrence(text)
    expect(r.rule).toEqual(rule)
    expect(r.match[0]).toBe(match)
  })
  it('after completion', () => {
    expect(parseRecurrence('clean filter every 3 days after done').rule).toEqual({ freq: 'daily', interval: 3, from: 'completion' })
  })
  it('no match', () => { expect(parseRecurrence('buy milk')).toBeNull() })
})
