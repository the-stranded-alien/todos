import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { THEMES, nextTheme, availableThemes, htmlClassesFor, ALL_THEME_CLASSES } from './themes.js'

describe('themes', () => {
  it('cycles through base themes only unless extras are on', () => {
    expect(availableThemes(false).map(t => t.id)).toEqual(['light', 'dark', 'sepia'])
    expect(nextTheme('sepia', false)).toBe('light')
    expect(nextTheme('sepia', true)).toBe('ocean')
    expect(nextTheme('neon-rainbow', true)).toBe('light')
  })

  it('builds html classes for families and high contrast', () => {
    expect(htmlClassesFor('light')).toEqual([])
    expect(htmlClassesFor('dark', { highContrast: true })).toEqual(['dark', 'high-contrast'])
    expect(htmlClassesFor('neon-blue')).toEqual(['dark', 'theme-neon', 'theme-neon-blue'])
    expect(htmlClassesFor('sepia')).toEqual(['theme-sepia'])
    expect(ALL_THEME_CLASSES).toContain('theme-neon-rainbow')
  })

  it('pre-paint script in index.html agrees with THEMES', () => {
    const html = readFileSync('index.html', 'utf8')
    const list = (name) => JSON.parse(html.match(new RegExp(`var ${name} = (\\[[^\\]]*\\])`))[1].replace(/'/g, '"'))
    expect(new Set(list('DARK'))).toEqual(new Set(THEMES.filter(t => t.dark).map(t => t.id)))
    expect(new Set(list('EXTRA'))).toEqual(new Set(THEMES.filter(t => t.extra).map(t => t.id)))
  })

  it('every theme class has CSS', () => {
    const css = readFileSync('src/index.css', 'utf8')
    for (const cls of ALL_THEME_CLASSES) expect(css).toContain(`.${cls}`)
  })
})
