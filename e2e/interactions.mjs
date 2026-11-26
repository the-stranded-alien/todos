// Interaction checks in real Chrome: menus, dialogs, tooltips, toasts, undo.
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const BASE_ORIGIN = () => new URL(BASE).origin
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

const results = []
const check = async (name, fn) => {
  try { await fn(); results.push(`✔ ${name}`) } catch (e) { results.push(`✘ ${name}: ${e.message.split('\n').slice(0, process.env.DEBUG ? 14 : 1).join('\n   ')}`) }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }
const active = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim().slice(0, 40) || document.activeElement?.tagName)
const onScreen = (sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }, sel)

await page.goto(BASE)
const quick = page.getByRole('textbox', { name: 'Quick add task' })
await quick.waitFor()
for (const t of ['Alpha task', 'Beta task', 'Gamma task']) { await quick.fill(t); await quick.press('Enter') }

await check('icon-only buttons all have aria-label and tooltip', async () => {
  const bad = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => !b.textContent.trim() && (!b.getAttribute('aria-label') || !b.dataset.tooltip)).map(b => b.outerHTML.slice(0, 80)))
  assert(bad.length === 0, bad.join(' | '))
})

await check('header menu: keyboard, on screen, Escape returns focus', async () => {
  const btn = page.getByRole('button', { name: 'Download and restore' })
  await btn.focus(); await page.keyboard.press('Enter')
  await page.getByRole('menu').waitFor()
  assert(await btn.getAttribute('aria-expanded') === 'true', 'aria-expanded not true')
  assert(await onScreen('[role=menu]'), 'menu off screen')
  assert((await active()).startsWith('Download backup'), 'first item not focused: ' + await active())
  await page.keyboard.press('ArrowDown'); assert((await active()).startsWith('Export tasks'), 'ArrowDown failed')
  await page.keyboard.press('End'); assert((await active()).startsWith('Restore'), 'End failed')
  await page.keyboard.press('Escape')
  assert(await page.getByRole('menu').count() === 0, 'menu still open')
  assert(await active() === 'Download and restore', 'focus not returned: ' + await active())
})

await check('sort menu changes sort and marks the choice', async () => {
  await page.getByRole('button', { name: /^Sort:/ }).click()
  await page.getByRole('menuitemradio', { name: 'Alphabetical' }).click()
  assert(await page.getByRole('button', { name: 'Sort: Alphabetical' }).count() === 1, 'sort label not updated')
  await page.getByRole('button', { name: /^Sort:/ }).click()
  assert(await page.getByRole('menuitemradio', { name: 'Alphabetical' }).getAttribute('aria-checked') === 'true', 'not checked')
  await page.mouse.click(700, 700)
  assert(await page.getByRole('menu').count() === 0, 'outside click did not close')
})

await check('tooltip shows after hover, names the button, hides on pointer-down', async () => {
  await page.getByRole('button', { name: 'Settings' }).hover()
  await page.waitForTimeout(500)
  const tip = page.getByRole('tooltip')
  assert(await tip.textContent() === 'Settings (Ctrl/⌘+,)', 'tooltip text: ' + await tip.textContent())
  assert(await onScreen('[role=tooltip]'), 'tooltip off screen')
  await page.mouse.down(); await page.mouse.up() // also clicks it: opens Settings
  assert(await page.getByRole('tooltip').count() === 0, 'tooltip still visible')
  await page.getByRole('dialog', { name: 'Settings' }).waitFor()
  await page.keyboard.press('Escape')
})

await check('context menu: Shift+F10 opens, Delete removes, toast Undo restores', async () => {
  const row = page.locator('.task-row', { hasText: 'Beta task' })
  await row.locator('.task-title').focus(); await page.keyboard.press('Shift+F10')
  await page.getByRole('menu').waitFor()
  assert(await onScreen('[role=menu]'), 'context menu off screen')
  await page.getByRole('menuitem', { name: /Delete/ }).click()
  await page.waitForTimeout(200)
  assert(await page.locator('.task-row', { hasText: 'Beta task' }).count() === 0, 'not deleted')
  const status = page.getByRole('status')
  assert((await status.textContent()).includes('Moved “Beta task” to the trash'), 'toast text: ' + await status.textContent())
  await status.getByRole('button', { name: 'Undo' }).click()
  await page.locator('.task-row', { hasText: 'Beta task' }).waitFor({ timeout: 2000 })
})

await check('right-click menu duplicates a task', async () => {
  await page.locator('.task-row', { hasText: 'Alpha task' }).first().click({ button: 'right', timeout: 4000 })
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await page.locator('.task-row', { hasText: 'Alpha task (copy)' }).waitFor({ timeout: 2000 })
})

await check('shortcuts dialog: "?" opens, focus inside, Escape closes', async () => {
  await page.mouse.click(700, 700)
  await page.keyboard.press('?')
  const dlg = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await dlg.waitFor()
  assert(await page.evaluate(() => document.querySelector('[role=dialog]').contains(document.activeElement)), 'focus not in dialog')
  await page.keyboard.press('Escape')
  assert(await dlg.count() === 0, 'still open')
})

await check('palette: Ctrl+K opens with input focused; Escape closes', async () => {
  await page.keyboard.press('Control+k')
  await page.getByRole('dialog', { name: 'Command palette' }).waitFor()
  assert(await active() === 'Search commands, views and tasks', 'focus: ' + await active())
  await page.keyboard.press('Escape')
  assert(await page.getByRole('dialog').count() === 0, 'still open')
})

