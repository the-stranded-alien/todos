// ── On-device AI (Chrome built-in Prompt API) ──────────────
// Nothing leaves the device. Always paired with a non-AI fallback.

const SCHEMA = {
  type: 'array',
  items: { type: 'string', minLength: 2, maxLength: 120 },
  minItems: 1,
  maxItems: 8,
}
const LANG = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] }

export const aiSupported = () => typeof globalThis !== 'undefined' && 'LanguageModel' in globalThis

// 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available'
export const aiAvailability = async () => {
  if (!aiSupported()) return 'unsupported'
  try { return await globalThis.LanguageModel.availability(LANG) } catch { return 'unavailable' }
}

// Bigger tasks get more steps (relative to the input size)
export const stepRange = ({ title = '', notes = '' }) => {
  const words = `${title} ${notes}`.trim().split(/\s+/).filter(Boolean).length
  if (words < 8) return [3, 4]
  if (words < 40) return [3, 6]
  return [4, 8]
}

// Accept a JSON array, or fall back to one item per line
export const parseSteps = (text) => {
  let items
  try {
    const v = JSON.parse(text)
    items = Array.isArray(v) ? v : Array.isArray(v?.subtasks) ? v.subtasks : null
  } catch { /* not JSON */ }
  if (!items) items = String(text).split('\n')
  return cleanSteps(items)
}

const cleanSteps = (items) => {
  const seen = new Set()
  return items
    .map(s => String(s).replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s*/, '').trim().replace(/[.;,!?]+$/, ''))
    .filter(s => s.length > 1 && s.length <= 160)
    .filter(s => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
    .slice(0, 8)
}

// Non-AI fallback: list items or lines in the notes, else sentences,
// else the parts of a title joined by "and" / commas.
export const quickSteps = ({ title = '', notes = '' }) => {
  const lines = notes.split('\n').map(l => l.trim()).filter(Boolean)
  const listy = lines.filter(l => /^(?:[-*•]|\d+[.)]|\[[ xX]?\])\s+/.test(l))
  if (listy.length >= 2) return cleanSteps(listy)
  if (lines.length >= 2) return cleanSteps(lines)
  const sentences = notes.split(/(?<=[.;!?])\s+/).map(s => s.trim()).filter(s => s.length > 3)
  if (sentences.length >= 2) return cleanSteps(sentences)
  const parts = title.split(/\s*(?:,|;|\band then\b|\bthen\b|\band\b)\s*/i).filter(p => p.length > 2)
  if (parts.length >= 2) return cleanSteps(parts.map(p => p[0].toUpperCase() + p.slice(1)))
  return []
}

// AI suggestions. onProgress(0..1) while the model downloads the first time.
export const aiSteps = async ({ title, notes }, { signal, onProgress } = {}) => {
  const [min, max] = stepRange({ title, notes })
  const session = await globalThis.LanguageModel.create({
    ...LANG,
    signal,
    monitor(m) { m.addEventListener('downloadprogress', e => onProgress?.(e.loaded)) },
    initialPrompts: [{
      role: 'system',
      content: 'You break a to-do item into short, concrete, actionable subtasks. Each subtask starts with a verb, is under 10 words, and has no numbering. Reply with a JSON array of strings only.',
    }],
  })
  try {
    const out = await session.prompt(
      `Task: ${title}\nNotes: ${notes?.trim() || '(none)'}\n\nGive ${min} to ${max} subtasks, in the order they should be done.`,
      { signal, responseConstraint: SCHEMA },
    )
    return parseSteps(out)
  } finally {
    session.destroy?.()
  }
}
