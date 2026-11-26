// ── Swatch picker (radio group) ────────────────────────────
const NAMES = {
  '#6d28d9': 'Violet', '#4f46e5': 'Indigo', '#0ea5e9': 'Sky', '#10b981': 'Emerald', '#f59e0b': 'Amber',
  '#ef4444': 'Red', '#ec4899': 'Pink', '#8b5cf6': 'Purple', '#06b6d4': 'Cyan', '#84cc16': 'Lime',
}

export const ColorPicker = ({ label, value, onChange, swatches }) => (
  <>
    <div className="field-label" id="color-picker-label">{label}</div>
    <div className="flex flex-wrap gap-2 mb-4" role="radiogroup" aria-labelledby="color-picker-label">
      {swatches.map(c => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(c)}
          aria-label={NAMES[c] ?? c}
          data-tooltip={NAMES[c] ?? c}
          className="swatch"
          style={{ '--swatch': c }}
        />
      ))}
    </div>
  </>
)