await check('nested: Escape in project dialog leaves the detail panel open', async () => {
  await page.locator('.task-row', { hasText: 'Gamma task' }).click()
  await page.getByRole('button', { name: 'Close details' }).waitFor()
  await page.getByRole('button', { name: 'New project' }).click()
  const dlg = page.getByRole('dialog', { name: 'New project' })
  await dlg.waitFor()
  assert(await active() === 'Name' || (await page.evaluate(() => document.activeElement.id)) === 'project-name', 'name not focused')
  await page.keyboard.press('Escape')
  assert(await dlg.count() === 0, 'dialog still open')
  assert(await page.getByRole('button', { name: 'Close details' }).count() === 1, 'detail panel closed too')
  assert(await active() === 'New project', 'focus not returned: ' + await active())
})

await check('dialog closes on backdrop mouse-down; create project works', async () => {
  await page.getByRole('button', { name: 'New project' }).click()
  await page.mouse.click(10, 10)
  assert(await page.getByRole('dialog').count() === 0, 'backdrop did not close')
  await page.getByRole('button', { name: 'New project' }).click()
  await page.keyboard.type('Garden')
  await page.getByRole('radio', { name: 'Emerald' }).click()
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: /Garden/ }).first().waitFor()
})

await check('native undo still works inside text fields', async () => {
  await quick.click(); await page.keyboard.type('Typed text')
  await page.evaluate(() => document.execCommand('undo'))
  assert(await quick.inputValue() === '', 'value after undo: ' + await quick.inputValue())
})

await check('bulk bar menus open upward and stay on screen', async () => {
  await page.locator('.task-row', { hasText: 'Alpha task' }).first().hover()
  await page.getByRole('checkbox', { name: 'Select “Alpha task”' }).first().check()
  await page.getByRole('button', { name: 'Move to project' }).click()
  await page.getByRole('menu').waitFor()
  assert(await onScreen('[role=menu]'), 'off screen')
  await page.getByRole('menuitem', { name: 'Garden' }).click()
  await page.getByRole('toolbar').waitFor({ state: 'detached', timeout: 2000 })
  assert(await page.locator('.task-row', { hasText: 'Alpha task' }).count() === 1, 'moved task should leave the inbox (copy stays)')
})

await check('arrow keys move between tasks; Enter opens details with focus; Escape returns focus', async () => {
  await page.mouse.click(700, 700)
  const first = page.locator('.task-title').first()
  await first.focus()
  const firstName = await first.textContent()
  await page.keyboard.press('ArrowDown')
  const second = await active()
  assert(second !== firstName, 'ArrowDown did not move focus')
  await page.keyboard.press('Home')
  assert(await active() === firstName, 'Home did not go to first')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(100)
  assert(await page.evaluate(() => document.activeElement.id) === 'task-detail-title', 'detail title not focused')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  assert(await page.getByRole('complementary', { name: 'Task details' }).count() === 0, 'panel still open')
  assert(await active() === firstName, 'focus not back on the task: ' + await active())
})

await check('Space on a task title completes it', async () => {
  const title = page.locator('.task-title', { hasText: 'Gamma task' })
  await title.focus(); await page.keyboard.press(' ')
  await page.waitForTimeout(700)
  assert(await page.locator('.task-row:not([data-done])', { hasText: 'Gamma task' }).count() === 0, 'not completed')
  await page.keyboard.press('Control+z')
})

await check('palette is a combobox with an active option', async () => {
  await page.mouse.click(700, 700)
  await page.keyboard.press('Control+k')
  const input = page.getByRole('combobox', { name: 'Search commands, views and tasks' })
  await input.waitFor()
  await page.keyboard.type('go to')
  const ad = await input.getAttribute('aria-activedescendant')
  assert(ad && await page.locator(`#${ad}[role=option][aria-selected=true]`).count() === 1, 'no active option')
  await page.keyboard.press('ArrowDown')
  assert(await input.getAttribute('aria-activedescendant') !== ad, 'arrow did not move')
  await page.keyboard.press('Escape')
})

await check('calendar: arrow keys move between days', async () => {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('todos:set-view', { detail: 'calendar' })))
  const today = page.locator('.cal-day[data-today]')
  await today.focus()
  const d0 = Number(await today.getAttribute('data-day'))
  await page.keyboard.press(d0 > 1 ? 'ArrowLeft' : 'ArrowRight')
  const d1 = Number(await page.evaluate(() => document.activeElement.dataset.day))
  assert(Math.abs(d1 - d0) === 1, `moved from ${d0} to ${d1}`)
  await page.keyboard.press('Enter')
  assert(await page.locator('.cal-day[aria-pressed=true]').count() === 1, 'day not selected')
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('todos:set-view', { detail: 'inbox' })))
})

await check('focus mode is a modal dialog; Escape exits', async () => {
  await page.mouse.click(700, 700)
  await page.keyboard.press('f')
  const dlg = page.getByRole('dialog', { name: 'Focus mode' })
  await dlg.waitFor()
  assert((await active()).includes('Done'), 'Done not focused: ' + await active())
  await page.keyboard.press('Escape')
  assert(await dlg.count() === 0, 'still open')
})

await check('restore with a bad file shows a plain warning toast (no alert)', async () => {
  let dialogSeen = false
  page.once('dialog', d => { dialogSeen = true; d.dismiss() })
  await page.setInputFiles('input[type=file]', { name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('not json') })
  const status = page.getByRole('status')
  await page.waitForTimeout(200)
  assert(!dialogSeen, 'alert() was used')
  assert((await status.textContent()).includes('isn’t valid JSON'), 'toast: ' + await status.textContent())
})

