// ── Colour helpers ─────────────────────────────────────────
// User-chosen project/tag colours are data. Render them through these
// helpers so text stays readable in every theme.

export const SWATCHES = ['#6d28d9', '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16']
export const DEFAULT_SWATCH = SWATCHES[0]

// Translucent background tint
export const tint = (c, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
// Foreground that keeps contrast: pulls the colour toward the theme's text colour
export const ink = (c) => `color-mix(in srgb, ${c} 50%, var(--text-1))`

export const PRIORITY_VARS = ['var(--text-3)', 'var(--prio-1)', 'var(--prio-2)', 'var(--prio-3)']
