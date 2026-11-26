// ── Share tasks as a link (no server: data is in the fragment) ──
import { useEffect, useState } from 'react'
import { Dialog } from '../ui/Dialog.jsx'
import { Link, Share } from '../../icons.jsx'
import { encodeShare, shareUrl, toShareItem, countItems } from '../../utils/share.js'
import { toast } from '../../toast.js'

const LONG = 8000 // some chat apps cut links longer than this

export const ShareDialog = ({ name, tasks, all, tags, onClose }) => {
  const [url, setUrl] = useState('')
  const tagsById = new Map(tags.map(t => [t.id, t.name]))
  const items = tasks.map(t => toShareItem(t, all, tagsById))
  const count = countItems(items)
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  useEffect(() => {
    let alive = true
    encodeShare({ name, items }).then(code => { if (alive) setUrl(shareUrl(location.origin, code)) })
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast({ message: 'Link copied.', tone: 'success' }) }
    catch { toast({ message: 'Couldn’t copy. Select the link and copy it yourself.', tone: 'warning' }) }
  }
  const nativeShare = async () => {
    try { await navigator.share({ title: `${name} (Todos)`, text: `${count} tasks from Todos`, url }) } catch { /* cancelled */ }
  }

  return (
    <Dialog title={`Share “${name}”`} onClose={onClose} size="md"
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        {canNativeShare && <button type="button" className="btn btn-ghost" onClick={nativeShare} disabled={!url}><Share size={14} /> Share…</button>}
        <button type="button" className="btn btn-primary" onClick={copy} disabled={!url} data-autofocus><Link size={14} /> Copy link</button>
      </>}
    >
      <p className="settings-text">
        This link contains {count} task{count === 1 ? '' : 's'} (names, notes, dates, priority, tags and subtasks). The tasks travel <strong>inside the link</strong>, so nothing is uploaded, and anyone you send it to can read them.
      </p>
      <label className="field-label" htmlFor="share-url">Link</label>
      <textarea id="share-url" className="input-base" readOnly rows={3} value={url || 'Preparing…'} onFocus={e => e.target.select()} style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', wordBreak: 'break-all' }} />
      {url.length > LONG && <p className="switch-desc" role="note" style={{ marginTop: 6 }}>This link is long ({url.length.toLocaleString()} characters). Some apps shorten long links; if it doesn’t open, share fewer tasks or send a Markdown copy instead.</p>}
    </Dialog>
  )
}
