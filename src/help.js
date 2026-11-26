// ── Help content (searchable). Uses the same names as the buttons. ──
import { SHORTCUT_GROUPS } from './shortcuts.js'

export const HELP_SECTIONS = [
  {
    id: 'start', title: 'Getting started',
    body: [
      'Type a task in “Add a task…” and press Enter. Press N anywhere to jump there.',
      'Click a task (or press Enter on it) to open its details: due date, priority, project, tags, repeat, notes, subtasks and timer.',
      'Tick the circle (or press Space on a task) to complete it. Completed tasks move to “Completed” and can be reopened.',
    ],
  },
  {
    id: 'quick-add', title: 'Quick-add shortcuts',
    body: [
      'Dates: today, tomorrow, friday, next monday, in 3 days, in 2 weeks, eow (end of week), eom, december 25, 12/31.',
      'Times: 5pm, 9:30am or 17:30.',
      'Priority: p1 (low) … p3 (high), or !1 … !3.',
      'Project: @projectname. Tags: #tagname (the tag must already exist).',
      'Example: “Call the bank tomorrow 4:30pm #finance @home p3”. Chips under the box show what was understood.',
      'Voice: press the microphone to dictate a task (Chrome, Edge, Safari).',
    ],
  },
  {
    id: 'views', title: 'Views',
    body: [
      'Inbox: tasks without a project. Today: due today or overdue. Upcoming: the next 7 days, grouped by date. All tasks, Completed, Calendar and Stats.',
      'Projects and tags in the sidebar filter the list. Drag a task onto a project to move it there.',
      'Use the Filters button for priority, tag, “has due date” and “overdue only”, and the Sort menu for order.',
      'Search (press /) looks through task names and notes.',
    ],
  },
  {
    id: 'tasks', title: 'Editing and organising',
    body: [
      'Rename: double-click a task, press F2, or use Rename in its menu.',
      'Task menu: right-click a task or press Shift+F10 for Open details, Rename, Duplicate, Priority and Delete.',
      'Subtasks: add them in the task’s details. Deleting a task deletes its subtasks too (Undo brings them back).',
      'Repeat: daily, weekly or monthly. Completing a repeating task creates the next one.',
      'Suggest subtasks (in a task’s details) breaks a task into steps with the AI built into Chrome, on your device: nothing is sent anywhere. The first use may download the model. Elsewhere, or while it’s slow, “Use quick version” turns the lines in your notes into steps. Turn it off in Settings → Features → Hide AI features.',
      'Select several tasks with their checkboxes to complete, move, tag or delete them at once.',
      'Drag tasks to reorder them while sorted by “Manual order”.',
    ],
  },
  {
    id: 'focus', title: 'Timers and focus mode',
    body: [
      'Start a timer from a task row or its details; only one runs at a time and it keeps running if you close the app.',
      'Focus mode (press F) shows one task at a time, most important first. Press Done to move on, Esc to leave.',
      'Turn timers off in Settings → Features.',
    ],
  },
  {
    id: 'undo', title: 'Undo and safety',
    body: [
      'Every change can be undone: press Ctrl/⌘+Z (outside text fields) or use Undo in the message at the bottom. Ctrl/⌘+Shift+Z redoes.',
      'Deleting never asks first; it shows Undo instead.',
      'Restoring a backup saves a copy of your current data first. Find saved copies in Settings → Storage.',
    ],
  },
  {
    id: 'data', title: 'Your data and privacy',
    body: [
      'Everything is stored in this browser on this device. There’s no server involved: no account, no uploads, no tracking.',
      'Download backup (from the Download menu or Settings → Storage) saves one .json file. Restore from backup brings it back on any device.',
      'Open the app in two tabs and changes show up in both.',
      'Ask the browser to keep your data permanently in Settings → Storage → Keep my data.',
    ],
  },
  {
    id: 'install', title: 'Install and offline',
    body: [
      'Install Todos as an app from your browser’s address bar or menu (Chrome, Edge; on iPhone use Share → Add to Home Screen).',
      'After the first visit it works offline, including reloads. Changes are saved on the device as you make them.',
      'Installed apps get shortcuts (right-click or long-press the icon): New task and Today.',
      'On Android and ChromeOS you can share a link or text from another app to Todos to turn it into a task.',
      'When a new version is available you’ll see “Todos was updated” with a Reload button.',
      'Focus mode keeps the screen awake while it’s open, and can go full screen.',
    ],
  },
  {
    id: 'appearance', title: 'Themes and display',
    body: [
      'The theme button in the header cycles Light, Dark and Sepia. Settings → Appearance has live previews, more themes, high contrast, density and reduce motion.',
      'The app follows your device’s light/dark setting until you pick a theme.',
    ],
  },
  {
    id: 'shortcuts', title: 'Keyboard shortcuts',
    body: SHORTCUT_GROUPS.flatMap(g => g.items.map(([k, d]) => `${k}: ${d}`)),
  },
]
