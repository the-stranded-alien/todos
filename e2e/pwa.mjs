// PWA checks in real Chrome against `vite preview` of the production build:
// manifest + installability, offline reload, update flow, launch URLs.
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
// A real (non-incognito) profile, so installability is judged like a normal window
const profile = mkdtempSync(join(tmpdir(), 'todos-pwa-'))
const ctx = await chromium.launchPersistentContext(profile, { executablePath: CHROME, headless: true, viewport: { width: 1280, height: 860 } })
const page = ctx.pages()[0] ?? await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
const results = []
const check = async (name, fn) => {
  try { await fn(); results.push(`✔ ${name}`) } catch (e) { results.push(`✘ ${name}: ${e.message.split('\n')[0]}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const ready = () => page.getByRole('textbox', { name: 'Quick add task' }).waitFor()

await page.goto(BASE); await ready()

await check('manifest parses cleanly and the app is installable', async () => {
  const cdp = await ctx.newCDPSession(page)
  const m = await cdp.send('Page.getAppManifest')
  assert(m.errors.length === 0, 'manifest errors: ' + JSON.stringify(m.errors))
  const parsed = JSON.parse(m.data)
  assert(parsed.share_target && parsed.shortcuts.length === 2 && parsed.icons.some(i => i.purpose === 'maskable'), 'manifest fields missing')
  // installability needs an active service worker
  await page.evaluate(() => navigator.serviceWorker.ready)
  const inst = await cdp.send('Page.getInstallabilityErrors')
  assert(inst.installabilityErrors.length === 0, 'installability: ' + JSON.stringify(inst.installabilityErrors))
})

await check('service worker controls the page and precaches the build', async () => {
  await page.reload(); await ready()
  const info = await page.evaluate(async () => {
    const keys = await caches.keys()
    const pre = keys.find(k => k.startsWith('todos-precache-'))
    const n = pre ? (await (await caches.open(pre)).keys()).length : 0
    return { controlled: !!navigator.serviceWorker.controller, pre, n }
  })
  const manifest = JSON.parse(readFileSync('dist/precache-manifest.json', 'utf8'))
  assert(info.controlled, 'not controlled')
  assert(info.pre === `todos-precache-${manifest.version}`, 'cache name ' + info.pre)
  assert(info.n === manifest.files.length, `precached ${info.n} of ${manifest.files.length}`)
})

await check('works offline: reload, fonts, add a task', async () => {
  await ctx.setOffline(true)
  await page.reload(); await ready()
  const font = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Inter Variable"') })
  assert(font, 'Inter not available offline')
  const q = page.getByRole('textbox', { name: 'Quick add task' })
  await q.fill('Offline task'); await q.press('Enter')
  await page.locator('.task-title', { hasText: 'Offline task' }).waitFor({ timeout: 2000 })
  await ctx.setOffline(false)
})

await check('a new deploy shows an update notice and drops old caches', async () => {
  await page.evaluate(() => caches.open('todos-v1')) // leftover from the old worker
  const original = readFileSync('dist/sw.js', 'utf8')
  try {
    writeFileSync('dist/sw.js', original.replace(/VERSION = '([a-f0-9]+)'/, "VERSION = 'test-deploy'"))
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update())
    await page.getByRole('status').getByText('Todos was updated').waitFor({ timeout: 8000 })
    assert(await page.getByRole('status').getByRole('button', { name: 'Reload' }).count() === 1, 'no Reload button')
    // controllerchange fires before the new worker's activate cleanup finishes
    let keys = []
    for (let i = 0; i < 30; i++) {
      keys = await page.evaluate(() => caches.keys())
      if (!keys.includes('todos-v1') && keys.filter(k => k.startsWith('todos-precache-')).length === 1) break
      await page.waitForTimeout(100)
    }
    assert(keys.includes('todos-precache-test-deploy'), 'new cache missing: ' + keys)
    assert(!keys.includes('todos-v1') && keys.filter(k => k.startsWith('todos-precache-')).length === 1, 'old caches kept: ' + keys)
  } finally {
    writeFileSync('dist/sw.js', original)
  }
})

await check('manifest shortcuts: ?view=today and ?action=new-task', async () => {
  await page.goto(`${BASE}/?view=today`); await ready()
  await page.getByRole('heading', { level: 1, name: 'Today' }).waitFor()
  assert(new URL(page.url()).search === '', 'URL not cleaned: ' + page.url())
  await page.goto(`${BASE}/?action=new-task`); await ready()
  await page.waitForTimeout(200)
  assert(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Quick add task', 'quick add not focused')
})

await check('share target creates a task from shared content', async () => {
  await page.goto(`${BASE}/share-target?title=${encodeURIComponent('Article to read')}&text=${encodeURIComponent('Worth a look')}&url=${encodeURIComponent('https://example.com/post')}`)
  await ready()
  await page.locator('.task-title', { hasText: 'Article to read' }).waitFor({ timeout: 3000 })
  assert((await page.getByRole('status').textContent()).includes('from a share'), 'no toast')
  const notes = await page.locator('textarea[aria-labelledby="detail-notes-label"]').inputValue()
  assert(notes.includes('Worth a look') && notes.includes('https://example.com/post'), 'notes: ' + notes)
  assert(new URL(page.url()).pathname === '/', 'URL not cleaned: ' + page.url())
})

await ctx.close()
rmSync(profile, { recursive: true, force: true })
console.log(results.join('\n'))
if (errors.length) console.log('page errors:\n' + errors.join('\n'))
const failed = results.filter(r => r.startsWith('✘')).length + errors.length
console.log(failed ? `\n${failed} failure(s)` : '\nALL PWA CHECKS PASSED')
process.exitCode = failed ? 1 : 0
