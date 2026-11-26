// ESLint doesn't catch undefined JSX components. Compare every <Capitalised>
// tag in each file with what the file imports or declares.
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

let bad = 0
for (const f of globSync('src/**/*.jsx')) {
  const src = readFileSync(f, 'utf8')
  const used = new Set([...src.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>.]/g)].map(m => m[1]))
  const known = new Set()
  for (const m of src.matchAll(/import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from/g)) {
    if (m[1]) known.add(m[1])
    for (const part of (m[2] || '').split(',')) { const n = part.trim().split(/\s+as\s+/).pop(); if (n) known.add(n) }
  }
  for (const m of src.matchAll(/(?:const|let|function|class)\s+([A-Z]\w*)/g)) known.add(m[1])
  for (const m of src.matchAll(/(?:const|let)\s*\{([^}]*)\}\s*=/g)) for (const p of m[1].split(',')) { const n = p.trim().split(':').pop().trim(); if (n) known.add(n) }
  for (const m of src.matchAll(/\b([A-Z]\w*)\s*[,}]\s*\)?\s*=>/g)) known.add(m[1])
  for (const m of src.matchAll(/\b\w+:\s*([A-Z]\w*)\s*(?:=\s*[\w.]+\s*)?[,}]/g)) known.add(m[1])  // { icon: Ic = X }
  for (const tag of used) if (!known.has(tag) && !/^[A-Z]\w*\./.test(tag)) { console.log(`${f}: <${tag}> is not imported or declared`); bad++ }
}
// Every name imported from the icon wrapper must be exported by it
const exported = new Set([...readFileSync('src/icons.jsx', 'utf8').matchAll(/export const (\w+)/g)].map(m => m[1]))
for (const f of globSync('src/**/*.jsx')) {
  for (const m of readFileSync(f, 'utf8').matchAll(/import\s*\{([^}]*)\}\s*from\s*'[./]*icons\.jsx'/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0]
      if (name && !exported.has(name)) { console.log(`${f}: '${name}' is not exported by src/icons.jsx`); bad++ }
    }
  }
}
console.log(bad ? `${bad} problem(s)` : 'All JSX tags and icon imports resolve')
process.exitCode = bad ? 1 : 0
