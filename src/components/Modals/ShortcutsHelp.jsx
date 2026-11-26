// ── Keyboard shortcuts sheet (grouped) ─────────────────────
import { Dialog } from '../ui/Dialog.jsx'
import { SHORTCUT_GROUPS } from '../../shortcuts.js'

export const ShortcutsHelp = ({ onClose }) => (
  <Dialog title="Keyboard shortcuts" onClose={onClose} size="md">
    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
      {SHORTCUT_GROUPS.map(g => (
        <section key={g.title}>
          <h3 className="menu-heading" style={{ paddingLeft: 0 }}>{g.title}</h3>
          <dl>
            {g.items.map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <dt style={{ color: 'var(--text-2)', fontSize: '.84rem' }}>{desc}</dt>
                <dd><kbd className="kbd">{key}</kbd></dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  </Dialog>
)
