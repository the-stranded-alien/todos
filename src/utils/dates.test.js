import { describe, it, expect } from 'vitest'
import { toLocalISO, todayISO, addDaysISO, parseLocalISO } from './dates.js'

describe('dates', () => {
  it('formats local calendar date, not UTC', () => {
    // 00:30 local on 1 Jan is still 1 Jan locally whatever the offset
    expect(toLocalISO(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01')
    expect(todayISO(new Date(2026, 10, 26, 23, 59))).toBe('2026-11-26')
  })
  it('adds days across month ends', () => {
    expect(addDaysISO(1, new Date(2026, 0, 31))).toBe('2026-02-01')
    expect(addDaysISO(7, new Date(2026, 11, 28))).toBe('2027-01-04')
  })
  it('parses ISO strings as local dates', () => {
    const d = parseLocalISO('2026-03-05')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 5, 0])
  })
})
