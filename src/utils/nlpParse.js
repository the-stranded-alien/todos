// ── Natural language task input parser ─────────────────────
// Parses "#tag @project p1-p4 !1-!4 date-tokens from title"

import { parseNLDate } from './nlpDate.js'

const DATE_TOKENS = [
  'today','tomorrow','yesterday','monday','tuesday','wednesday',
  'thursday','friday','saturday','sunday',
  'next monday','next tuesday','next wednesday','next thursday',
  'next friday','next saturday','next sunday',
  'this monday','this tuesday','this wednesday','this thursday',
  'this friday','this saturday','this sunday',
  'end of week','eow','end of month','eom',
]

const DATE_TOKEN_RE = /\bin\s+\d+\s+(days?|weeks?|months?)\b/i

export const parseTaskInput = (raw) => {
  let title = raw
  const tags = []
  let projectName = null
  let priority = 0
  let dueDate = null
  let dueTime = null

  // Extract time HH:MM or H:MMam/pm
  title = title.replace(/\b(\d{1,2}):(\d{2})(am|pm)?\b/gi, (match, h, m, ap) => {
    let hour = parseInt(h)
    if (ap?.toLowerCase() === 'pm' && hour < 12) hour += 12
    if (ap?.toLowerCase() === 'am' && hour === 12) hour = 0
    dueTime = `${String(hour).padStart(2,'0')}:${m}`
    return ''
  })

  // Extract priority p1-p4 or !1-!4
  title = title.replace(/\b[p!]([1-4])\b/gi, (match, n) => {
    priority = parseInt(n)
    return ''
  })

  // Extract @project
  title = title.replace(/@([\w-]+)/g, (match, name) => {
    projectName = name
    return ''
  })

  // Extract #tags
  title = title.replace(/#([\w-]+)/g, (match, name) => {
    tags.push(name.toLowerCase())
    return ''
  })

  // Extract date tokens (longest match first)
  const lower = title.toLowerCase()

  // Check multi-word date tokens
  for (const token of DATE_TOKENS) {
    const idx = lower.indexOf(token)
    if (idx !== -1) {
      const parsed = parseNLDate(token)
      if (parsed) {
        dueDate = parsed
        title = title.slice(0, idx) + title.slice(idx + token.length)
        break
      }
    }
  }

  // Check "in N days/weeks/months"
  if (!dueDate) {
    const m = title.match(DATE_TOKEN_RE)
    if (m) {
      const parsed = parseNLDate(m[0])
      if (parsed) {
        dueDate = parsed
        title = title.replace(DATE_TOKEN_RE, '')
      }
    }
  }

  // Clean up extra whitespace
  title = title.replace(/\s{2,}/g, ' ').trim()

  return { title, tags, projectName, priority, dueDate, dueTime }
}
