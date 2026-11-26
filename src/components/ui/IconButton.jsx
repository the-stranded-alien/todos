// ── Icon-only button: round hover in a square hit area ─────
// The label is both the accessible name and the tooltip.

export const IconButton = ({
  label, icon: Ic, size = 16, tooltip, tooltipAlign, danger, small, pressed,
  className = '', iconProps, children, ref, ...rest
}) => (
  <button
    ref={ref}
    type="button"
    className={`icon-btn${small ? ' icon-btn-sm' : ''}${danger ? ' icon-btn-danger' : ''}${className ? ` ${className}` : ''}`}
    aria-label={label}
    data-tooltip={tooltip ?? label}
    data-tooltip-align={tooltipAlign}
    aria-pressed={pressed}
    {...rest}
  >
    {Ic && <Ic size={size} {...iconProps} />}
    {children}
  </button>
)
