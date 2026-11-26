// ── Build plugin: precache manifest + versioned service worker ──
// After the bundle is written: list every built file, hash the list,
// write precache-manifest.json, stamp the hash into sw.js, and copy
// index.html to share-target/index.html (the manifest's share target).
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SKIP = new Set(['CNAME', 'sw.js', 'precache-manifest.json'])

const walk = (dir) => readdirSync(dir).flatMap(name => {
  const p = join(dir, name)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

export const pwa = ({ swSrc = 'src/sw.js' } = {}) => {
  let outDir = 'dist'
  return {
    name: 'todos-pwa',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    writeBundle() {
      // share target shell
      mkdirSync(join(outDir, 'share-target'), { recursive: true })
      copyFileSync(join(outDir, 'index.html'), join(outDir, 'share-target', 'index.html'))

      const files = walk(outDir)
        .map(p => relative(outDir, p).split(sep).join('/'))
        .filter(f => !SKIP.has(f) && !f.endsWith('.map'))
        .sort()
      const hash = createHash('sha256')
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)))
      const version = hash.digest('hex').slice(0, 12)
      const urls = ['/', ...files.map(f => `/${f}`)]

      writeFileSync(join(outDir, 'precache-manifest.json'), JSON.stringify({ version, files: urls }, null, 2))
      const sw = readFileSync(swSrc, 'utf8').replaceAll("'__SW_VERSION__'", `'${version}'`)
      if (sw.includes("'__SW_VERSION__'")) throw new Error('sw.js version placeholder was not replaced')
      writeFileSync(join(outDir, 'sw.js'), sw)
    },
  }
}
