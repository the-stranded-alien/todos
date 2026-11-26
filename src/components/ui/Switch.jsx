// ── Labelled switch (checkbox with role="switch") ──────────
import { useId } from 'react'

export const Switch = ({ label, description, checked, onChange, disabled }) => {
  const id = useId()
  return (
    <div className="switch-row">
      <label htmlFor={id} className="switch-text">
        <span className="switch-label">{label}</span>
        {description && <span className="switch-desc" id={`${id}-d`}>{description}</span>}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={description ? `${id}-d` : undefined}
        onChange={e => onChange(e.target.checked)}
      />
    </div>
  )
}
