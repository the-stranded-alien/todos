// ── Shared empty state: icon, title, one helpful sentence ──
import { CheckCircle2 } from '../../icons.jsx'

export const EmptyState = ({ icon: Ic = CheckCircle2, title, children, compact }) => (
  <div className={`empty-state anim-fade-in${compact ? ' empty-state-compact' : ''}`}>
    <span className="empty-state-icon"><Ic size={compact ? 22 : 36} /></span>
    <p className="empty-state-title">{title}</p>
    {children && <p className="empty-state-text">{children}</p>}
  </div>
)
