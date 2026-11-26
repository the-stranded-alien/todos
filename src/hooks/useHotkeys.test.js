import { describe, it, expect } from 'vitest'
import { matchesHotkey } from './useHotkeys.js'

const ev = (key, mods = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, ...mods })

describe('matchesHotkey', () => {
  it('redo: Ctrl+Shift+Z reports an uppercase key', () => {
    expect(matchesHotkey(ev('Z', { ctrlKey: true, shiftKey: true }), { key: 'z', ctrl: true, shift: true })).toBe(true)
    expect(matchesHotkey(ev('z', { metaKey: true, shiftKey: true }), { key: 'z', ctrl: true, shift: true })).toBe(true)
  })
  it('undo does not fire for redo', () => {
    expect(matchesHotkey(ev('Z', { ctrlKey: true, shiftKey: true }), { key: 'z', ctrl: true })).toBe(false)
  })
  it('"?" matches when typed with Shift (real keyboards)', () => {
    expect(matchesHotkey(ev('?', { shiftKey: true }), { key: '?' })).toBe(true)
    expect(matchesHotkey(ev('?'), { key: '?' })).toBe(true)
  })
  it('plain letters need no modifiers', () => {
    expect(matchesHotkey(ev('n'), { key: 'n' })).toBe(true)
    expect(matchesHotkey(ev('n', { ctrlKey: true }), { key: 'n' })).toBe(false)
    expect(matchesHotkey(ev('F', { shiftKey: true }), { key: 'f' })).toBe(false)
    expect(matchesHotkey(ev('F', { shiftKey: true }), { key: 'F', shift: true })).toBe(true)
  })
  it('named keys respect Shift', () => {
    expect(matchesHotkey(ev('Escape'), { key: 'Escape' })).toBe(true)
    expect(matchesHotkey(ev('Escape', { shiftKey: true }), { key: 'Escape' })).toBe(false)
  })
})
