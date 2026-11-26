// ── Trash: deleted tasks kept for 30 days ──────────────────
import { useState } from 'react'
import { useStore } from '../store/context.js'
import { TRASH_DAYS } from '../db.js'
import { Trash2, RotateCcw } from '../icons.jsx'
import { EmptyState } from './ui/EmptyState.jsx'
import { ConfirmDialog } from './ui/ConfirmDialog.jsx'
import { toast } from '../toast.js'

const daysLeft = (deletedAt) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - deletedAt) / 86400000))

export const TrashView = () => {
  const { state, restoreFromTrash, deletePermanently, emptyTrash, undo } = useStore()
  const [confirm, setConfirm] = useState(null) // { kind: 'one', entry } | { kind: 'all' }

  // One row per deleted item; subtasks deleted with it are counted, not listed
  const byId = new Map(state.trash.map(e => [e.id, e]))
  const roots = state.trash.filter(e => !(e.task.parentId && byId.get(e.task.parentId)?.batch === e.batch))
  const extra = (root) => state.trash.filter(e => e.batch === root.batch && e.id !== root.id).length
  const ids = (root) => state.trash.filter(e => e.batch === root.batch).map(e => e.id)

  const restore = async (entry) => {
    const n = await restoreFromTrash(entry.id)
    toast({ message: n > 1 ? `Restored “${entry.task.title}” and ${n - 1} subtask${n > 2 ? 's' : ''}.` : `Restored “${entry.task.title}”.`, tone: 'success', action: { label: 'Undo', onClick: undo } })
  }

  const doConfirm = async () => {
    const c = confirm
    setConfirm(null)
    const n = c.kind === 'all' ? await emptyTrash() : await deletePermanently(ids(c.entry))
    toast({ message: `Deleted ${n} task${n === 1 ? '' : 's'} permanently.`, action: { label: 'Undo', onClick: undo } })
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: '20px' }}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h1 style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '1.4rem' }}>Trash</h1>
        <span aria-live="polite" style={{ color: 'var(--text-3)', fontSize: '.8rem', flex: 1 }}>{roots.length} {roots.length === 1 ? 'item' : 'items'}</span>
        {roots.length > 0 && (
          <button type="button" className="btn btn-danger" data-feat="danger" onClick={() => setConfirm({ kind: 'all' })}>
            <Trash2 size={14} /> Empty trash…
          </button>
        )}
      </div>
      <p style={{ color: 'var(--text-3)', fontSize: '.82rem', marginBottom: 16 }}>
        Deleted tasks stay here for {TRASH_DAYS} days, then they’re removed for good.
      </p>

      {roots.length === 0 ? (
        <EmptyState icon={Trash2} title="Trash is empty.">Tasks you delete show up here for {TRASH_DAYS} days.</EmptyState>
      ) : (
        <ul className="task-ul" aria-label="Deleted tasks">
          {roots.map(e => {
            const more = extra(e)
            return (
              <li key={e.id} className="trash-row">
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ color: 'var(--text-1)', fontSize: '.875rem' }}>{e.task.title || 'Untitled'}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '.72rem' }}>
                    Deleted {new Date(e.deletedAt).toLocaleString()}{more ? ` · with ${more} subtask${more > 1 ? 's' : ''}` : ''} · {daysLeft(e.deletedAt)} days left
                  </div>
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => restore(e)}>
                  <RotateCcw size={13} /> Restore
                </button>
                <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirm({ kind: 'one', entry: e })}>
                  Delete permanently…
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'all' ? 'Empty the trash?' : 'Delete permanently?'}
          confirmLabel={confirm.kind === 'all' ? 'Empty trash' : 'Delete permanently'}
          onConfirm={doConfirm}
          onCancel={() => setConfirm(null)}
        >
          {confirm.kind === 'all'
            ? <p>All {roots.length} items in the trash will be removed. You can still undo this until you close the app.</p>
            : <p>“{confirm.entry.task.title}” will be removed. You can still undo this until you close the app.</p>}
        </ConfirmDialog>
      )}
    </div>
  )
}
