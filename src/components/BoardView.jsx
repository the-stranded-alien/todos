// ── Board (Kanban) view ────────────────────────────────────
// Columns by status, priority or project. Cards move by drag and drop,
// by keyboard (Alt+←/→), or with their "Move to…" menu; each move is
// one undo step.
import { useMemo, useState } from 'react'
import { useStore } from '../store/context.js'
import { usePrefs, setPrefs } from '../prefs.js'
import { MenuButton } from './ui/Menu.jsx'
import { EmptyState } from './ui/EmptyState.jsx'
import { MoreHorizontal, Calendar, RotateCcw, LayoutList } from '../icons.jsx'
import { PRIORITY_VARS, tint, ink } from '../utils/colors.js'
import { todayISO, addDaysISO, parseLocalISO } from '../utils/dates.js'
import { describeRecurrence } from '../utils/recurrence.js'
import { focusTaskDetail } from '../utils/focus.js'
import { toast } from '../toast.js'

const GROUPS = [['status', 'Status'], ['priority', 'Priority'], ['project', 'Project']]
const DONE_DAYS = 14 // Done column shows recent completions

const fmtDate = (d) => (d === todayISO() ? 'Today' : d === addDaysISO(1) ? 'Tomorrow' : parseLocalISO(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))

export const BoardView = () => {
  const { state, dispatch, moveCard, createTask, undo } = useStore()
  const prefs = usePrefs()
  const by = prefs.boardGroup
  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)
  const [adding, setAdding] = useState({}) // column key → draft text

  const columns = useMemo(() => {
    if (by === 'priority') return [3, 2, 1, 0].map(p => ({ key: String(p), value: p, title: ['No priority', 'Low', 'Medium', 'High'][p], color: PRIORITY_VARS[p] }))
    if (by === 'project') return [{ key: 'inbox', value: null, title: 'Inbox', color: 'var(--text-3)' }, ...state.projects.map(p => ({ key: p.id, value: p.id, title: p.name, color: p.color }))]
    return [
      { key: 'todo', value: 'todo', title: 'To do', color: 'var(--text-3)' },
      { key: 'doing', value: 'doing', title: 'Doing', color: 'var(--warning)' },
      { key: 'done', value: 'done', title: 'Done', color: 'var(--success)' },
    ]
  }, [by, state.projects])

  const [openedAt] = useState(() => Date.now())
  const cards = useMemo(() => {
    const since = openedAt - DONE_DAYS * 86400000
    return state.tasks
      .filter(t => !t.parentId)
      .filter(t => prefs.boardProject === 'all' || (prefs.boardProject === 'inbox' ? !t.projectId : t.projectId === prefs.boardProject))
      .filter(t => (by === 'status' ? !t.completed || (t.completedAt ?? 0) >= since : !t.completed))
      .sort((a, b) => (b.priority - a.priority) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.order - b.order)
  }, [state.tasks, prefs.boardProject, by, openedAt])

  const colOf = (t) => {
    if (by === 'priority') return String(t.priority ?? 0)
    if (by === 'project') return t.projectId ?? 'inbox'
    return t.completed ? 'done' : t.status === 'doing' ? 'doing' : 'todo'
  }

  const move = async (task, col, { focus } = {}) => {
    if (colOf(task) === col.key) return
    await moveCard(task.id, by, col.value)
    toast({ message: `Moved “${task.title}” to ${col.title}.`, action: { label: 'Undo', onClick: undo } })
    if (focus) requestAnimationFrame(() => document.querySelector(`[data-card="${CSS.escape(task.id)}"]`)?.focus())
  }

  const onCardKey = (e, task, ci) => {
    const card = e.currentTarget
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      const target = columns[ci + (e.key === 'ArrowLeft' ? -1 : 1)]
      if (target) move(task, target, { focus: true })
      return
    }
    const nav = { ArrowDown: 'next', ArrowUp: 'prev', ArrowLeft: 'left', ArrowRight: 'right' }[e.key]
    if (!nav) return
    e.preventDefault()
    const col = card.closest('.board-col')
    const list = [...col.querySelectorAll('.board-card')]
    const i = list.indexOf(card)
    if (nav === 'next') list[i + 1]?.focus()
    else if (nav === 'prev') list[i - 1]?.focus()
    else {
      const cols = [...card.closest('.board').querySelectorAll('.board-col')]
      const other = cols[cols.indexOf(col) + (nav === 'left' ? -1 : 1)]
      const target = other?.querySelectorAll('.board-card')
      ;(target?.[Math.min(i, target.length - 1)] ?? other?.querySelector('.board-add input'))?.focus()
    }
  }

  const addCard = async (col) => {
    const title = (adding[col.key] ?? '').trim()
    if (!title) return
    const fields = { title }
    if (by === 'status') fields.status = col.value
    if (by === 'priority') fields.priority = col.value
    if (by === 'project') fields.projectId = col.value
    else if (prefs.boardProject !== 'all') fields.projectId = prefs.boardProject === 'inbox' ? null : prefs.boardProject
    setAdding(a => ({ ...a, [col.key]: '' }))
    await createTask(fields)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="board-head">
        <h1 style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: '1.4rem' }}>Board</h1>
        <div className="segmented" role="radiogroup" aria-label="Columns by">
          {GROUPS.map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={by === v} onClick={() => setPrefs({ boardGroup: v })}>{l}</button>
          ))}
        </div>
        {by !== 'project' && (
          <select className="input-base" style={{ width: 'auto' }} aria-label="Show tasks from" value={prefs.boardProject} onChange={e => setPrefs({ boardProject: e.target.value })}>
            <option value="all">All projects</option>
            <option value="inbox">Inbox</option>
            {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <p className="sr-only">Use arrow keys to move between cards; Alt plus left or right arrow moves a card to the next column.</p>
      </div>

      {cards.length === 0 && by !== 'status' ? (
        <EmptyState icon={LayoutList} title="No open tasks here.">Add a task, or switch to another grouping.</EmptyState>
      ) : (
        <div className="board">
          {columns.map((col, ci) => {
            const list = cards.filter(t => colOf(t) === col.key)
            return (
              <section
                key={col.key}
                className="board-col"
                data-over={overCol === col.key || undefined}
                aria-labelledby={`col-${col.key}`}
                onDragOver={e => { if (dragId) { e.preventDefault(); setOverCol(col.key) } }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null) }}
                onDrop={e => {
                  e.preventDefault(); setOverCol(null)
                  const task = state.tasks.find(t => t.id === dragId)
                  setDragId(null)
                  if (task) move(task, col)
                }}
              >
                <h2 id={`col-${col.key}`} className="board-col-title">
                  <span className="board-dot" style={{ background: col.color }} aria-hidden="true" />
                  {col.title}
                  <span className="board-count">{list.length}<span className="sr-only"> tasks</span></span>
                </h2>
                <ul className="board-cards" aria-labelledby={`col-${col.key}`}>
                  {list.map(t => {
                    const tags = (t.tags || []).map(id => state.tags.find(x => x.id === id)).filter(Boolean)
                    const overdue = t.dueDate && t.dueDate < todayISO() && !t.completed
                    return (
                      <li key={t.id} className="board-li">
                        <div className="board-card-wrap" data-dragging={dragId === t.id || undefined} draggable
                          onDragStart={e => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('taskId', t.id) }}
                          onDragEnd={() => { setDragId(null); setOverCol(null) }}
                          style={{ borderLeftColor: PRIORITY_VARS[t.priority] ?? 'transparent' }}>
                          <button
                            type="button"
                            className="board-card"
                            data-card={t.id}
                            data-done={t.completed || undefined}
                            aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                            onClick={e => { dispatch({ type: 'SELECT_TASK', id: t.id }); if (e.detail === 0) focusTaskDetail() }}
                            onKeyDown={e => onCardKey(e, t, ci)}
                          >
                            <span className="board-card-title">{t.title || 'Untitled'}</span>
                            <span className="board-card-meta">
                              {t.dueDate && <span style={{ color: overdue ? 'var(--danger)' : undefined }}><Calendar size={10} /> {overdue && <span className="sr-only">Overdue, </span>}{fmtDate(t.dueDate)}</span>}
                              {t.recurring && <span><RotateCcw size={10} /> {describeRecurrence(t.recurring, t.dueDate)}</span>}
                              {tags.map(g => <span key={g.id} className="tag-chip" style={{ background: tint(g.color), color: ink(g.color), fontSize: '.62rem', padding: '0 6px' }}>#{g.name}</span>)}
                            </span>
                          </button>
                          <MenuButton
                            label={`Move “${t.title}”`}
                            icon={MoreHorizontal}
                            buttonProps={{ className: 'board-card-menu', small: true }}
                            items={[{ heading: 'Move to' }, ...columns.map(c => ({ label: c.title, checked: c.key === col.key, onSelect: () => move(t, c, { focus: true }) }))]}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {!(by === 'status' && col.key === 'done') && (
                  <form className="board-add" onSubmit={e => { e.preventDefault(); addCard(col) }}>
                    <input className="input-base" placeholder="Add a card…" aria-label={`Add a card to ${col.title}`}
                      value={adding[col.key] ?? ''} onChange={e => setAdding(a => ({ ...a, [col.key]: e.target.value }))} />
                  </form>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
