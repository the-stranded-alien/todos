// ── Tiny markdown renderer for task notes ──────────────────
// Escapes HTML first, then applies a small set of rules.
// Links are only kept when they use a safe scheme.

const SAFE_URL = /^(https?:|mailto:)/i

export const safeHref = (url) => {
  const u = String(url).trim()
  return SAFE_URL.test(u) ? u : null
}

export const renderMarkdown = (text) => {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (m, label, url) => {
      const href = safeHref(url.replace(/&amp;/g, '&'))
      return href ? `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${label}</a>` : label
    })
    .replace(/^(?!<(?:h\d|hr|ul|li|blockquote)|$)(.+)$/gm, '<p>$1</p>')
}
