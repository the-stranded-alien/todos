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

const VIEWS = ['inbox', 'today', 'upcoming', 'all', 'completed', 'calendar', 'stats', 'trash']
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
  // one completed task, one in the trash
  await page.getByRole('button', { name: /^Complete “/ }).last().click()
  await page.waitForTimeout(500)
  await input.fill('Old idea'); await input.press('Enter')
  await page.locator('.task-title', { hasText: 'Old idea' }).focus(); await page.keyboard.press('Delete')
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const failures = []
for (const width of WIDTHS) {
  const height = 860
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
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
      // Anything visible that sticks out past the right edge, or controls cut off by a clipping parent
      const clipped = await page.evaluate(() => {
        const out = []
        for (const el of document.querySelectorAll('#root *')) {
          const r = el.getBoundingClientRect()
          if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue
          if (el.closest('.sr-only')) continue
          if (r.right > innerWidth + 1 || r.left < -1) { out.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} x=${Math.round(r.left)}..${Math.round(r.right)}`); continue }
          if (el.matches('button, input, select, textarea, a[href]')) {
            let p = el.parentElement
            while (p && p !== document.body) {
              const cs = getComputedStyle(p)
              if (/(hidden|clip|auto|scroll)/.test(cs.overflowX)) {
                const pr = p.getBoundingClientRect()
                if (r.right > pr.right + 1 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') out.push(`clipped ${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 30)}"`)
                break
              }
              p = p.parentElement
            }
          }
        }
        return [...new Set(out)].slice(0, 6)
      })
      // Header groups must not overlap
      const overlap = await page.evaluate(() => {
        const kids = [...document.querySelectorAll('header > *')].filter(e => e.getBoundingClientRect().width > 0 && !e.matches('input[type=file]'))
        const out = []
        for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
          const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect()
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`${kids[i].className.split(' ')[0]} × ${kids[j].className.split(' ')[0]}`)
        }
        return out
      })
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
      for (const c of clipped) failures.push(`${tag}: off-screen ${c}`)
      for (const o of overlap) failures.push(`${tag}: header overlap ${o}`)
      for (const v of res) failures.push(`${tag}: axe ${v.id} (${v.impact}) ×${v.n} e.g. ${v.sample}`)
    }
  }
  // Axe on open states: panels, dialogs and menus (after entrance animations)
  if (!process.env.SKIP_STATES) {
    const STATES = [
      ['detail panel', async () => { await page.locator('.task-title').first().click() }, async () => { await page.keyboard.press('Escape') }],
      ['suggest subtasks', async () => {
        await page.locator('.task-title').first().click()
        await page.getByRole('button', { name: 'Suggest subtasks' }).click()
        await page.getByRole('group', { name: 'Suggested subtasks' }).getByRole('button').first().waitFor()
      }, async () => { await page.keyboard.press('Escape') }],
      ['smart list editor', async () => {
        if (width <= 768) await page.getByRole('button', { name: 'Show sidebar' }).click()
        await page.getByRole('button', { name: 'New smart list' }).click()
      }, async () => { await page.keyboard.press('Escape') }],
      ['repeat editor', async () => {
        await page.locator('.task-title').first().click()
        await page.getByRole('combobox', { name: 'Repeats' }).selectOption('monthly')
        await page.getByRole('combobox', { name: 'Ends' }).selectOption('after')
      }, async () => {
        await page.getByRole('combobox', { name: 'Repeats' }).selectOption('none').catch(() => {})
        await page.keyboard.press('Escape')
      }],
      ['reminder set', async () => {
        await page.locator('.task-title').first().click()
        await page.getByRole('combobox', { name: 'Reminder' }).selectOption('at')
      }, async () => {
        await page.getByRole('combobox', { name: 'Reminder' }).selectOption('none').catch(() => {})
        await page.keyboard.press('Escape')
      }],
      ['share dialog', async () => {
        await page.getByRole('button', { name: 'Share, export and import' }).click()
        await page.getByRole('menuitem', { name: 'Share this list…' }).click()
        await page.waitForFunction(() => document.querySelector('#share-url')?.value.includes('#share='))
      }, async () => { await page.keyboard.press('Escape') }],
      ['import dialog', async () => {
        await page.getByRole('button', { name: 'Share, export and import' }).click()
        await page.getByRole('menuitem', { name: 'Import tasks…' }).click()
        await page.getByRole('textbox', { name: 'Text' }).fill('- [ ] One #x\n  - [ ] Two\n- [ ] Three tomorrow')
      }, async () => { await page.keyboard.press('Escape') }],
      ['filters open', async () => { await page.getByRole('button', { name: 'Filters' }).click() }, async () => { await page.getByRole('button', { name: 'Filters' }).click() }],
      ['command palette', async () => { await page.keyboard.press('Control+k'); await page.keyboard.type('go') }, async () => { await page.keyboard.press('Escape') }],
      ['shortcuts dialog', async () => { await page.keyboard.press('?') }, async () => { await page.keyboard.press('Escape') }],
      ['project dialog', async () => {
        if (width <= 768) await page.getByRole('button', { name: 'Show sidebar' }).click()
        await page.getByRole('button', { name: 'New project' }).click()
      }, async () => { await page.keyboard.press('Escape') }],
      ['navigation drawer', async () => { await page.getByRole('button', { name: /sidebar$/ }).click() }, async () => { await page.getByRole('button', { name: /sidebar$/ }).first().click().catch(() => page.keyboard.press('Escape')) }],
      ['header menu', async () => { await page.getByRole('button', { name: 'Download and restore' }).click() }, async () => { await page.keyboard.press('Escape') }],
      ['task context menu', async () => { await page.locator('.task-row').first().click({ button: 'right' }) }, async () => { await page.keyboard.press('Escape') }],
      ['focus mode', async () => { await page.keyboard.press('f') }, async () => { await page.keyboard.press('Escape') }],
      ...['Workspace', 'Appearance', 'Features', 'Storage', 'About'].map(tab => [`settings ${tab}`, async () => {
        await page.keyboard.press('Control+,')
        await page.getByRole('tab', { name: tab }).click()
      }, async () => { await page.keyboard.press('Escape') }]),
      ['help', async () => { await page.getByRole('button', { name: 'Help', exact: true }).click(); await page.keyboard.type('task') }, async () => { await page.keyboard.press('Escape') }],
    ]
    for (const theme of THEMES) {
      const [id, hc] = theme.split('+')
      await page.evaluate(p => localStorage.setItem('todos-prefs', JSON.stringify(p)), { theme: id, extraThemes: true, highContrast: hc === 'hc' })
      await page.reload()
      await page.getByRole('textbox', { name: 'Quick add task' }).waitFor()
      for (const [name, open, close] of STATES) {
        if (width > 768 && name === 'navigation drawer') continue
        await page.mouse.click(5, height - 5)
        await open()
        await page.waitForTimeout(450)
        await page.addScriptTag({ content: AXE })
        const res = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') })))
        const tag = `${width}/${theme}/[${name}]`
        if (name === 'command palette' || name === 'project dialog' || name.startsWith('settings') || name === 'help') await page.screenshot({ path: `${OUT}/${width}-${theme}-${name.replace(/ /g, '-')}.png` })
        for (const v of res) failures.push(`${tag}: axe ${v.id} (${v.impact}) ×${v.n} e.g. ${v.sample}`)
        const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
        if (hscroll) failures.push(`${tag}: horizontal scroll`)
        await close()
        await page.waitForTimeout(150)
      }
    }
  }
  for (const e of errors) failures.push(`${width}: console ${e}`)
  await ctx.close()
}
await browser.close()

console.log(failures.length ? failures.join('\n') : 'ALL CHECKS PASSED')
console.log(`\n${failures.length} problem(s). Screenshots: ${OUT}`)
process.exitCode = failures.length ? 1 : 0
