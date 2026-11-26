import { describe, it, expect } from 'vitest'
import { matchesRules, rulesFromFilters, describeRules, EMPTY_RULES } from './smartLists.js'

const now = new Date(2026, 10, 26, 10)
const t = (o) => ({ id: 'x', title: 'Task', notes: '', completed: false, priority: 0, tags: [], projectId: null, dueDate: null, ...o })

describe('matchesRules', () => {
  it('default rules: open tasks only', () => {
    expect(matchesRules(t(), EMPTY_RULES, now)).toBe(true)
    expect(matchesRules(t({ completed: true }), EMPTY_RULES, now)).toBe(false)
    expect(matchesRules(t({ completed: true }), { includeCompleted: true }, now)).toBe(true)
  })
  it('text matches name or notes', () => {
    expect(matchesRules(t({ notes: 'Bring the Projector' }), { text: 'projector' }, now)).toBe(true)
    expect(matchesRules(t(), { text: 'projector' }, now)).toBe(false)
  })
  it('projects, with Inbox as no project', () => {
    expect(matchesRules(t({ projectId: 'p1' }), { projectIds: ['p1'] }, now)).toBe(true)
    expect(matchesRules(t(), { projectIds: ['inbox'] }, now)).toBe(true)
    expect(matchesRules(t({ projectId: 'p2' }), { projectIds: ['p1', 'inbox'] }, now)).toBe(false)
  })
  it('tags any / all', () => {
    const task = t({ tags: ['a', 'b'] })
    expect(matchesRules(task, { tagIds: ['a', 'z'], tagMode: 'any' }, now)).toBe(true)
    expect(matchesRules(task, { tagIds: ['a', 'z'], tagMode: 'all' }, now)).toBe(false)
    expect(matchesRules(task, { tagIds: ['a', 'b'], tagMode: 'all' }, now)).toBe(true)
  })
  it('priority and due windows', () => {
    expect(matchesRules(t({ priority: 3 }), { priorities: [2, 3] }, now)).toBe(true)
    expect(matchesRules(t({ dueDate: '2026-11-25' }), { due: 'overdue' }, now)).toBe(true)
    expect(matchesRules(t({ dueDate: '2026-11-26' }), { due: 'overdue' }, now)).toBe(false)
    expect(matchesRules(t({ dueDate: '2026-11-26' }), { due: 'today' }, now)).toBe(true)
    expect(matchesRules(t({ dueDate: '2026-12-03' }), { due: 'week' }, now)).toBe(true)
    expect(matchesRules(t({ dueDate: '2026-12-04' }), { due: 'week' }, now)).toBe(false)
    expect(matchesRules(t(), { due: 'none' }, now)).toBe(true)
    expect(matchesRules(t(), { due: 'has' }, now)).toBe(false)
  })
  it('notes and tracked time', () => {
    expect(matchesRules(t({ notes: ' ' }), { hasNotes: true }, now)).toBe(false)
    expect(matchesRules(t({ timeTracked: 60000 }), { hasTime: true }, now)).toBe(true)
  })
})

describe('rulesFromFilters / describeRules', () => {
  it('turns list filters into rules and describes them', () => {
    const r = rulesFromFilters({ priority: 3, tagId: 'g', projectId: null, hasDueDate: false, overdue: true }, 'deck')
    expect(r).toMatchObject({ text: 'deck', priorities: [3], tagIds: ['g'], due: 'overdue' })
    expect(describeRules(r, { tags: [{ id: 'g', name: 'work' }] })).toBe('“deck” · #work · High priority · Overdue')
    expect(describeRules(EMPTY_RULES)).toBe('All open tasks')
  })
})
