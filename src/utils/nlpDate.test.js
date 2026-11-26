import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseNLDate } from './nlpDate.js'

describe('parseNLDate', () => {
  // Thursday 26 Nov 2026, 10:00 local
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 26, 10, 0)) })
  afterEach(() => vi.useRealTimers())

  it.each([
    ['today', '2026-11-26'],
    ['tomorrow', '2026-11-27'],
    ['yesterday', '2026-11-25'],
    ['friday', '2026-11-27'],
    ['thursday', '2026-12-03'],
    ['next monday', '2026-11-30'],
    ['in 3 days', '2026-11-29'],
    ['in 2 weeks', '2026-12-10'],
    ['in 1 month', '2026-12-26'],
    ['eom', '2026-11-30'],
    ['december 25', '2026-12-25'],
    ['january 2', '2027-01-02'],
    ['2026-12-01', '2026-12-01'],
    ['12/31', '2026-12-31'],
  ])('%s → %s', (input, expected) => {
    expect(parseNLDate(input)).toBe(expected)
  })

  it('returns null for unknown text', () => {
    expect(parseNLDate('someday')).toBeNull()
  })
})