// ── Data safety ──────────────────────────────────────────
await check('two tabs stay in sync (BroadcastChannel)', async () => {
  const other = await ctx.newPage()
  await other.goto(BASE)
  await other.getByRole('textbox', { name: 'Quick add task' }).waitFor()
  await page.mouse.click(700, 700)
  await quick.fill('Made in tab one'); await quick.press('Enter')
  await other.locator('.task-title', { hasText: 'Made in tab one' }).waitFor({ timeout: 3000 })
  await other.locator('.task-title', { hasText: 'Made in tab one' }).click({ button: 'right' })
  await other.getByRole('menuitem', { name: /Delete/ }).click()
  await page.locator('.task-title', { hasText: 'Made in tab one' }).waitFor({ state: 'detached', timeout: 3000 })
  await other.close()
})

await check('detail title edits are one undo step; native undo works in the field', async () => {
  await quick.fill('Original name'); await quick.press('Enter')
  await page.locator('.task-title', { hasText: 'Original name' }).click()
  const title = page.locator('#task-detail-title')
  await title.click(); await page.keyboard.press('End')
  await page.keyboard.type(' plus more words', { delay: 30 })
  await page.evaluate(() => document.execCommand('undo'))
  assert(await title.inputValue() !== 'Original name plus more words', 'native undo did nothing in the field')
  await page.keyboard.type(' edited', { delay: 30 })
  await page.waitForTimeout(800) // debounce commit
  await page.getByRole('button', { name: 'Close details' }).click()
  const edited = await page.locator('.task-title', { hasText: 'Original name' }).first().textContent()
  assert(edited !== 'Original name', 'edit not saved: ' + edited)
  await page.locator('.task-title', { hasText: 'Original name' }).first().focus()
  await page.keyboard.press('Control+z')
  await page.locator('.task-title', { hasText: /^Original name$/ }).waitFor({ timeout: 2000 })
})

await check('backup → restore → Undo round trip', async () => {
  await page.mouse.click(700, 700)
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    (async () => { await page.getByRole('button', { name: 'Download and restore' }).click(); await page.getByRole('menuitem', { name: /Download backup/ }).click() })(),
  ])
  const backup = JSON.parse(await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8'))
  assert(backup.format === 'todos-backup' && backup.tasks.length > 0, 'bad backup file')
  assert(dl.suggestedFilename().startsWith('todos-backup-'), 'file name: ' + dl.suggestedFilename())
  const before = await page.locator('.task-title').count()
  const small = { ...backup, tasks: [{ id: 'only', title: 'Only restored task', tags: [], order: 1, createdAt: 1, updatedAt: 1 }] }
  await page.setInputFiles('input[type=file]', { name: 'small.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(small)) })
  await page.locator('.task-title', { hasText: 'Only restored task' }).waitFor({ timeout: 3000 })
  assert(await page.locator('.task-title').count() === 1, 'restore did not replace data')
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await page.locator('.task-title', { hasText: 'Only restored task' }).waitFor({ state: 'detached', timeout: 3000 })
  assert(await page.locator('.task-title').count() === before, 'undo did not bring data back')
})

await check('invalid backup explains the problem and changes nothing', async () => {
  const before = await page.locator('.task-title').count()
  await page.setInputFiles('input[type=file]', { name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ tasks: [{ id: 'a' }] })) })
  await page.waitForTimeout(300)
  assert((await page.getByRole('status').textContent()).includes('Task 1 is missing its title'), 'message: ' + await page.getByRole('status').textContent())
  assert(await page.locator('.task-title').count() === before, 'data changed')
})

await check('deleting a project offers Undo and restores its tasks', async () => {
  await page.getByRole('button', { name: 'Edit project Garden' }).click({ force: true })
  await page.getByRole('button', { name: 'Delete project' }).click()
  await page.waitForTimeout(200); assert((await page.getByRole('status').textContent()).includes('Deleted project “Garden”'), 'toast: ' + await page.getByRole('status').textContent() + ' | dialogs: ' + await page.getByRole('dialog').count())
  assert(await page.getByRole('button', { name: /^Garden/ }).count() === 0, 'project still listed')
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await page.getByRole('button', { name: /^Garden/ }).first().waitFor({ timeout: 2000 })
})

await check('real-keyboard "?" (Shift+/) opens shortcuts; Ctrl+Shift+Z redoes', async () => {
  await page.mouse.click(700, 700)
  await page.keyboard.press('Shift+?')
  await page.getByRole('dialog', { name: 'Keyboard shortcuts' }).waitFor({ timeout: 2000 })
  await page.keyboard.press('Escape')
  await quick.fill('Redo me'); await quick.press('Enter')
  await page.mouse.click(700, 700)
  await page.keyboard.press('Control+z')
  await page.locator('.task-title', { hasText: 'Redo me' }).waitFor({ state: 'detached', timeout: 2000 })
  await page.keyboard.press('Control+Shift+Z')
  await page.locator('.task-title', { hasText: 'Redo me' }).waitFor({ timeout: 2000 })
})

// ── Settings and Help ────────────────────────────────────
await check('settings: tabs work with arrow keys; theme cards apply themes', async () => {
  await page.mouse.click(700, 700)
  await page.keyboard.press('Control+,')
  const dlg = page.getByRole('dialog', { name: 'Settings' })
  await dlg.waitFor()
  assert(await active() === 'Workspace', 'first tab not focused: ' + await active())
  await page.keyboard.press('ArrowDown')
  assert(await dlg.getByRole('tab', { name: 'Appearance' }).getAttribute('aria-selected') === 'true', 'arrow did not switch tab')
  await dlg.getByRole('radio', { name: 'Sepia' }).click()
  await page.waitForFunction(() => document.documentElement.classList.contains('theme-sepia'), null, { timeout: 2000 })
  const previews = await dlg.locator('.theme-mini').count()
  assert(previews >= 4, 'previews: ' + previews)
  // previews render their own colours, not the page's
  const bgs = await dlg.locator('.theme-card .theme-mini').evaluateAll(els => els.map(e => getComputedStyle(e).backgroundColor))
  assert(new Set(bgs).size >= 3, 'previews look identical: ' + bgs.join(' | '))
  await dlg.getByRole('switch', { name: /High contrast/ }).check()
  assert(await page.evaluate(() => document.documentElement.classList.contains('high-contrast')), 'high contrast not applied')
  await dlg.getByRole('switch', { name: /High contrast/ }).uncheck()
  await dlg.getByRole('radio', { name: 'Light' }).click()
})

