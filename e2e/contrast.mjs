// Token contrast audit in real Chrome: every text token vs every surface,
// in every theme, with and without high contrast. Needs `vite preview` running.
import { chromium } from 'playwright-core'
import { THEMES } from '../src/themes.js'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const TEXT = ['--text-1', '--text-2', '--text-3', '--text-4', '--accent', '--danger', '--success', '--warning', '--info']
const SURFACES = ['--bg-app', '--bg-surface', '--bg-card', 'accent-soft/card', 'accent-soft/surface']

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.goto(BASE)
const fails = []
for (const theme of THEMES) {
  for (const hc of [false, true]) {
    await page.evaluate(p => { localStorage.setItem('todos-prefs', JSON.stringify(p)) }, { theme: theme.id, extraThemes: true, highContrast: hc })
    await page.reload()
    await page.waitForSelector('#root > *')
    const rows = await page.evaluate(({ TEXT, SURFACES }) => {
      const probe = document.createElement('div'); document.body.appendChild(probe)
      const resolve = (prop, v) => { probe.style[prop] = v; return getComputedStyle(probe)[prop] }
      const parse = (s) => {
        let m = s.match(/rgba?\(([\d.]+),?\s*([\d.]+),?\s*([\d.]+)(?:[,/]\s*([\d.]+))?/)
        if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]]
        m = s.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?/)
        if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] == null ? 1 : +m[4]]
        throw new Error('cannot parse ' + s)
      }
      const over = (top, base) => top.slice(0, 3).map((c, i) => c * top[3] + base[i] * (1 - top[3])).concat(1)
      const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b) }
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05) }
      const col = (v) => parse(resolve('color', `var(${v})`))
      const bg = (v) => parse(resolve('backgroundColor', `var(${v})`))
      const card = bg('--bg-card'), surface = bg('--bg-surface')
      const surf = {
        '--bg-app': bg('--bg-app'), '--bg-surface': surface, '--bg-card': card,
        'accent-soft/card': over(bg('--accent-soft'), card), 'accent-soft/surface': over(bg('--accent-soft'), surface),
      }
      const out = []
      for (const t of TEXT) for (const s of SURFACES) out.push([t, s, ratio(over(col(t), surf[s]), surf[s])])
      out.push(['--on-accent', '--accent', ratio(col('--on-accent'), over(bg('--accent'), card))])
      probe.remove()
      return out
    }, { TEXT, SURFACES })
    for (const [t, s, r] of rows) if (r < 4.5) fails.push(`${theme.id}${hc ? '+hc' : ''}: ${t} on ${s} = ${r.toFixed(2)}`)
  }
}
await browser.close()
console.log(fails.length ? fails.join('\n') : 'ALL TOKEN PAIRS ≥ 4.5:1')
console.log(`\n${fails.length} failing pair(s) across ${THEMES.length} themes × 2`)
process.exitCode = fails.length ? 1 : 0
