import { describe, it, expect, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { useContext } from 'react'
import { StoreProvider } from './useStore.jsx'
import { StoreContext } from './store/context.js'
import * as db from './db.js'

// Render the provider and hand back a live handle to the store value
const setup = async () => {
  const handle = { current: null }
  const Probe = () => { handle.current = useContext(StoreContext); return null }
  render(<StoreProvider><Probe /></StoreProvider>)
  await waitFor(() => expect(handle.current.state.loading).toBe(false))
  return handle
}
const titles = (h) => h.current.state.tasks.map(t => t.title).sort()

beforeEach(async () => { await db.importAll({ tasks: [], projects: [], tags: [], history: [] }) })

describe('store: never lose data', () => {
  it('deleting a parent removes its subtasks, and undo restores all of them', async () => {
    const h = await setup()
    let parent
    await act(async () => {
      parent = await h.current.createTask({ title: 'Parent' })
      const child = await h.current.createTask({ title: 'Child', parentId: parent.id })
      await h.current.createTask({ title: 'Grandchild', parentId: child.id })
    })
    let n
    await act(async () => { n = await h.current.deleteTask(parent.id) })
    expect(n).toBe(3)
    expect(h.current.state.tasks).toHaveLength(0)
    expect(await db.getTasks()).toHaveLength(0)
    await act(async () => { await h.current.undo() })
    expect(titles(h)).toEqual(['Child', 'Grandchild', 'Parent'])
    expect(await db.getTasks()).toHaveLength(3)
  })

  it('undoing completion of a recurring task also removes the next occurrence', async () => {
    const h = await setup()
    let t
    await act(async () => { t = await h.current.createTask({ title: 'Water plants', dueDate: '2026-11-26', recurring: { freq: 'weekly', interval: 1 } }) })
    await act(async () => { await h.current.completeTask(t.id) })
    const next = h.current.state.tasks.find(x => !x.completed)
    expect(next.dueDate).toBe('2026-12-03')
    await act(async () => { await h.current.undo() })
    expect(h.current.state.tasks).toHaveLength(1)
    expect(h.current.state.tasks[0].completed).toBe(false)
  })

  it('uncomplete is undoable', async () => {
    const h = await setup()
    let t
    await act(async () => { t = await h.current.createTask({ title: 'A' }) })
    await act(async () => { await h.current.completeTask(t.id) })
    await act(async () => { await h.current.uncompleteTask(t.id) })
    expect(h.current.state.tasks[0].completed).toBe(false)
    await act(async () => { await h.current.undo() })
    expect(h.current.state.tasks[0].completed).toBe(true)
  })

  it('rapid edits to one field are one undo step', async () => {
    const h = await setup()
    let t
    await act(async () => { t = await h.current.createTask({ title: 'Draft' }) })
    for (const v of ['Draft 1', 'Draft 12', 'Draft 123']) {
      await act(async () => { await h.current.updateTask(t.id, { title: v }, { coalesce: 'title' }) })
    }
    await act(async () => { await h.current.undo() })
    expect(h.current.state.tasks[0].title).toBe('Draft')
    await act(async () => { await h.current.redo() })
    expect(h.current.state.tasks[0].title).toBe('Draft 123')
  })

  it('deleting a project moves its tasks to the Inbox; undo puts everything back', async () => {
    const h = await setup()
    let p
    await act(async () => {
      p = await h.current.createProject({ name: 'Home' })
      await h.current.createTask({ title: 'Fix sink', projectId: p.id })
    })
    let moved
    await act(async () => { moved = await h.current.deleteProject(p.id) })
    expect(moved).toBe(1)
    expect(h.current.state.projects).toHaveLength(0)
    expect(h.current.state.tasks[0].projectId).toBeNull()
    await act(async () => { await h.current.undo() })
    expect(h.current.state.projects.map(x => x.name)).toEqual(['Home'])
    expect(h.current.state.tasks[0].projectId).toBe(p.id)
  })

  it('deleting a tag strips it from tasks; undo restores it', async () => {
    const h = await setup()
    let tag
    await act(async () => {
      tag = await h.current.createTag({ name: 'urgent' })
      await h.current.createTask({ title: 'Call', tags: [tag.id] })
    })
    await act(async () => { await h.current.deleteTag(tag.id) })
    expect(h.current.state.tasks[0].tags).toEqual([])
    await act(async () => { await h.current.undo() })
    expect(h.current.state.tasks[0].tags).toEqual([tag.id])
  })

  it('restoring a backup snapshots the current data first, and undo brings it back', async () => {
    const h = await setup()
    await act(async () => { await h.current.createTask({ title: 'Mine' }) })
    await act(async () => { await h.current.importData({ tasks: [{ id: 'x', title: 'From backup', tags: [] }], projects: [], tags: [], history: [] }) })
    expect(titles(h)).toEqual(['From backup'])
    const snaps = await db.getSnapshots()
    expect(snaps[0].reason).toMatch(/Before restoring/)
    expect(snaps[0].data.tasks.map(t => t.title)).toEqual(['Mine'])
    await act(async () => { await h.current.undo() })
    expect(titles(h)).toEqual(['Mine'])
  })

  it('bulk delete is a single undo step', async () => {
    const h = await setup()
    const ids = []
    await act(async () => { for (const t of ['a', 'b', 'c']) ids.push((await h.current.createTask({ title: t })).id) })
    await act(async () => { h.current.dispatch({ type: 'SET_BULK', ids: new Set(ids) }) })
    await act(async () => { await h.current.bulkDelete() })
    expect(h.current.state.tasks).toHaveLength(0)
    await act(async () => { await h.current.undo() })
    expect(titles(h)).toEqual(['a', 'b', 'c'])
  })
})
