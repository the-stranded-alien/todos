// Real-Chrome sweep: console errors, horizontal scroll, axe.
// Usage: npm run build && npx vite preview --port 4173 & node e2e/check.mjs [outDir]
import { chromium } from 'playwright-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = resolve(process.argv[2] || 'e2e/out')
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const AXE = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8')
mkdirSync(OUT, { recursive: true })

const VIEWS = ['inbox', 'today', 'upcoming', 'all', 'completed', 'calendar', 'stats']
const THEMES = (process.env.THEMES || 'light,dark').split(',')  // add +hc for high contrast, e.g. dark+hc
const WIDTHS = (process.env.WIDTHS || '1280,390').split(',').map(Number)

const seed = async (page) => {
  // projects and tags straight into IndexedDB, tasks through the real quick-add box
  await page.evaluate(() => new Promise((res, rej) => {
    const req = indexedDB.open('todos-db')
    req.onsuccess = () => {
      const tx = req.result.transaction(['projects', 'tags'], 'readwrite')
      tx.objectStore('projects').put({ id: 'p-work', name: 'work', color: '#f59e0b', icon: 'Briefcase', order: 1, createdAt: 1 })
      tx.objectStore('tags').put({ id: 't-urgent', name: 'urgent', color: '#84cc16', createdAt: 1 })
      tx.objectStore('tags').put({ id: 't-home', name: 'home', color: '#06b6d4', createdAt: 1 })
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error)
    }
    req.onerror = () => rej(req.error)
  }))
  await page.reload()
  const input = page.getByRole('textbox', { name: 'Quick add task' })
  await input.waitFor()
  for (const t of ['Plan sprint today p1 #urgent @work', 'Buy groceries tomorrow #home', 'Read a book in 3 days p3', 'Call the bank today 4:30pm p2', 'Pay rent yesterday']) {
    await input.fill(t); await input.press('Enter')
  }
  // one completed task
  await page.getByRole('button', { name: 'Mark complete' }).last().click()
  await page.waitForTimeout(500)
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const failures = []
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(BASE)
  await page.getByRole('textbox', { name: 'Quick add task' }).waitFor()
  await seed(page)

  for (const theme of THEMES) {
    const [id, hc] = theme.split('+')
    await page.evaluate(p => localStorage.setItem('todos-prefs', JSON.stringify(p)), { theme: id, extraThemes: true, highContrast: hc === 'hc' })
    await page.reload()
    await page.getByRole('textbox', { name: 'Quick add task' }).waitFor()
    for (const view of VIEWS) {
      await page.evaluate(v => window.dispatchEvent(new CustomEvent('todos:set-view', { detail: v })), view)
      await page.waitForTimeout(450)
      const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      await page.addScriptTag({ content: AXE })
      const res = await page.evaluate(async () => {
        const r = await window.axe.run(document, { resultTypes: ['violations'] })
        return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') }))
      })
      const iconProblems = await page.evaluate(() => {
        const out = []
        for (const el of document.querySelectorAll('.i-icon svg *')) {
          const cs = getComputedStyle(el)
          for (const v of [cs.fill, cs.stroke]) if (/rgb\(10, 11, [1-4]\)/.test(v)) { out.push(`unmapped ${v} in ${el.closest('.i-icon').className}`); break }
        }
        for (const el of document.querySelectorAll('.i-icon')) {
          const r = el.getBoundingClientRect(), svg = el.querySelector('svg')?.getBoundingClientRect()
          if (svg && (r.width > svg.width + 2 || r.height > svg.height + 2)) out.push(`stretched ${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`)
        }
        return [...new Set(out)]
      })
      const tag = `${width}/${theme}/${view}`
      for (const p of iconProblems) failures.push(`${tag}: icon ${p}`)
      await page.screenshot({ path: `${OUT}/${width}-${theme}-${view}.png` })
      if (hscroll) failures.push(`${tag}: horizontal scroll`)
      for (const v of res) failures.push(`${tag}: axe ${v.id} (${v.impact}) ×${v.n} e.g. ${v.sample}`)
    }
  }
  for (const e of errors) failures.push(`${width}: console ${e}`)
  await ctx.close()
}
await browser.close()

console.log(failures.length ? failures.join('\n') : 'ALL CHECKS PASSED')
console.log(`\n${failures.length} problem(s). Screenshots: ${OUT}`)
process.exitCode = failures.length ? 1 : 0
