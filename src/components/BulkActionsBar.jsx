// ── Bulk actions bar ───────────────────────────────────────
import { CheckCircle2, Trash2, FolderInput, Tag, X, Inbox, Folder, PROJECT_ICONS } from '../icons.jsx'
import { useStore } from '../store/context.js'
import { IconButton } from './ui/IconButton.jsx'
import { MenuButton } from './ui/Menu.jsx'

export const BulkActionsBar = () => {
  const { state, dispatch, bulkComplete, bulkDelete, bulkMoveToProject, bulkAddTag } = useStore()
  const { bulkSelected, projects, tags } = state

  const count = bulkSelected.size
  if (count === 0) return null

  return (
    <div className="bulk-bar no-print" role="toolbar" aria-label={`${count} selected tasks`}>
      <span aria-live="polite" style={{ color: 'var(--text-2)', fontSize: '.8rem', fontWeight: 600, marginRight: 4 }}>
        {count} selected
      </span>

      <IconButton label="Complete selected" icon={CheckCircle2} onClick={bulkComplete} data-feat="success" />

      <MenuButton
        label="Move to project"
        icon={FolderInput}
        placement="up"
        align="start"
        items={[
          { heading: 'Move to' },
          { label: 'Inbox', icon: Inbox, onSelect: () => bulkMoveToProject(null) },
          ...projects.map(p => ({ label: p.name, icon: PROJECT_ICONS[p.icon] ?? Folder, onSelect: () => bulkMoveToProject(p.id) })),
        ]}
      />

      <MenuButton
        label="Add tag"
        icon={Tag}
        placement="up"
        align="start"
        items={tags.length
          ? [{ heading: 'Add tag' }, ...tags.map(t => ({ label: `#${t.name}`, swatch: t.color, onSelect: () => bulkAddTag(t.id) }))]
          : [{ label: 'No tags yet', disabled: true }]}
      />

      <div aria-hidden="true" style={{ width: 1, height: 20, background: 'var(--border)' }} />

      <IconButton label="Delete selected" icon={Trash2} onClick={bulkDelete} danger data-feat="danger" />
      <IconButton label="Clear selection" icon={X} onClick={() => dispatch({ type: 'CLEAR_BULK' })} tooltipAlign="end" />
    </div>
  )
}
