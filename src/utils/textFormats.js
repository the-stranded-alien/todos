// ── Markdown checklists and todo.txt: export and import ────
// Import produces items: { title, done, priority, dueDate, dueTime, tags: [names], project, notes, children: [] }
import { parseTaskInput } from './nlpParse.js'

const PRIO_MD = ['', ' !1', ' !2', ' !3']

// ── Export ────────────────────────────────────────────────
export const toMarkdown = (name, tasks, all, tagsById) => {
  const line = (t, depth) => {
    const tags = (t.tags || []).map(id => tagsById.get(id)).filter(Boolean).map(n => ` #${n}`).join('')
    const due = t.dueDate ? ` (due ${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ''})` : ''
    const out = [`${'  '.repeat(depth)}- [${t.completed ? 'x' : ' '}] ${t.title}${due}${PRIO_MD[t.priority || 0]}${tags}`]
    if (t.notes) out.push(...t.notes.split('\n').map(l => `${'  '.repeat(depth + 1)}${l ? `> ${l}` : '>'}`))
    for (const k of all.filter(x => x.parentId === t.id)) out.push(...line(k, depth + 1))
    return out
  }
  return [`# ${name}`, '', ...tasks.flatMap(t => line(t, 0)), ''].join('\n')
}

const TXT_PRIO = ['', '(C) ', '(B) ', '(A) ']
const slug = (s) => s.trim().replace(/\s+/g, '_')

export const toTodoTxt = (tasks, all, { projectsById, tagsById }) => {
  const line = (t, parent) => {
    const parts = []
    if (t.completed) parts.push('x', t.completedAt ? new Date(t.completedAt).toISOString().slice(0, 10) : '')
    else if (t.priority) parts.push(TXT_PRIO[t.priority].trim())
    if (t.createdAt) parts.push(new Date(t.createdAt).toISOString().slice(0, 10))
    parts.push(parent ? `${t.title} (part of: ${parent.title})` : t.title)
    const p = projectsById.get(t.projectId)
    if (p) parts.push(`+${slug(p)}`)
    for (const id of t.tags || []) { const n = tagsById.get(id); if (n) parts.push(`@${slug(n)}`) }
    if (t.dueDate) parts.push(`due:${t.dueDate}`)
    return parts.filter(Boolean).join(' ')
  }
  const out = []
  const walk = (t, parent) => { out.push(line(t, parent)); for (const k of all.filter(x => x.parentId === t.id)) walk(k, t) }
  tasks.forEach(t => walk(t, null))
  return out.join('\n') + '\n'
}

// ── Import ────────────────────────────────────────────────
const TODOTXT = /^(?:x\s+(?:\d{4}-\d{2}-\d{2}\s+)?)?(?:\([A-Z]\)\s+)?(?:\d{4}-\d{2}-\d{2}\s+)?\S.*$/
const looksTodoTxt = (lines) => lines.filter(Boolean).every(l => TODOTXT.test(l)) && lines.some(l => /(^\([A-Z]\) )|( \+\S)|( @\S)|( due:\d{4})|(^x \d{4})/.test(l))

const fromTodoTxtLine = (raw) => {
  let l = raw.trim()
  const item = { done: false, priority: 0, tags: [], project: null, dueDate: null, dueTime: null, notes: '', children: [] }
  const x = l.match(/^x\s+(?:\d{4}-\d{2}-\d{2}\s+)?/)
  if (x) { item.done = true; l = l.slice(x[0].length) }
  const pr = l.match(/^\(([A-Z])\)\s+/)
  if (pr) { item.priority = pr[1] === 'A' ? 3 : pr[1] === 'B' ? 2 : 1; l = l.slice(pr[0].length) }
  l = l.replace(/^\d{4}-\d{2}-\d{2}\s+/, '')
  l = l.replace(/\s\+(\S+)/g, (_, p) => { item.project ??= p.replace(/_/g, ' '); return '' })
  l = l.replace(/\s@(\S+)/g, (_, c) => { item.tags.push(c.replace(/_/g, '-').toLowerCase()); return '' })
  l = l.replace(/\sdue:(\d{4}-\d{2}-\d{2})/g, (_, d) => { item.dueDate = d; return '' })
  item.title = l.replace(/\s{2,}/g, ' ').trim()
  return item
}

const CHECK = /^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/

const fromMarkdownLine = (text, done, smart) => {
  let t = text
  let dueDate = null, dueTime = null
  const due = t.match(/\s*\(due (\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?\)/)
  if (due) { dueDate = due[1]; dueTime = due[2] ?? null; t = t.replace(due[0], '') }
  const base = { done, priority: 0, tags: [], project: null, dueDate, dueTime, notes: '', children: [] }
  if (!smart) return { ...base, title: t.trim() }
  const p = parseTaskInput(t)
  return { ...base, title: p.title || t.trim(), priority: p.priority, tags: p.tags, project: p.projectName, dueDate: dueDate ?? p.dueDate, dueTime: dueTime ?? p.dueTime }
}

// Parse pasted text: todo.txt, Markdown checklists (indent = subtask), or plain lines
export const parseTaskText = (text, { smart = true } = {}) => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const nonEmpty = lines.map(l => l.trimEnd()).filter(l => l.trim())
  if (!nonEmpty.length) return { format: 'empty', items: [] }
  if (looksTodoTxt(nonEmpty)) return { format: 'todo.txt', items: nonEmpty.map(fromTodoTxtLine).filter(i => i.title) }

  const items = []
  const stack = [] // { indent, item }
  const isList = nonEmpty.some(l => CHECK.test(l))
  for (const raw of lines) {
    if (!raw.trim()) continue
    if (/^\s*#{1,6}\s/.test(raw) && isList) continue // headings
    const quote = raw.match(/^(\s*)>\s?(.*)$/)
    if (quote && stack.length) { const it = stack[stack.length - 1].item; it.notes += (it.notes ? '\n' : '') + quote[2]; continue }
    const m = isList ? raw.match(CHECK) : null
    const indent = m ? m[1].replace(/\t/g, '  ').length : 0
    const item = m ? fromMarkdownLine(m[3], (m[2] || '').toLowerCase() === 'x', smart) : fromMarkdownLine(raw.trim(), false, smart)
    if (!item.title) continue
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    if (stack.length) stack[stack.length - 1].item.children.push(item)
    else items.push(item)
    stack.push({ indent, item })
  }
  return { format: isList ? 'markdown' : 'lines', items }
}

export const countImport = (items) => items.reduce((n, i) => n + 1 + countImport(i.children), 0)