await check('settings: features and workspace options take effect', async () => {
  const dlg = page.getByRole('dialog', { name: 'Settings' })
  await dlg.getByRole('tab', { name: 'Features' }).click()
  await dlg.getByRole('switch', { name: /Time tracking/ }).uncheck()
  await page.keyboard.press('Escape')
  assert(await page.getByRole('button', { name: 'Start timer' }).count() === 0, 'timer buttons still shown')
  await page.keyboard.press('Control+,')
  await dlg.getByRole('switch', { name: /Time tracking/ }).waitFor().catch(() => {})
  await dlg.getByRole('tab', { name: 'Features' }).click()
  await dlg.getByRole('switch', { name: /Time tracking/ }).check()
  await dlg.getByRole('tab', { name: 'Workspace' }).click()
  await dlg.getByRole('radio', { name: 'Monday' }).click()
  await page.keyboard.press('Escape')
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('todos:set-view', { detail: 'calendar' })))
  assert((await page.locator('.cal th').first().textContent()) === 'Mon', 'week does not start on Monday')
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('todos:set-view', { detail: 'inbox' })))
})

await check('settings → storage: counts, clear completed with Undo', async () => {
  await page.keyboard.press('Control+,')
  const dlg = page.getByRole('dialog', { name: 'Settings' })
  await dlg.getByRole('tab', { name: 'Storage' }).click()
  await dlg.getByText('Everything is stored in this browser').waitFor()
  const clear = dlg.getByRole('button', { name: 'Clear completed' })
  if (await clear.isDisabled()) {
    await page.keyboard.press('Escape')
    await page.locator('.task-row').first().locator('.custom-checkbox').click()
    await page.waitForTimeout(500)
    await page.keyboard.press('Control+,')
    await dlg.getByRole('tab', { name: 'Storage' }).click()
  }
  const total = await page.evaluate(async () => (await new Promise(r => { const q = indexedDB.open('todos-db'); q.onsuccess = () => { const g = q.result.transaction('tasks').objectStore('tasks').count(); g.onsuccess = () => r(g.result) } })))
  await dlg.getByRole('button', { name: 'Clear completed' }).click()
  await page.waitForTimeout(300)
  assert((await page.getByRole('status').textContent()).includes('Cleared'), 'toast: ' + await page.getByRole('status').textContent())
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await page.waitForTimeout(300)
  const after = await page.evaluate(async () => (await new Promise(r => { const q = indexedDB.open('todos-db'); q.onsuccess = () => { const g = q.result.transaction('tasks').objectStore('tasks').count(); g.onsuccess = () => r(g.result) } })))
  assert(after === total, `undo restored ${after} of ${total}`)
  await page.keyboard.press('Escape')
})

await check('help: search filters topics and highlights matches', async () => {
  await page.getByRole('button', { name: 'Help', exact: true }).click()
  const dlg = page.getByRole('dialog', { name: 'Help' })
  await dlg.waitFor()
  const all = await dlg.locator('.help-topic').count()
  await page.keyboard.type('backup')
  await page.waitForTimeout(200)
  const some = await dlg.locator('.help-topic').count()
  assert(some > 0 && some < all, `sections ${some} of ${all}`)
  assert(await dlg.locator('mark').count() > 0, 'no highlight')
  await page.keyboard.type('zzqq')
  await dlg.getByText('No help topics match.').waitFor()
  await page.keyboard.press('Escape')
})

// ── Trash and history ────────────────────────────────────
await check('trash: delete → listed in Trash → restore; delete permanently confirms and offers Undo', async () => {
  await page.mouse.click(700, 700)
  await quick.fill('Throw me away'); await quick.press('Enter')
  const t = page.locator('.task-title', { hasText: 'Throw me away' })
  await t.focus(); await page.keyboard.press('Delete')
  await page.getByRole('button', { name: /^Trash/ }).click()
  await page.getByRole('heading', { level: 1, name: 'Trash' }).waitFor()
  const row = page.locator('.trash-row', { hasText: 'Throw me away' })
  await row.getByRole('button', { name: 'Restore' }).click()
  await row.waitFor({ state: 'detached', timeout: 2000 })
  await page.getByRole('button', { name: /^Inbox/ }).click()
  await page.locator('.task-title', { hasText: 'Throw me away' }).waitFor()
  await page.locator('.task-title', { hasText: 'Throw me away' }).focus(); await page.keyboard.press('Delete')
  await page.getByRole('button', { name: /^Trash/ }).click()
  await page.locator('.trash-row', { hasText: 'Throw me away' }).getByRole('button', { name: 'Delete permanently…' }).click()
  const dlg = page.getByRole('dialog', { name: 'Delete permanently?' })
  await dlg.waitFor()
  assert(await active() === 'Cancel', 'Cancel should be focused first: ' + await active())
  await dlg.getByRole('button', { name: 'Delete permanently' }).click()
  await page.locator('.trash-row', { hasText: 'Throw me away' }).waitFor({ state: 'detached', timeout: 2000 })
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await page.locator('.trash-row', { hasText: 'Throw me away' }).waitFor()
  await page.getByRole('button', { name: /^Inbox/ }).click()
})

