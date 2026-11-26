import { describe, it, expect } from 'vitest'
import { nextPhase, formatClock, addSession, sessionsSince } from './pomodoro.js'

describe('pomodoro', () => {
  it('work → short break, every 4th → long break, break → work', () => {
    expect(nextPhase('work', 1)).toEqual({ phase: 'short', minutes: 5 })
    expect(nextPhase('work', 4)).toEqual({ phase: 'long', minutes: 15 })
    expect(nextPhase('short', 1)).toEqual({ phase: 'work', minutes: 25 })
    expect(nextPhase('work', 3, { work: 50, short: 10, long: 30, longEvery: 3 })).toEqual({ phase: 'long', minutes: 30 })
  })
  it('formats the clock, rounding up partial seconds', () => {
    expect(formatClock(25 * 60000)).toBe('25:00')
    expect(formatClock(61001)).toBe('01:02')
    expect(formatClock(-5)).toBe('00:00')
  })
  it('records and counts sessions', () => {
    const s = addSession(addSession([], 1000, 25), 5000, 25)
    expect(s).toHaveLength(2)
    expect(addSession(Array(200).fill({ at: 1, minutes: 1 }), 2, 25)).toHaveLength(200)
    expect(sessionsSince([{ pomodoros: s }, { pomodoros: [{ at: 9000, minutes: 50 }] }, {}], 4000)).toEqual({ count: 2, minutes: 75 })
  })
})
