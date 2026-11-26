// ── Share links: tasks travel inside the URL fragment ──────
// The fragment (#…) is never sent to a server. Data is JSON, deflated
// with CompressionStream when available, then base64url-encoded.

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0))

const streamBytes = async (bytes, stream) => new Uint8Array(await new Response(new Response(bytes).body.pipeThrough(stream)).arrayBuffer())

// Keep only what's useful to someone else: no ids, timers or history
export const toShareItem = (task, all, tagsById) => {
  const item = { t: task.title }
  if (task.notes) item.n = task.notes
  if (task.completed) item.x = 1
  if (task.priority) item.p = task.priority
  if (task.dueDate) item.d = task.dueDate
  if (task.dueTime) item.h = task.dueTime
  const tags = (task.tags || []).map(id => tagsById.get(id)).filter(Boolean)
  if (tags.length) item.g = tags
  const kids = all.filter(t => t.parentId === task.id)
  if (kids.length) item.s = kids.map(k => toShareItem(k, all, tagsById))
  return item
}

export const encodeShare = async (payload) => {
  const json = new TextEncoder().encode(JSON.stringify({ v: 1, ...payload }))
  if (typeof CompressionStream !== 'undefined') return `z.${b64url(await streamBytes(json, new CompressionStream('deflate-raw')))}`
  return `j.${b64url(json)}`
}

export const decodeShare = async (code) => {
  const [kind, data] = [code.slice(0, 1), code.slice(2)]
  let bytes = unb64url(data)
  if (kind === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser can’t open compressed share links.')
    bytes = await streamBytes(bytes, new DecompressionStream('deflate-raw'))
  } else if (kind !== 'j') throw new Error('This isn’t a Todos share link.')
  const v = JSON.parse(new TextDecoder().decode(bytes))
  if (v?.v !== 1 || !Array.isArray(v.items)) throw new Error('This share link is damaged or from a newer version.')
  return v
}

export const SHARE_PREFIX = '#share='
export const shareUrl = (origin, code) => `${origin}/${SHARE_PREFIX}${code}`

export const countItems = (items) => items.reduce((n, i) => n + 1 + countItems(i.s || []), 0)

// Share items → import items (see store.importItems)
export const shareToImport = (items) => items.map(i => ({
  title: i.t, notes: i.n || '', done: !!i.x, priority: i.p || 0, dueDate: i.d || null, dueTime: i.h || null,
  tags: i.g || [], project: null, children: shareToImport(i.s || []),
}))
