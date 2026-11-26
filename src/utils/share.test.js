import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { encodeShare, decodeShare, toShareItem, countItems } from './share.js'
import { toMarkdown, toTodoTxt, parseTaskText, countImport } from './textFormats.js'

const all = [
  { id: 'a', title: 'Plan trip ✈️', notes: 'Book early', priority: 3, dueDate: '2026-12-01', tags: ['g1'], createdAt: Date.UTC(2026, 10, 20), projectId: 'p' },
  { id: 'b', title: 'Flights', parentId: 'a', tags: [], completed: true, completedAt: Date.UTC(2026, 10, 25) },
  { id: 'c', title: 'Pack', tags: [] },
]
const tagsById = new Map([['g1', 'travel']])
const projectsById = new Map([['p', 'Summer holiday']])

describe('share links', () => {
  it('round-trips through compression with unicode and subtasks', async () => {
    const items = all.filter(t => !t.parentId).map(t => toShareItem(t, all, tagsById))
    const code = await encodeShare({ name: 'Trip', items })
    expect(code.startsWith('z.')).toBe(true)
    expect(/^[A-Za-z0-9._-]+$/.test(code)).toBe(true)
    const back = await decodeShare(code)
    expect(back.name).toBe('Trip')
    expect(back.items[0]).toEqual({ t: 'Plan trip ✈️', n: 'Book early', p: 3, d: '2026-12-01', g: ['travel'], s: [{ t: 'Flights', x: 1 }] })
    expect(countItems(back.items)).toBe(3)
  })
  it('rejects damaged links with a plain message', async () => {
    await expect(decodeShare('q.abc')).rejects.toThrow('isn’t a Todos share link')
    await expect(decodeShare('j.' + btoa('{"v":9}'))).rejects.toThrow('damaged')
  })
})

describe('markdown and todo.txt', () => {
  it('exports a Markdown checklist with nesting, dates, priority, tags, notes', () => {
    const md = toMarkdown('Trip', all.filter(t => !t.parentId), all, tagsById)
    expect(md).toBe('# Trip\n\n- [ ] Plan trip ✈️ (due 2026-12-01) !3 #travel\n  > Book early\n  - [x] Flights\n- [ ] Pack\n')
  })
  it('exports todo.txt', () => {
    const txt = toTodoTxt(all.filter(t => !t.parentId), all, { projectsById, tagsById })
    expect(txt.split('\n')[0]).toBe('(A) 2026-11-20 Plan trip ✈️ +Summer_holiday @travel due:2026-12-01')
    expect(txt.split('\n')[1]).toBe('x 2026-11-25 Flights (part of: Plan trip ✈️)')
  })
  describe('import', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 26, 10)) })
    afterEach(() => vi.useRealTimers())
    it('reads back its own Markdown (round trip)', () => {
      const md = toMarkdown('Trip', all.filter(t => !t.parentId), all, tagsById)
      const { format, items } = parseTaskText(md)
      expect(format).toBe('markdown')
      expect(items[0]).toMatchObject({ title: 'Plan trip ✈️', dueDate: '2026-12-01', priority: 3, tags: ['travel'], notes: 'Book early' })
      expect(items[0].children[0]).toMatchObject({ title: 'Flights', done: true })
      expect(countImport(items)).toBe(3)
    })
    it('reads todo.txt', () => {
      const { format, items } = parseTaskText('(A) Call Mom +Family @phone due:2026-12-02\nx 2026-11-20 Pay rent')
      expect(format).toBe('todo.txt')
      expect(items[0]).toMatchObject({ title: 'Call Mom', priority: 3, project: 'Family', tags: ['phone'], dueDate: '2026-12-02' })
      expect(items[1]).toMatchObject({ title: 'Pay rent', done: true })
    })
    it('reads plain lines and understands dates when asked', () => {
      const { items } = parseTaskText('Buy milk tomorrow\n\nEmail Sam #work')
      expect(items.map(i => [i.title, i.dueDate, i.tags])).toEqual([['Buy milk', '2026-11-27', []], ['Email Sam', null, ['work']]])
      expect(parseTaskText('Buy milk tomorrow', { smart: false }).items[0].title).toBe('Buy milk tomorrow')
    })
    it('nests numbered and bulleted lists by indentation', () => {
      const { items } = parseTaskText('1. Draft\n   * Outline\n   * Intro\n2. Send')
      expect(items.map(i => i.title)).toEqual(['Draft', 'Send'])
      expect(items[0].children.map(i => i.title)).toEqual(['Outline', 'Intro'])
    })
  })
})