await check('history: an edit can be restored from the task’s History', async () => {
  await quick.fill('Versioned task'); await quick.press('Enter')
  await page.locator('.task-title', { hasText: 'Versioned task' }).click()
  const title = page.locator('#task-detail-title')
  await title.fill('Versioned task v2'); await title.blur()
  await page.getByRole('list', { name: 'History' }).getByText('Changed name').waitFor({ timeout: 3000 })
  await page.getByRole('button', { name: /^Restore name from before/ }).first().click()
  await page.waitForFunction(() => document.querySelector('#task-detail-title')?.value === 'Versioned task', null, { timeout: 2000 })
  await page.getByRole('button', { name: 'Close details' }).click()
})

// ── Smart lists ──────────────────────────────────────────
await check('smart lists: save filters as a list, rules apply, sort is per list, delete with Undo', async () => {
  await page.mouse.click(700, 700)
  await quick.fill('Urgent alpha p3'); await quick.press('Enter')
  await quick.fill('Calm beta p1'); await quick.press('Enter')
  await page.getByRole('button', { name: 'Filters' }).click()
  await page.getByRole('combobox', { name: 'Filter by priority' }).selectOption('3')
  await page.getByRole('button', { name: 'Save as smart list…' }).click()
  const dlg = page.getByRole('dialog', { name: 'New smart list' })
  await dlg.waitFor()
  assert(await dlg.getByRole('checkbox', { name: 'High' }).isChecked(), 'priority not prefilled')
  const count = await dlg.getByText(/^Matches \d+ task/).textContent()
  await page.keyboard.type('Top priority')
  await dlg.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('heading', { level: 1, name: 'Top priority' }).waitFor()
  const titles = await page.locator('main ul[aria-label$=" tasks"] > li > .task-row .task-title').allTextContents()
  assert(titles.includes('Urgent alpha') && !titles.includes('Calm beta'), 'rules: ' + titles)
  assert(count === `Matches ${titles.length} task${titles.length === 1 ? '' : 's'}`, `${count} vs ${titles.length}`)
  assert(await page.getByRole('button', { name: /Clear \d filter/ }).count() === 0, 'filters not cleared after saving')
  // per-list sort
  await page.getByRole('button', { name: /^Inbox/ }).click()
  const inboxSort = await page.getByRole('button', { name: /^Sort:/ }).getAttribute('aria-label')
  await page.getByRole('button', { name: /^Top priority/ }).click()
  await page.getByRole('button', { name: /^Sort:/ }).click()
  await page.getByRole('menuitemradio', { name: 'Due date' }).click()
  await page.getByRole('button', { name: /^Inbox/ }).click()
  assert(await page.getByRole('button', { name: /^Sort:/ }).getAttribute('aria-label') === inboxSort, 'list sort leaked to inbox')
  await page.getByRole('button', { name: /^Top priority/ }).click()
  assert(await page.getByRole('button', { name: 'Sort: Due date' }).count() === 1, 'list sort not kept')
  // edit, then delete with undo
  await page.getByRole('button', { name: 'Edit rules' }).click()
  const ed = page.getByRole('dialog', { name: 'Edit smart list' })
  await ed.getByRole('checkbox', { name: 'Low' }).check()
  await ed.getByRole('button', { name: 'Save' }).click()
  await page.locator('.task-title', { hasText: 'Calm beta' }).waitFor()
  await page.getByRole('button', { name: 'Edit rules' }).click()
  await page.getByRole('dialog', { name: 'Edit smart list' }).getByRole('button', { name: 'Delete list' }).click()
  await page.getByRole('heading', { level: 1, name: 'Inbox' }).waitFor()
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await page.getByRole('button', { name: /^Top priority/ }).waitFor()
})

// ── Pomodoro (fake clock) ────────────────────────────────
await check('pomodoro: P starts focus, session ends into a break, break ends, Stats counts it', async () => {
  const pc = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  const p = await pc.newPage()
  await p.clock.install({ time: new Date(2026, 10, 26, 10, 0) })
  await p.addInitScript(() => localStorage.setItem('todos-prefs', JSON.stringify({ pomoWork: 1, pomoShort: 1, pomoLong: 2, pomoLongEvery: 2, pomoSound: false })))
  await p.goto(BASE)
  const q = p.getByRole('textbox', { name: 'Quick add task' })
  await q.waitFor(); await q.fill('Write the report p3'); await q.press('Enter')
  await p.mouse.click(700, 700); await p.keyboard.press('f')
  const pomo = p.getByRole('region', { name: 'Pomodoro timer' })
  await pomo.waitFor()
  assert((await pomo.getByRole('timer').textContent()) === '01:00', 'start clock')
  await p.keyboard.press('p')
  await pomo.getByRole('button', { name: 'Pause' }).waitFor()
  await p.clock.runFor(30000)
  assert((await pomo.getByRole('timer').textContent()) === '00:30', 'after 30s: ' + await pomo.getByRole('timer').textContent())
  await p.clock.runFor(31000)
  await pomo.locator('.pomo-phase', { hasText: 'Short break' }).waitFor()
  assert((await p.getByRole('status').textContent()).includes('Focus session done'), 'toast: ' + await p.getByRole('status').textContent())
  await pomo.getByRole('button', { name: 'Pause' }).waitFor() // break runs on its own
  await p.clock.runFor(61000)
  await pomo.locator('.pomo-phase', { hasText: 'Focus' }).waitFor()
  await pomo.getByRole('button', { name: 'Start focus' }).waitFor()
  await p.keyboard.press('Escape')
  const tracked = await p.evaluate(() => new Promise(r => { const q = indexedDB.open('todos-db'); q.onsuccess = () => { const g = q.result.transaction('tasks').objectStore('tasks').getAll(); g.onsuccess = () => r(g.result.map(t => ({ s: (t.pomodoros || []).length, ms: t.timeTracked, running: t.timerStartedAt }))) } }))
  assert(tracked[0].s === 1 && tracked[0].ms >= 59000 && tracked[0].running == null, 'task record: ' + JSON.stringify(tracked))
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('todos:set-view', { detail: 'stats' })))
  await p.getByText(/Focus sessions this week/).waitFor()
  const tile = await p.getByText(/Focus sessions this week/).locator('..').textContent()
  assert(tile.startsWith('1'), 'stats tile: ' + tile)
  await pc.close()
})

