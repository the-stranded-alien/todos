import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseTaskInput } from './nlpParse.js'

describe('parseTaskInput', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 26, 10, 0)) })
  afterEach(() => vi.useRealTimers())

  it('extracts tags, project, priority, date and time', () => {
    const p = parseTaskInput('Call mom tomorrow 5:30pm #family @home p1')
    expect(p).toEqual({
      title: 'Call mom',
      tags: ['family'],
      projectName: 'home',
      priority: 1,
      dueDate: '2026-11-27',
      dueTime: '17:30',
    })
  })

  it('handles relative dates', () => {
    expect(parseTaskInput('Renew passport in 2 weeks').dueDate).toBe('2026-12-10')
  })

  it('leaves plain titles alone', () => {
    expect(parseTaskInput('Buy milk')).toMatchObject({ title: 'Buy milk', tags: [], priority: 0, dueDate: null })
  })
})
