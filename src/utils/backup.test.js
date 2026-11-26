import { describe, it, expect } from 'vitest'
import { makeBackup, validateBackup, BACKUP_FORMAT } from './backup.js'

const data = {
  tasks: [{ id: 't1', title: 'One' }, { id: 't2', title: 'Two', parentId: 't1' }],
  projects: [{ id: 'p1', name: 'Home' }],
  tags: [{ id: 'g1', name: 'urgent' }],
  history: [],
}

describe('backup', () => {
  it('round-trips a backup with settings', () => {
    const b = JSON.parse(JSON.stringify(makeBackup(data, { theme: 'dark' })))
    expect(b.format).toBe(BACKUP_FORMAT)
    expect(b.counts).toEqual({ tasks: 2, projects: 1, tags: 1 })
    const r = validateBackup(b)
    expect(r.ok).toBe(true)
    expect(r.data.tasks).toHaveLength(2)
    expect(r.settings).toEqual({ theme: 'dark' })
  })

  it('accepts legacy v1 exports (no manifest)', () => {
    const r = validateBackup({ tasks: data.tasks, projects: [], tags: [], history: [], exportedAt: 1 })
    expect(r.ok).toBe(true)
    expect(r.settings).toBeNull()
  })

  it.each([
    [null, 'doesn’t contain a Todos backup'],
    [[], 'doesn’t contain a Todos backup'],
    [{ format: 'other-app', tasks: [] }, 'different app'],
    [{ format: BACKUP_FORMAT, version: 99, tasks: [] }, 'newer version'],
    [{ projects: [] }, 'no task list'],
    [{ tasks: [{ id: 'a' }] }, 'Task 1 is missing its title'],
    [{ tasks: [{ id: 'a', title: 'x' }, { id: 'a', title: 'y' }] }, 'share the id “a”'],
    [{ tasks: [], projects: [{ id: 'p' }] }, 'Project 1 is missing its name'],
    [{ tasks: [], tags: 'nope' }, 'tags list in this backup is damaged'],
  ])('rejects %j with a plain reason', (raw, msg) => {
    const r = validateBackup(raw)
    expect(r.ok).toBe(false)
    expect(r.error).toContain(msg)
  })
})
