// ── Smart list editor: name + rules, with a live match count ──
import { useMemo, useState } from 'react'
import { useStore } from '../../store/context.js'
import { SWATCHES, DEFAULT_SWATCH } from '../../utils/colors.js'
import { EMPTY_RULES, DUE_OPTIONS, matchesRules } from '../../utils/smartLists.js'
import { Dialog } from '../ui/Dialog.jsx'
import { Switch } from '../ui/Switch.jsx'
import { ColorPicker } from './ColorPicker.jsx'
import { Trash2 } from '../../icons.jsx'
import { toast } from '../../toast.js'

const SORTS = [['order', 'Manual order'], ['dueDate', 'Due date'], ['priority', 'Priority'], ['createdAt', 'Date created'], ['title', 'Alphabetical']]

const CheckGroup = ({ label, options, value, onChange }) => (
  <fieldset className="check-group">
    <legend className="field-label">{label}</legend>
    <div className="check-chips">
      {options.map(([v, text]) => (
        <label key={v} className="check-chip">
          <input type="checkbox" checked={value.includes(v)} onChange={e => onChange(e.target.checked ? [...value, v] : value.filter(x => x !== v))} />
          <span>{text}</span>
        </label>
      ))}
    </div>
  </fieldset>
)

export const SmartListEditor = ({ list, initialRules, onClose, onSaved }) => {
  const { state, createList, updateList, deleteList, undo } = useStore()
  const [name, setName] = useState(list?.name ?? '')
  const [color, setColor] = useState(list?.color ?? DEFAULT_SWATCH)
  const [sortBy, setSortBy] = useState(list?.sortBy ?? 'order')
  const [rules, setRules] = useState({ ...EMPTY_RULES, ...(list?.rules ?? initialRules ?? {}) })
  const set = (patch) => setRules(r => ({ ...r, ...patch }))

  const count = useMemo(() => state.tasks.filter(t => !t.parentId && matchesRules(t, rules)).length, [state.tasks, rules])

  const save = async () => {
    if (!name.trim()) return
    const fields = { name: name.trim(), color, rules, sortBy }
    if (list) { await updateList(list.id, fields); onClose() }
    else { const created = await createList(fields); onSaved?.(created); onClose() }
  }

  const remove = async () => {
    await deleteList(list.id)
    onClose()
    toast({ message: `Deleted smart list “${list.name}”. Its tasks are unchanged.`, action: { label: 'Undo', onClick: undo } })
  }

  return (
    <Dialog
      title={list ? 'Edit smart list' : 'New smart list'}
      onClose={onClose}
      size="md"
      footer={<>
        {list && <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} data-feat="danger" onClick={remove}><Trash2 size={14} /> Delete list</button>}
        <span aria-live="polite" style={{ marginRight: 'auto', alignSelf: 'center', color: 'var(--text-3)', fontSize: '.8rem' }}>
          Matches {count} task{count === 1 ? '' : 's'}
        </span>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!name.trim()}>{list ? 'Save' : 'Create'}</button>
      </>}
    >
      <label className="field-label" htmlFor="list-name">Name</label>
      <input id="list-name" data-autofocus className="input-base mb-4" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Urgent at work" onKeyDown={e => e.key === 'Enter' && save()} />

      <ColorPicker label="Colour" value={color} onChange={setColor} swatches={SWATCHES} />

      <label className="field-label" htmlFor="list-text">Words in the name or notes</label>
      <input id="list-text" className="input-base mb-4" value={rules.text} onChange={e => set({ text: e.target.value })} placeholder="Optional" />

      <CheckGroup label="Projects (any of)" value={rules.projectIds} onChange={v => set({ projectIds: v })}
        options={[['inbox', 'Inbox'], ...state.projects.map(p => [p.id, p.name])]} />

      {state.tags.length > 0 && (
        <>
          <CheckGroup label="Tags" value={rules.tagIds} onChange={v => set({ tagIds: v })}
            options={state.tags.map(t => [t.id, `#${t.name}`])} />
          {rules.tagIds.length > 1 && (
            <div className="segmented mb-3" role="radiogroup" aria-label="Tag matching">
              <button type="button" role="radio" aria-checked={rules.tagMode === 'any'} onClick={() => set({ tagMode: 'any' })}>Any of these tags</button>
              <button type="button" role="radio" aria-checked={rules.tagMode === 'all'} onClick={() => set({ tagMode: 'all' })}>All of these tags</button>
            </div>
          )}
        </>
      )}

      <CheckGroup label="Priority (any of)" value={rules.priorities} onChange={v => set({ priorities: v })}
        options={[[3, 'High'], [2, 'Medium'], [1, 'Low'], [0, 'None']]} />

      <div className="grid gap-3 mb-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div>
          <label className="field-label" htmlFor="list-due">Due</label>
          <select id="list-due" className="input-base" value={rules.due} onChange={e => set({ due: e.target.value })}>
            {DUE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="list-sort">Sort by</label>
          <select id="list-sort" className="input-base" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <Switch label="Has notes" checked={rules.hasNotes} onChange={v => set({ hasNotes: v })} />
      <Switch label="Has tracked time" checked={rules.hasTime} onChange={v => set({ hasTime: v })} />
      <Switch label="Include completed tasks" checked={rules.includeCompleted} onChange={v => set({ includeCompleted: v })} />
    </Dialog>
  )
}
