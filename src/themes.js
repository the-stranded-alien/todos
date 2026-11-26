// ── Theme registry ─────────────────────────────────────────
// One place for every theme. `extra` themes appear only when
// "Additional themes" is on. Classes go on <html>.

export const THEMES = [
  { id: 'light',        label: 'Light',        dark: false, swatch: ['#ffffff', '#6d28d9'] },
  { id: 'dark',         label: 'Dark',         dark: true,  swatch: ['#1e1f33', '#a78bfa'] },
  { id: 'sepia',        label: 'Sepia',        dark: false, swatch: ['#fbf6ec', '#9a5212'] },
  { id: 'ocean',        label: 'Ocean',        dark: true,  extra: true, swatch: ['#13293f', '#38bdf8'] },
  { id: 'forest',       label: 'Forest',       dark: false, extra: true, swatch: ['#fbfdf9', '#2f7d32'] },
  { id: 'sun',          label: 'Sun',          dark: false, extra: true, swatch: ['#fffdf6', '#b45309'] },
  { id: 'nord',         label: 'Nord',         dark: true,  extra: true, swatch: ['#3b4252', '#88c0d0'] },
  { id: 'monokai',      label: 'Monokai',      dark: true,  extra: true, swatch: ['#2f302a', '#ff6188'] },
  { id: 'solarized',    label: 'Solarized',    dark: false, extra: true, swatch: ['#fdf6e3', '#1b6aa0'] },
  { id: 'neon',         label: 'Neon Pink',    dark: true,  extra: true, classes: ['theme-neon'], swatch: ['#1a0f2c', '#ff4fd8'] },
  { id: 'neon-blue',    label: 'Neon Blue',    dark: true,  extra: true, classes: ['theme-neon', 'theme-neon-blue'], swatch: ['#0b1124', '#4cc9ff'] },
  { id: 'neon-green',   label: 'Neon Green',   dark: true,  extra: true, classes: ['theme-neon', 'theme-neon-green'], swatch: ['#08160f', '#39ff88'] },
  { id: 'neon-purple',  label: 'Neon Purple',  dark: true,  extra: true, classes: ['theme-neon', 'theme-neon-purple'], swatch: ['#150b26', '#b86bff'] },
  { id: 'neon-rainbow', label: 'Neon Rainbow', dark: true,  extra: true, classes: ['theme-neon', 'theme-neon-rainbow'], swatch: ['#1a0f2c', '#ffd23f'] },
]

export const getTheme = (id) => THEMES.find(t => t.id === id) ?? THEMES[0]

export const themeClasses = (t) => t.classes ?? (t.id === 'light' || t.id === 'dark' ? [] : [`theme-${t.id}`])

export const ALL_THEME_CLASSES = [...new Set(['dark', ...THEMES.flatMap(themeClasses)])]

export const availableThemes = (extra) => THEMES.filter(t => extra || !t.extra)

export const nextTheme = (currentId, extra) => {
  const list = availableThemes(extra)
  const i = list.findIndex(t => t.id === currentId)
  return list[(i + 1) % list.length].id
}

// Full class list for <html> given appearance prefs
export const htmlClassesFor = (themeId, { highContrast = false } = {}) => {
  const t = getTheme(themeId)
  return [...(t.dark ? ['dark'] : []), ...themeClasses(t), ...(highContrast ? ['high-contrast'] : [])]
}
