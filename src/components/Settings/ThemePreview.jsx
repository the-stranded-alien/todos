// ── Live mini preview of a theme ───────────────────────────
// A tiny page drawn with the theme's own classes, so its tokens apply
// locally (see .theme-scope in index.css).
import { themeClasses } from '../../themes.js'

export const ThemePreview = ({ theme }) => (
  <span className={['theme-scope', 'theme-mini', ...(theme.dark ? ['dark'] : []), ...themeClasses(theme)].join(' ')} aria-hidden="true">
    <span className="tm-header"><span className="tm-logo" /><span className="tm-search" /></span>
    <span className="tm-body">
      <span className="tm-side"><span className="tm-nav tm-nav-on" /><span className="tm-nav" /><span className="tm-nav" /></span>
      <span className="tm-main">
        <span className="tm-title" />
        <span className="tm-row"><span className="tm-check" /><span className="tm-line" /></span>
        <span className="tm-row tm-row-on"><span className="tm-check tm-check-on" /><span className="tm-line tm-line-short" /></span>
        <span className="tm-row"><span className="tm-check" /><span className="tm-line" /></span>
      </span>
    </span>
  </span>
)
