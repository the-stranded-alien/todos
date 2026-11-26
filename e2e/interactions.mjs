// Interaction checks in real Chrome: menus, dialogs, tooltips, toasts, undo.
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
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
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).hover()
  await page.waitForTimeout(500)
  const tip = page.getByRole('tooltip')
  assert(await tip.textContent() === 'Keyboard shortcuts (?)', 'tooltip text: ' + await tip.textContent())
  assert(await onScreen('[role=tooltip]'), 'tooltip off screen')
  await page.mouse.down(); await page.mouse.up() // also clicks it: opens the shortcuts dialog
  assert(await page.getByRole('tooltip').count() === 0, 'tooltip still visible')
  await page.getByRole('dialog', { name: 'Keyboard shortcuts' }).waitFor()
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
  assert((await status.textContent()).includes('Deleted “Beta task”'), 'toast text: ' + await status.textContent())
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
  await phone.getByRole('button', { name: 'Keyboard shortcuts' }).click()
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
