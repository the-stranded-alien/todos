import { describe, it, expect } from 'vitest'
import { renderMarkdown, safeHref } from './markdown.js'

describe('markdown', () => {
  it('escapes raw HTML', () => {
    expect(renderMarkdown('<img src=x onerror=alert(1)>')).not.toContain('<img')
  })
  it('drops unsafe link schemes', () => {
    const html = renderMarkdown('[click](javascript:alert(1))')
    expect(html).not.toContain('href')
    expect(html).toContain('click')
  })
  it('keeps safe links', () => {
    expect(renderMarkdown('[site](https://example.com)')).toContain('href="https://example.com"')
    expect(safeHref('mailto:a@b.c')).toBe('mailto:a@b.c')
    expect(safeHref('data:text/html,x')).toBeNull()
  })
  it('renders blockquotes and lists', () => {
    expect(renderMarkdown('> quoted')).toContain('<blockquote>quoted</blockquote>')
    expect(renderMarkdown('- a\n- b')).toMatch(/<ul><li>a<\/li>\n<li>b<\/li><\/ul>/)
  })
})
