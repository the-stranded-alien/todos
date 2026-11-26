// ── Per-theme icon for the header theme button ────────────
import { Sun, Moon, BookOpen, Zap, Sunrise, Palette, Snowflake, SunDim, Waves, Leaf } from '../icons.jsx'

const ICONS = {
  light: Sun, dark: Moon, sepia: BookOpen, ocean: Waves, forest: Leaf, sun: Sunrise,
  nord: Snowflake, monokai: Palette, solarized: SunDim,
}

export const ThemeIcon = ({ theme, ...props }) => {
  const Ic = ICONS[theme] ?? (theme.startsWith('neon') ? Zap : Sun)
  return <Ic {...props} />
}