// ── Reminders (fake clock) ───────────────────────────────
// Advance a fake clock in small steps until a condition holds (lets
// timers, IndexedDB callbacks and renders interleave like real time)
const tickUntil = async (page, cond, { step = 250, max = 40 } = {}) => {
  for (let i = 0; i < max; i++) { if (await cond()) return true; await page.clock.runFor(step); await page.waitForTimeout(20) }
  return cond()
}
const statusHas = (page, re) => async () => re.test(await page.getByRole('status').textContent())

await check('reminders: fire with toast + notification, snooze, Done action, missed-while-closed, .ics', async () => {
  const rc = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true })
  await rc.grantPermissions(['notifications'], { origin: BASE })
  const p = await rc.newPage()
  await p.clock.install({ time: new Date(2026, 10, 26, 10, 0) })
  await p.addInitScript(() => { if (!localStorage.getItem('todos-prefs')) localStorage.setItem('todos-prefs', JSON.stringify({ reminders: true })) })
  await p.goto(BASE)
  await p.evaluate(() => navigator.serviceWorker.ready)
  await p.reload() // now controlled by the worker
  const q = p.getByRole('textbox', { name: 'Quick add task' })
  await q.waitFor(); await q.fill('Call the dentist today 10:30am'); await q.press('Enter')
  await p.locator('.task-title', { hasText: 'Call the dentist' }).click()
  await p.getByRole('combobox', { name: 'Reminder' }).selectOption('10')
  await p.getByText(/Reminds you .*10:20/).waitFor()
  // Add to calendar
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Add to calendar' }).click()])
  const ics = await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8')
  assert(ics.includes('SUMMARY:Call the dentist') && ics.includes('DTSTART:20261126T103000') && ics.includes('TRIGGER:-PT10M'), 'ics: ' + ics.slice(0, 300))
  await p.getByRole('button', { name: 'Close details' }).click()
  assert(await p.locator('.task-row', { hasText: 'Call the dentist' }).locator('.task-meta').getByText(/Reminder:/).count() === 1, 'no bell')
  // fire at 10:20
  await p.clock.runFor(21 * 60000)
  assert(await tickUntil(p, statusHas(p, /Reminder: “Call the dentist”/)), 'reminder did not fire at 10:20')
  let notes = []
  await tickUntil(p, async () => {
    notes = await p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map(n => ({ title: n.title, body: n.body, actions: n.actions.map(a => a.action) })))
    return notes.length > 0
  }, { step: 100, max: 60 })
  assert(notes.length === 1 && notes[0].actions.join() === 'done,snooze' && notes[0].body.includes('Call the dentist'), 'notifications: ' + JSON.stringify(notes))
  // snooze from the toast → fires again 10 min later
  await p.getByRole('status').getByRole('button', { name: 'Snooze 10 min' }).click()
  await p.clock.runFor(5 * 60000)
  assert(!(await p.getByRole('status').textContent()).includes('Reminder:'), 'fired too early')
  await p.clock.runFor(6 * 60000)
  assert(await tickUntil(p, statusHas(p, /Reminder: “Call the dentist”/)), 'snoozed reminder did not fire')
  // "Done" from the notification (as the service worker would relay it)
  const id = await p.locator('.task-row', { hasText: 'Call the dentist' }).getAttribute('data-task-id').catch(() => null)
    ?? await p.locator('[data-task-id]', { hasText: 'Call the dentist' }).first().getAttribute('data-task-id')
  await p.evaluate((taskId) => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'REMINDER_ACTION', action: 'done', taskId } })), id)
  await p.locator('.task-row:not([data-done])', { hasText: 'Call the dentist' }).waitFor({ state: 'detached', timeout: 3000 })
  // missed while closed: a reminder at 11:00, app reopened at 12:00
  await q.fill('Water the garden today 11:15am'); await q.press('Enter')
  await p.locator('.task-title', { hasText: 'Water the garden' }).click()
  await p.getByRole('combobox', { name: 'Reminder' }).selectOption('10')
  await p.getByRole('button', { name: 'Close details' }).click()
  const p2 = await rc.newPage()
  await p.close()
  await p2.clock.install({ time: new Date(2026, 10, 26, 12, 0) })
  await p2.goto(BASE)
  await p2.getByRole('status').getByText(/While Todos was closed, a reminder came due: “Water the garden”/).waitFor({ timeout: 5000 })
  await rc.close()
})

