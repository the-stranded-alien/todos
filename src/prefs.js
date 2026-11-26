// ── User preferences (localStorage-backed external store) ──
import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { readPref, writePref } from './utils/storage.js'
import { ALL_THEME_CLASSES, htmlClassesFor, getTheme } from './themes.js'

export const DEFAULT_PREFS = {
  // Appearance
  theme: null,          // null = follow the OS (light/dark) until the user picks one
  extraThemes: false,
  highContrast: false,
  density: 'comfortable',
  reduceMotion: false,  // on top of the OS setting
  // Workspace
  defaultView: 'inbox',
  weekStart: 0,         // 0 = Sunday, 1 = Monday
  // Features
  voice: true,
  timers: true,
  reminders: false,
  hideAI: false,
  pomodoro: true,
  pomoWork: 25,
  pomoShort: 5,
  pomoLong: 15,
  pomoLongEvery: 4,
  pomoSound: true,
}

export const prefersReducedMotion = () => {
  if (prefs.reduceMotion) return true
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

const systemTheme = () => {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' } catch { return 'light' }
}

const load = () => {
  const stored = readPref('prefs', null)
  if (stored) return { ...DEFAULT_PREFS, ...stored }
  // migrate the v1 "theme" key
  let legacy = null
  try { legacy = localStorage.getItem('theme') } catch { /* ignore */ }
  return { ...DEFAULT_PREFS, theme: legacy === 'dark' || legacy === 'light' ? legacy : null }
}

let prefs = load()
const listeners = new Set()

export const resolvedTheme = (p = prefs) => {
  const t = p.theme ?? systemTheme()
  const theme = getTheme(t)
  return theme.extra && !p.extraThemes ? (theme.dark ? 'dark' : 'light') : theme.id
}

export const applyAppearance = (p = prefs) => {
  const root = document.documentElement
  root.classList.remove(...ALL_THEME_CLASSES, 'high-contrast')
  root.classList.add(...htmlClassesFor(resolvedTheme(p), { highContrast: p.highContrast }))
  root.dataset.density = p.density
  if (p.reduceMotion) root.dataset.motion = 'reduce'
  else delete root.dataset.motion
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg-app').trim() || meta.content
}

export const getPrefs = () => prefs

export const setPrefs = (patch) => {
  prefs = { ...prefs, ...(typeof patch === 'function' ? patch(prefs) : patch) }
  writePref('prefs', prefs)
  applyAppearance(prefs)
  listeners.forEach(l => l())
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
export const usePrefs = () => useSyncExternalStore(subscribe, getPrefs)

// Smooth theme change with the View Transitions API when available
export const withThemeTransition = (update) => {
  if (!document.startViewTransition || prefersReducedMotion()) { update(); return }
  document.startViewTransition(() => flushSync(update))
}

// Follow OS changes while the user hasn't picked a theme
if (typeof window !== 'undefined' && window.matchMedia) {
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (prefs.theme == null) { applyAppearance(); listeners.forEach(l => l()) }
    })
  } catch { /* ignore */ }
}
