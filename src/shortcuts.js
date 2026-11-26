// ── Keyboard shortcut reference (shared by the sheet and Help)
export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

export const SHORTCUT_GROUPS = [
  { title: 'General', items: [
    [`${MOD}+K`, 'Open the command palette'],
    ['/', 'Search tasks'],
    [`${MOD}+,`, 'Open settings'],
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
    ['↑ ↓', 'Move between tasks'],
    ['Enter', 'Open the focused task'],
    ['Space', 'Complete the focused task'],
    ['F2', 'Rename the focused task'],
    ['Delete', 'Delete the focused task (with Undo)'],
    ['Shift+F10', 'Task menu (or right-click)'],
  ] },
  { title: 'Board', items: [
    ['← → ↑ ↓', 'Move between cards'],
    ['Alt+← / Alt+→', 'Move the card to the next column'],
  ] },
  { title: 'Calendar', items: [
    ['← → ↑ ↓', 'Move between days'],
    ['Enter', 'Show the day’s tasks'],
  ] },
]