// ── Share, export, import ────────────────────────────────
await check('share link: copy, open as someone else, preview, add as a new project', async () => {
  const sc = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  await sc.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const a = await sc.newPage()
  await a.goto(BASE)
  const q = a.getByRole('textbox', { name: 'Quick add task' })
  await q.waitFor()
  await a.getByRole('button', { name: 'New project' }).click(); await a.keyboard.type('Trip; Paris'); await a.getByRole('button', { name: 'Create' }).click()
  await a.getByRole('button', { name: /^Trip; Paris/ }).click()
  await q.fill('Book flights ✈️ !3 tomorrow'); await q.press('Enter')
  await q.fill('Pack bags'); await q.press('Enter')
  await a.locator('.task-title', { hasText: 'Book flights' }).click()
  const sub = a.getByRole('textbox', { name: 'Add subtask' }); await sub.fill('Compare prices'); await sub.press('Enter')
  await a.getByRole('button', { name: 'Close details' }).click()
  // Markdown copy
  await a.getByRole('button', { name: 'Share, export and import' }).click()
  await a.getByRole('menuitem', { name: 'Copy as Markdown' }).click()
  const md = await a.evaluate(() => navigator.clipboard.readText())
  assert(md.startsWith('# Trip; Paris') && md.includes('- [ ] Book flights ✈️') && md.includes('  - [ ] Compare prices'), 'markdown: ' + md)
  // Share link
  await a.getByRole('button', { name: 'Share, export and import' }).click()
  await a.getByRole('menuitem', { name: 'Share this list…' }).click()
  const dlg = a.getByRole('dialog', { name: /^Share “Trip; Paris”/ })
  await dlg.getByText('This link contains 3 tasks').waitFor()
  await a.waitForFunction(() => document.querySelector('#share-url')?.value.includes('#share='))
  await dlg.getByRole('button', { name: 'Copy link' }).click()
  const url = await a.evaluate(() => navigator.clipboard.readText())
  assert(url.startsWith(BASE_ORIGIN()) && url.includes('/#share=z.'), 'url: ' + url.slice(0, 80))
  await sc.close()
  // someone else opens it
  const other = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  const b = await other.newPage()
  await b.goto(url)
  const prev = b.getByRole('dialog', { name: 'Shared with you: “Trip; Paris”' })
  await prev.waitFor()
  assert(new URL(b.url()).hash === '', 'hash left in the address bar')
  assert((await prev.textContent()).includes('Compare prices'), 'subtask missing in preview')
  await prev.getByRole('button', { name: 'Add 3 tasks' }).click()
  await b.getByRole('heading', { level: 1, name: 'Trip; Paris' }).waitFor()
  await b.locator('.task-title', { hasText: 'Book flights ✈️' }).waitFor()
  await b.getByRole('list', { name: /Subtasks of “Book flights/ }).getByText('Compare prices').waitFor()
  // a broken link explains itself
  await b.goto(BASE + '/#share=q.broken')
  await b.getByRole('status').getByText(/Couldn’t open this share link/).waitFor()
  await other.close()
})

await check('import: paste Markdown + todo.txt, preview, skip one, one undo step; drop a file', async () => {
  await page.mouse.click(700, 700)
  await page.getByRole('button', { name: /^Inbox/ }).click()
  const before = await page.locator('.task-title').count()
  await page.getByRole('button', { name: 'Share, export and import' }).click()
  await page.getByRole('menuitem', { name: 'Import tasks…' }).click()
  const dlg = page.getByRole('dialog', { name: 'Import tasks' })
  await dlg.getByRole('textbox', { name: 'Text' }).fill('- [ ] Write intro #writing\n  - [ ] Outline\n- [x] Done already\n- [ ] Skip me')
  await dlg.getByText('Preview · Markdown checklist').waitFor()
  await dlg.getByRole('list', { name: 'Tasks to import' }).getByRole('checkbox').nth(2).uncheck()
  await dlg.getByRole('button', { name: 'Import 3 tasks' }).click()
  await page.locator('.task-title', { hasText: 'Write intro' }).waitFor()
  assert(await page.locator('.task-title', { hasText: 'Skip me' }).count() === 0, 'skipped item imported')
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await page.locator('.task-title', { hasText: 'Write intro' }).waitFor({ state: 'detached', timeout: 3000 })
  assert(await page.locator('.task-title').count() === before, 'undo left tasks behind')
  // drop a todo.txt file
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['(A) Call Mom due:2026-12-02 @phone\nx Pay rent'], 'list.txt', { type: 'text/plain' }))
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
  })
  const d2 = page.getByRole('dialog', { name: 'Import tasks' })
  await d2.getByText('Preview · todo.txt').waitFor()
  await d2.getByText('list.txt').waitFor()
  await d2.getByRole('button', { name: 'Cancel' }).click()
})

// ── On-device AI ─────────────────────────────────────────
await check('suggest subtasks without built-in AI: notice, quick version, one undo step', async () => {
  await page.mouse.click(700, 700)
  await quick.fill('Plan the trip'); await quick.press('Enter')
  await page.locator('.task-title', { hasText: 'Plan the trip' }).click()
  const notes = page.locator('textarea[aria-labelledby="detail-notes-label"]')
  await notes.fill('- Book flights\n- Reserve hotel\n- Pack bags'); await notes.blur()
  await page.getByRole('button', { name: 'Suggest subtasks' }).click()
  const box = page.getByRole('group', { name: 'Suggested subtasks' })
  const avail = await page.evaluate(async () => ('LanguageModel' in self) ? await self.LanguageModel.availability() : 'unsupported')
  if (avail === 'unsupported' || avail === 'unavailable') {
    await box.getByText('Chrome 138 or later').waitFor()
    await box.getByRole('button', { name: 'Use quick version' }).click()
  } else {
    await box.getByRole('button', { name: 'Use quick version' }).click()
  }
  await box.getByRole('checkbox', { name: 'Reserve hotel' }).uncheck()
  await box.getByRole('button', { name: 'Add 2 subtasks' }).click()
  const panel = page.getByRole('complementary', { name: 'Task details' })
  await panel.getByText('Subtasks (2)').waitFor()
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await panel.getByText('Subtasks (0)').waitFor({ timeout: 2000 })
  await page.getByRole('button', { name: 'Close details' }).click()
})

