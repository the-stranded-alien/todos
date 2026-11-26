// ── Import tasks from text: Markdown checklists, todo.txt, lines ──
import { useMemo, useRef, useState } from 'react'
import { Dialog } from '../ui/Dialog.jsx'
import { Switch } from '../ui/Switch.jsx'
import { useStore } from '../../store/context.js'
import { parseTaskText, countImport } from '../../utils/textFormats.js'
import { Upload } from '../../icons.jsx'
import { toast } from '../../toast.js'

const FORMAT = { markdown: 'Markdown checklist', 'todo.txt': 'todo.txt', lines: 'one task per line', empty: '' }

export const ImportDialog = ({ initialText = '', initialName = '', defaultProjectId = null, onClose }) => {
  const { state, importItems, undo } = useStore()
  const [text, setText] = useState(initialText)
  const [fileName, setFileName] = useState(initialName)
  const [smart, setSmart] = useState(true)
  const [target, setTarget] = useState(defaultProjectId ?? 'inbox')
  const [skipped, setSkipped] = useState(() => new Set())
  const fileRef = useRef(null)

  const parsed = useMemo(() => parseTaskText(text, { smart }), [text, smart])
  const chosen = parsed.items.filter((_, i) => !skipped.has(i))
  const n = countImport(chosen)

  const readFile = async (file) => {
    if (!file) return
    if (file.size > 2_000_000) { toast({ message: `“${file.name}” is too big to import (over 2 MB).`, tone: 'warning' }); return }
    setText(await file.text()); setFileName(file.name); setSkipped(new Set())
  }

  const add = async () => {
    const { count } = await importItems(chosen, { projectId: target === 'inbox' ? null : target })
    onClose()
    toast({ message: `Imported ${count} task${count === 1 ? '' : 's'}.`, tone: 'success', action: { label: 'Undo', onClick: undo } })
  }

  return (
    <Dialog title="Import tasks" onClose={onClose} size="md"
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={add} disabled={!n}>Import {n || ''} task{n === 1 ? '' : 's'}</button>
      </>}
    >
      <p className="settings-text">Paste a Markdown checklist, a todo.txt list or one task per line, or choose a .md / .txt file. Indented items become subtasks.</p>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={14} /> Choose a file…</button>
        {fileName && <span className="switch-desc">{fileName}</span>}
        <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" className="hidden" tabIndex={-1} aria-label="Choose a file to import" onChange={e => { readFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <label className="field-label" htmlFor="import-text">Text</label>
      <textarea id="import-text" data-autofocus className="input-base" rows={6} value={text} onChange={e => { setText(e.target.value); setSkipped(new Set()) }}
        placeholder={'- [ ] Book flights\n  - [ ] Compare prices\n- [ ] Pack bags tomorrow #travel'} style={{ fontFamily: 'var(--font-mono)', fontSize: '.8rem' }} />
      <Switch label="Understand dates, tags and priority in each line" description="“Call Sam tomorrow #work !3” becomes a dated, tagged, high-priority task." checked={smart} onChange={setSmart} />

      {parsed.items.length > 0 && (
        <>
          <div className="field-label" style={{ marginTop: 8 }}>Preview · {FORMAT[parsed.format]}</div>
          <ul className="preview-box preview-tree" aria-label="Tasks to import">
            {parsed.items.map((it, i) => (
              <li key={i}>
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="bulk-check" checked={!skipped.has(i)}
                    onChange={e => setSkipped(s => { const x = new Set(s); if (e.target.checked) x.delete(i); else x.add(i); return x })} />
                  <span className={it.done ? 'preview-done' : ''}>{it.title}</span>
                  <span className="preview-meta">
                    {[it.dueDate, it.priority ? ['', 'low', 'medium', 'high'][it.priority] : null, ...it.tags.map(t => `#${t}`), it.children.length ? `${countImport(it.children)} subtasks` : null].filter(Boolean).join(' · ')}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <label className="field-label" htmlFor="import-target" style={{ marginTop: 12 }}>Add to</label>
          <select id="import-target" className="input-base" value={target} onChange={e => setTarget(e.target.value)}>
            <option value="inbox">Inbox</option>
            {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </>
      )}
    </Dialog>
  )
}
