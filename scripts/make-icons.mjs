// Render the SVG app icons to PNGs with headless Chrome.
// Usage: node scripts/make-icons.mjs
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const jobs = [
  ['public/favicon.svg', 'public/icons/icon-192.png', 192],
  ['public/favicon.svg', 'public/icons/icon-512.png', 512],
  ['public/icons/maskable.svg', 'public/icons/maskable-512.png', 512],
  ['public/icons/maskable.svg', 'public/icons/apple-touch-icon.png', 180],
]
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
for (const [src, out, size] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  const svg = readFileSync(src, 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `)
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
  await page.locator('svg').screenshot({ path: out, omitBackground: true })
  await page.close()
  console.log('wrote', out)
}
await browser.close()