await check('suggest subtasks with on-device AI (mocked): download progress, results, cancel', async () => {
  const aiCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  await aiCtx.addInitScript(() => {
    window.__prompts = []
    self.LanguageModel = {
      availability: async () => 'downloadable',
      create: async ({ monitor, signal }) => {
        const target = new EventTarget()
        monitor?.(target)
        for (const loaded of [0.25, 0.6, 1]) {
          await new Promise(r => setTimeout(r, 250))
          if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
          target.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded }))
        }
        return {
          prompt: async (text, opts) => {
            window.__prompts.push({ text, hasSchema: !!opts?.responseConstraint })
            await new Promise(r => setTimeout(r, 300))
            return JSON.stringify(['Pick a date', 'Invite friends', 'Order food'])
          },
          destroy() {},
        }
      },
    }
  })
  const p = await aiCtx.newPage()
  await p.goto(BASE)
  const q = p.getByRole('textbox', { name: 'Quick add task' })
  await q.waitFor(); await q.fill('Host a dinner party'); await q.press('Enter')
  await p.locator('.task-title', { hasText: 'Host a dinner' }).click()
  await p.getByRole('button', { name: 'Suggest subtasks' }).click()
  const box = p.getByRole('group', { name: 'Suggested subtasks' })
  await box.getByRole('progressbar', { name: 'Model download' }).waitFor()
  await box.getByText(/Downloading the on-device model.*%/).waitFor()
  await box.getByText('Thinking…').waitFor({ timeout: 3000 })
  await box.getByRole('checkbox', { name: 'Invite friends' }).waitFor({ timeout: 3000 })
  assert((await box.textContent()).includes('Nothing is sent anywhere'), 'privacy note missing')
  const prompts = await p.evaluate(() => window.__prompts)
  assert(prompts.length === 1 && prompts[0].hasSchema && prompts[0].text.includes('Host a dinner party'), 'prompt: ' + JSON.stringify(prompts))
  await box.getByRole('button', { name: 'Add 3 subtasks' }).click()
  await p.getByText('Subtasks (3)').waitFor()
  // cancel during download stops the work
  await p.locator('.task-title', { hasText: 'Pick a date' }).click()
  await q.fill('Second task'); await q.press('Enter')
  await p.locator('.task-title', { hasText: 'Second task' }).click()
  await p.getByRole('button', { name: 'Suggest subtasks' }).click()
  await p.getByRole('group', { name: 'Suggested subtasks' }).getByRole('button', { name: 'Cancel' }).click()
  await p.waitForTimeout(1200)
  assert(await p.getByRole('group', { name: 'Suggested subtasks' }).count() === 0, 'still busy after cancel')
  assert((await p.evaluate(() => window.__prompts.length)) === 1, 'prompt ran after cancel')
  // Hide AI features removes the button
  await p.keyboard.press('Control+,')
  await p.getByRole('tab', { name: 'Features' }).click()
  await p.getByRole('switch', { name: /Hide AI features/ }).check()
  await p.keyboard.press('Escape')
  assert(await p.getByRole('button', { name: 'Suggest subtasks' }).count() === 0, 'AI button still shown')
  await aiCtx.close()
})

// ── Phone width ──────────────────────────────────────────
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
phone.on('pageerror', e => errors.push(String(e)))
await phone.goto(BASE)
const pq = phone.getByRole('textbox', { name: 'Quick add task' })
await pq.waitFor()
const noHScroll = () => phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)

await check('phone: sidebar is a drawer; Escape closes it and returns focus', async () => {
  assert(await phone.getByRole('navigation').count() === 0, 'sidebar visible on load')
  const toggle = phone.getByRole('button', { name: 'Show sidebar' })
  await toggle.click()
  const drawer = phone.getByRole('dialog', { name: 'Navigation' })
  await drawer.waitFor()
  assert(await noHScroll(), 'horizontal scroll with drawer open')
  await phone.keyboard.press('Escape')
  assert(await drawer.count() === 0, 'drawer still open')
  assert(await phone.evaluate(() => document.activeElement.getAttribute('aria-label')) === 'Show sidebar', 'focus not returned')
})

await check('phone: choosing a view closes the drawer', async () => {
  await phone.getByRole('button', { name: 'Show sidebar' }).click()
  await phone.getByRole('dialog', { name: 'Navigation' }).getByRole('button', { name: /^Today/ }).click()
  assert(await phone.getByRole('dialog', { name: 'Navigation' }).count() === 0, 'drawer still open')
  assert(await phone.getByRole('heading', { level: 1, name: 'Today' }).count() === 1, 'view not changed')
})

await check('phone: task details open as a full-screen sheet and close', async () => {
  await pq.fill('Phone task today'); await pq.press('Enter')
  await phone.locator('.task-title', { hasText: 'Phone task' }).click()
  const panel = phone.getByRole('complementary', { name: 'Task details' })
  await panel.waitFor()
  const box = await panel.boundingBox()
  assert(Math.round(box.width) === 390, 'sheet width ' + box.width)
  assert(await noHScroll(), 'horizontal scroll with sheet open')
  await panel.getByRole('button', { name: 'Close details' }).click()
  assert(await panel.count() === 0, 'sheet still open')
})

await check('phone: dialogs and menus fit on screen', async () => {
  await phone.getByRole('button', { name: 'Download and restore' }).click()
  const m = await phone.getByRole('menu').boundingBox()
  assert(m.x >= 0 && m.x + m.width <= 390, 'menu off screen')
  await phone.keyboard.press('Escape')
  await phone.getByRole('button', { name: 'Help', exact: true }).click()
  const d = await phone.getByRole('dialog').boundingBox()
  assert(d.x >= 0 && d.x + d.width <= 390, 'dialog off screen')
  assert(await noHScroll(), 'horizontal scroll with dialog')
  await phone.keyboard.press('Escape')
})

await browser.close()
console.log(results.join('\n'))
if (errors.length) console.log('console errors:\n' + errors.join('\n'))
const failed = results.filter(r => r.startsWith('✘')).length + errors.length
console.log(`\n${failed ? failed + ' failure(s)' : 'ALL INTERACTIONS PASSED'}`)
process.exitCode = failed ? 1 : 0
