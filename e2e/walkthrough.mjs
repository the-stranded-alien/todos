// Functional walk-through in real Chrome: the feature flows end to end.
// Needs `vite preview` of the production build running.
import { chromium } from 'playwright-core'
import { readFile } from 'node:fs/promises'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

const results = []
let n = 0
const step = async (name, fn) => {
  n++
  try { await fn(); results.push(`✔ ${String(n).padStart(2)} ${name}`) } catch (e) { results.push(`✘ ${String(n).padStart(2)} ${name}: ${e.message.split('\n').slice(0, process.env.DEBUG ? 12 : 1).join('\n   ')}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const quick = page.getByRole('textbox', { name: 'Quick add task' })
const row = (text) => page.locator('.task-row', { has: page.locator('.task-title', { hasText: text }) })
const view = (v) => page.evaluate(x => window.dispatchEvent(new CustomEvent('todos:set-view', { detail: x })), v)
const clickAway = () => page.mouse.click(700, 820)

await page.goto(BASE)
await quick.waitFor()

await step('create a project and a tag', async () => {
  await page.getByRole('button', { name: 'New project' }).click()
  await page.keyboard.type('Home')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: 'New tag' }).click()
  await page.keyboard.type('urgent')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: /^Home/ }).waitFor()
  await page.getByRole('button', { name: /^#urgent/ }).waitFor()
})

await step('quick-add parses date, time, priority, tag and project (chips preview)', async () => {
  await quick.fill('Call the plumber tomorrow 4:30pm p3 #urgent @home')
  const chips = await page.locator('.quick-add-box + div .tag-chip').allTextContents()
  assert(chips.some(c => c.includes('high')) && chips.some(c => c.includes('urgent')) && chips.some(c => c.includes('home')), 'chips: ' + chips.join(' | '))
  await quick.press('Enter')
  // it went to the Home project, not the Inbox
  assert(await row('Call the plumber').count() === 0, 'task stayed in the inbox')
  await page.getByRole('button', { name: /^Home/ }).click()
  const r = row('Call the plumber')
  await r.waitFor()
  const meta = await r.locator('.task-meta').textContent()
  assert(meta.includes('Tomorrow') && meta.includes('16:30') && meta.includes('#urgent'), 'meta: ' + meta)
  assert((await r.locator('.task-title').getAttribute('aria-describedby')) != null, 'no description')
})

await step('Today view adds tasks due today', async () => {
  await view('today')
  await quick.fill('Water the plants'); await quick.press('Enter')
  await row('Water the plants').locator('.task-meta', { hasText: 'Today' }).waitFor()
})

await step('persistence: tasks and settings survive a reload', async () => {
  await page.reload(); await quick.waitFor()
  await view('today')
  await row('Water the plants').waitFor()
  await page.getByRole('button', { name: /^Home/ }).waitFor()
})

await step('timer: start, it ticks, stop keeps the tracked time', async () => {
  const r = row('Water the plants')
  await r.hover()
  await r.getByRole('button', { name: 'Start timer' }).click()
  await page.waitForTimeout(2200)
  await r.getByText(/Timer running/).waitFor()
  await r.getByRole('button', { name: 'Stop timer' }).click()
  await page.locator('.task-title', { hasText: 'Water the plants' }).click()
  const tracked = await page.locator('#detail-time + div .timer-digits').textContent()
  assert(/^[1-9]\d*s$|m/.test(tracked), 'tracked: ' + tracked)
  await page.getByRole('button', { name: 'Close details' }).click()
})

await step('repeat weekly: completing creates the next one', async () => {
  await page.locator('.task-title', { hasText: 'Water the plants' }).click()
  await page.getByRole('combobox', { name: 'Repeats' }).selectOption('weekly')
  await page.getByRole('button', { name: 'Close details' }).click()
  await row('Water the plants').locator('.custom-checkbox').click()
  await page.waitForTimeout(800)
  await view('upcoming')
  await row('Water the plants').waitFor({ timeout: 2000 })
})

await step('repeat phrases: every weekday, skip, ends after N times', async () => {
  await view('all')
  await quick.fill('Daily standup every weekday 9:30am')
  const chip = await page.locator('.quick-add-box + div').textContent()
  assert(chip.includes('Every weekday'), 'chip: ' + chip)
  await quick.press('Enter')
  const r = row('Daily standup')
  await r.waitFor()
  assert((await r.locator('.task-meta').textContent()).includes('Every weekday'), 'badge missing')
  await page.locator('.task-title', { hasText: 'Daily standup' }).click()
  const due1 = await page.getByRole('textbox', { name: 'Due date' }).inputValue()
  const wd = new Date(`${due1}T12:00`).getDay()
  assert(wd >= 1 && wd <= 5, 'first due not a weekday: ' + due1)
  assert(await page.getByRole('button', { name: 'Monday' }).getAttribute('aria-pressed') === 'true', 'Mon not selected')
  assert(await page.getByRole('button', { name: 'Sunday' }).getAttribute('aria-pressed') === 'false', 'Sun selected')
  await page.getByRole('button', { name: 'Skip this one' }).click()
  await page.waitForTimeout(300)
  const due2 = await page.getByRole('textbox', { name: 'Due date' }).inputValue()
  const wd2 = new Date(`${due2}T12:00`).getDay()
  assert(due2 > due1 && wd2 >= 1 && wd2 <= 5, `skip: ${due1} → ${due2}`)
  // end after 3 times: the skip used one, so two completions finish the series
  await page.getByRole('combobox', { name: 'Ends' }).selectOption('after')
  await page.getByRole('spinbutton', { name: 'Number of times' }).fill('3')
  await page.getByRole('spinbutton', { name: 'Number of times' }).blur()
  await page.getByRole('button', { name: 'Close details' }).click()
  for (let i = 0; i < 2; i++) {
    await row('Daily standup').first().locator('.custom-checkbox').click()
    await page.waitForTimeout(700)
  }
  assert(await page.locator('main ul[aria-label$=" tasks"] .task-title', { hasText: 'Daily standup' }).count() === 0, 'a third occurrence was created')
})

await step('subtasks: add in details, shown nested, collapse', async () => {
  await view('inbox')
  await quick.fill('Prepare the presentation'); await quick.press('Enter')
  await page.locator('.task-title', { hasText: 'Prepare the presentation' }).click()
  const add = page.getByRole('textbox', { name: 'Add subtask' })
  await add.fill('Draft slides'); await add.press('Enter')
  await add.fill('Rehearse'); await add.press('Enter')
  await page.getByRole('button', { name: 'Close details' }).click()
  await page.getByRole('list', { name: /Subtasks of “Prepare the presentation”/ }).waitFor()
  await row('Prepare the presentation').getByRole('button', { name: 'Hide subtasks' }).click()
  assert(await page.getByRole('list', { name: /Subtasks of/ }).count() === 0, 'did not collapse')
  await row('Prepare the presentation').getByRole('button', { name: 'Show subtasks' }).click()
})

await step('rename with F2 and with double-click', async () => {
  const t = page.locator('.task-title', { hasText: 'Prepare the presentation' })
  await t.focus(); await page.keyboard.press('F2')
  const input = page.getByRole('textbox', { name: 'Rename task' })
  await input.fill('Prepare the keynote'); await input.press('Enter')
  await page.locator('.task-title', { hasText: 'Prepare the keynote' }).dblclick()
  await page.getByRole('textbox', { name: 'Rename task' }).press('Escape')
  if (await page.getByRole('button', { name: 'Close details' }).count()) await page.getByRole('button', { name: 'Close details' }).click()
  await page.locator('.task-title', { hasText: 'Prepare the keynote' }).waitFor()
})

await step('search finds by notes; no-match shows an empty state', async () => {
  await page.locator('.task-title', { hasText: 'Prepare the keynote' }).click()
  const notes = page.locator('textarea[aria-labelledby="detail-notes-label"]')
  await notes.fill('Remember the **projector** cable'); await notes.blur()
  await page.getByRole('button', { name: 'Close details' }).click()
  await clickAway()
  await page.keyboard.press('/')
  try {
    await page.keyboard.type('projector')
    await page.waitForFunction(() => {
      const top = [...document.querySelectorAll('main ul[aria-label$=" tasks"] > li > .task-row .task-title')].map(e => e.textContent)
      return top.length === 1 && top[0] === 'Prepare the keynote'
    }, null, { timeout: 2000 }).catch(async () => {
      const top = await page.locator('main ul[aria-label$=" tasks"] > li > .task-row .task-title').allTextContents()
      throw new Error(`search for “projector” (box: “${await page.getByRole('searchbox', { name: 'Search tasks' }).inputValue()}”) shows: ${top.join(', ')}`)
    })
    await page.keyboard.type('zzz')
    await page.getByText('No matching tasks.').waitFor()
  } finally {
    if (await page.getByRole('button', { name: 'Clear search' }).count()) await page.getByRole('button', { name: 'Clear search' }).click()
  }
})

await step('notes preview renders markdown safely', async () => {
  await page.locator('.task-title', { hasText: 'Prepare the keynote' }).click()
  await page.getByRole('button', { name: 'Preview' }).click()
  assert(await page.locator('.markdown-preview strong', { hasText: 'projector' }).count() === 1, 'bold not rendered')
  await page.getByRole('button', { name: 'Preview' }).click()
  await page.getByRole('button', { name: 'Close details' }).click()
})

await step('filters: priority and overdue', async () => {
  await quick.fill('Pay the old bill yesterday'); await quick.press('Enter')
  await quick.fill('Low thing p1'); await quick.press('Enter')
  await page.getByRole('button', { name: 'Filters' }).click()
  await page.getByRole('combobox', { name: 'Filter by priority' }).selectOption('1')
  await page.waitForTimeout(100)
  assert(await page.locator('.task-title').allTextContents().then(t => t.length === 1 && t[0] === 'Low thing'), 'priority filter')
  await page.getByRole('button', { name: /Clear 1 filter/ }).click()
  await page.getByRole('checkbox', { name: 'Overdue only' }).check()
  await page.waitForTimeout(100)
  const t = await page.locator('.task-title').allTextContents()
  assert(t.length === 1 && t[0] === 'Pay the old bill', 'overdue filter: ' + t)
  await page.getByRole('button', { name: /Clear 1 filter/ }).click()
  await page.getByRole('button', { name: 'Filters' }).click()
})

await step('sort by priority, then back to manual', async () => {
  await page.getByRole('button', { name: /^Sort:/ }).click()
  await page.getByRole('menuitemradio', { name: 'Priority' }).click()
  const first = await page.locator('.task-title').first().textContent()
  assert(first === 'Low thing', 'first after priority sort: ' + first)
  await page.getByRole('button', { name: /^Sort:/ }).click()
  await page.getByRole('menuitemradio', { name: 'Manual order' }).click()
})

await step('drag to reorder (manual order)', async () => {
  const before = await page.locator('.task-ul > .task-li > .task-row .task-title').allTextContents()
  await row(before[before.length - 1]).dragTo(row(before[0]))
  await page.waitForTimeout(200)
  const after = await page.locator('.task-ul > .task-li > .task-row .task-title').allTextContents()
  assert(after[0] === before[before.length - 1], `order: ${after.join(', ')}`)
})

await step('drag a task onto a project moves it there', async () => {
  await row('Low thing').dragTo(page.getByRole('button', { name: /^Home/ }))
  await page.waitForTimeout(200)
  assert(await row('Low thing').count() === 0, 'still in the inbox')
  await page.getByRole('button', { name: /^Home/ }).click()
  await row('Low thing').waitFor()
  await view('inbox')
})

await step('command palette jumps to a task', async () => {
  await clickAway(); await page.keyboard.press('Control+k')
  await page.keyboard.type('keynote')
  await page.keyboard.press('Enter')
  await page.getByRole('complementary', { name: 'Task details' }).waitFor()
  assert((await page.locator('#task-detail-title').inputValue()) === 'Prepare the keynote', 'wrong task')
  await page.getByRole('button', { name: 'Close details' }).click()
})

await step('focus mode: Done completes the most important task', async () => {
  await clickAway(); await page.keyboard.press('f')
  const dlg = page.getByRole('dialog', { name: 'Focus mode' })
  const top = await dlg.locator('#focus-mode-task').textContent()
  await dlg.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(300)
  assert(await dlg.locator('#focus-mode-task').textContent() !== top, 'same task after Done')
  await page.keyboard.press('Escape')
})

await step('stats reflect completions', async () => {
  await view('stats')
  const done = await page.locator('.stats-view').getByText('Completed this week').locator('..').locator('div').first().textContent()
  assert(Number(done) >= 2, 'completed this week: ' + done)
  await view('inbox')
})

await step('completed view lists finished tasks; reopen one', async () => {
  await view('completed')
  const r = page.locator('.task-row').first()
  await r.waitFor()
  const name = await r.locator('.task-title').textContent()
  await r.locator('.custom-checkbox').click()
  await page.waitForTimeout(300)
  assert(await row(name).count() === 0, 'still in completed')
  await view('inbox')
})

await step('CSV export downloads a file with every task', async () => {
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    (async () => { await page.getByRole('button', { name: 'Download and restore' }).click(); await page.getByRole('menuitem', { name: 'Export tasks as CSV' }).click() })(),
  ])
  const csv = await readFile(await dl.path(), 'utf8')
  const total = await page.evaluate(() => new Promise(r => { const q = indexedDB.open('todos-db'); q.onsuccess = () => { const g = q.result.transaction('tasks').objectStore('tasks').count(); g.onsuccess = () => r(g.result) } }))
  assert(dl.suggestedFilename().endsWith('.csv'), dl.suggestedFilename())
  assert(csv.trim().split('\n').length === total + 1, `csv rows ${csv.trim().split('\n').length - 1} vs ${total}`)
})

await step('theme, density and high contrast persist across reload', async () => {
  await page.keyboard.press('Control+,')
  await page.getByRole('tab', { name: 'Appearance' }).click()
  await page.getByRole('radio', { name: 'Dark' }).click()
  await page.getByRole('switch', { name: /High contrast/ }).check()
  await page.getByRole('radio', { name: 'Compact' }).click()
  await page.keyboard.press('Escape')
  await page.reload(); await quick.waitFor()
  const c = await page.evaluate(() => [document.documentElement.className, document.documentElement.dataset.density])
  assert(c[0].includes('dark') && c[0].includes('high-contrast') && c[1] === 'compact', 'after reload: ' + c)
})

await step('“Open on” setting chooses the start view', async () => {
  await page.keyboard.press('Control+,')
  await page.getByRole('combobox', { name: /Open on/ }).selectOption('today')
  await page.keyboard.press('Escape')
  await page.reload(); await quick.waitFor()
  await page.getByRole('heading', { level: 1, name: 'Today' }).waitFor()
})

await browser.close()
console.log(results.join('\n'))
if (errors.length) console.log('console errors:\n' + errors.join('\n'))
const failed = results.filter(r => r.startsWith('✘')).length + errors.length
console.log(failed ? `\n${failed} failure(s)` : `\nALL ${n} WALK-THROUGH STEPS PASSED`)
process.exitCode = failed ? 1 : 0
