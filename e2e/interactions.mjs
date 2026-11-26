// Interaction checks in real Chrome: menus, dialogs, tooltips, toasts, undo.
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
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
  const row = page.locator('[role=row]', { hasText: 'Beta task' })
  await row.focus(); await page.keyboard.press('Shift+F10')
  await page.getByRole('menu').waitFor()
  assert(await onScreen('[role=menu]'), 'context menu off screen')
  await page.getByRole('menuitem', { name: /Delete/ }).click()
  await page.waitForTimeout(200)
  assert(await page.locator('[role=row]', { hasText: 'Beta task' }).count() === 0, 'not deleted')
  const status = page.getByRole('status')
  assert((await status.textContent()).includes('Deleted “Beta task”'), 'toast text: ' + await status.textContent())
  await status.getByRole('button', { name: 'Undo' }).click()
  await page.locator('[role=row]', { hasText: 'Beta task' }).waitFor({ timeout: 2000 })
})

await check('right-click menu duplicates a task', async () => {
  await page.locator('[role=row]', { hasText: 'Alpha task' }).first().click({ button: 'right', timeout: 4000 })
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await page.locator('[role=row]', { hasText: 'Alpha task (copy)' }).waitFor({ timeout: 2000 })
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
  assert(await active() === 'Command search', 'focus: ' + await active())
  await page.keyboard.press('Escape')
  assert(await page.getByRole('dialog').count() === 0, 'still open')
})

await check('nested: Escape in project dialog leaves the detail panel open', async () => {
  await page.locator('[role=row]', { hasText: 'Gamma task' }).click()
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
  await page.locator('[role=row]', { hasText: 'Alpha task' }).first().hover()
  await page.getByRole('checkbox', { name: /Select Alpha task/ }).first().check()
  await page.getByRole('button', { name: 'Move to project' }).click()
  await page.getByRole('menu').waitFor()
  assert(await onScreen('[role=menu]'), 'off screen')
  await page.getByRole('menuitem', { name: 'Garden' }).click()
  await page.getByRole('toolbar').waitFor({ state: 'detached', timeout: 2000 })
  assert(await page.locator('[role=row]', { hasText: 'Alpha task' }).count() === 1, 'moved task should leave the inbox (copy stays)')
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

await browser.close()
console.log(results.join('\n'))
if (errors.length) console.log('console errors:\n' + errors.join('\n'))
const failed = results.filter(r => r.startsWith('✘')).length + errors.length
console.log(`\n${failed ? failed + ' failure(s)' : 'ALL INTERACTIONS PASSED'}`)
process.exitCode = failed ? 1 : 0
