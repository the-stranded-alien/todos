// ── Keyboard shortcut reference (shared by the sheet and Help)
export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

export const SHORTCUT_GROUPS = [
  { title: 'General', items: [
    [`${MOD}+K`, 'Open the command palette'],
    ['/', 'Search tasks'],
    ['?', 'Show keyboard shortcuts'],
    ['Esc', 'Close the panel, menu or dialog'],
    [`${MOD}+Z`, 'Undo'],
    [`${MOD}+Shift+Z`, 'Redo'],
  ] },
  { title: 'Views', items: [
    ['1', 'Inbox'], ['2', 'Today'], ['3', 'Upcoming'], ['4', 'All tasks'],
    ['F', 'Focus mode'],
  ] },
  { title: 'Tasks', items: [
    ['N', 'Add a task'],
    ['Space', 'Complete the focused task'],
    ['Enter', 'Open the focused task'],
    ['Shift+F10', 'Task actions menu (or right-click)'],
    ['Double-click', 'Rename a task in place'],
  ] },
]

