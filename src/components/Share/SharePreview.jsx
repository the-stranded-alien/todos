// ── Opened a share link: preview, then add to my tasks ─────
import { useState } from 'react'
import { Dialog } from '../ui/Dialog.jsx'
import { useStore } from '../../store/context.js'
import { shareToImport, countItems } from '../../utils/share.js'
import { toast } from '../../toast.js'

const Tree = ({ items }) => (
  <ul className="preview-tree">
    {items.map((i, k) => (
      <li key={k}>
        <span className="preview-check" aria-hidden="true">{i.x ? '☑' : '☐'}</span>
        <span className={i.x ? 'preview-done' : ''}>{i.t}</span>
        {i.x && <span className="sr-only"> (done)</span>}
        {(i.d || i.g?.length || i.p) && (
          <span className="preview-meta"> {[i.d, i.p ? ['', 'low', 'medium', 'high'][i.p] + ' priority' : null, ...(i.g || []).map(g => `#${g}`)].filter(Boolean).join(' · ')}</span>
        )}
        {i.s?.length > 0 && <Tree items={i.s} />}
      </li>
    ))}
  </ul>
)

export const SharePreview = ({ data, onClose, onAdded }) => {
  const { state, importItems, undo } = useStore()
  const [target, setTarget] = useState('new')
  const n = countItems(data.items)

  const add = async () => {
    const opts = target === 'new' ? { newProjectName: data.name || 'Shared tasks' } : { projectId: target === 'inbox' ? null : target }
    const { count, projectId } = await importItems(shareToImport(data.items), opts)
    onClose()
    onAdded?.(projectId)
    toast({ message: `Added ${count} shared task${count === 1 ? '' : 's'}.`, tone: 'success', action: { label: 'Undo', onClick: undo } })
  }

  return (
    <Dialog title={`Shared with you: “${data.name || 'Tasks'}”`} onClose={onClose} size="md"
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Not now</button>
        <button type="button" className="btn btn-primary" onClick={add} data-autofocus>Add {n} task{n === 1 ? '' : 's'}</button>
      </>}
    >
      <p className="settings-text">Someone shared these tasks with a link. Nothing was downloaded from a server: the tasks were inside the link. Have a look, then add them if you want them.</p>
      <div className="preview-box"><Tree items={data.items} /></div>
      <label className="field-label" htmlFor="share-target" style={{ marginTop: 12 }}>Add to</label>
      <select id="share-target" className="input-base" value={target} onChange={e => setTarget(e.target.value)}>
        <option value="new">A new project, “{data.name || 'Shared tasks'}”</option>
        <option value="inbox">Inbox</option>
        {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </Dialog>
  )
}
