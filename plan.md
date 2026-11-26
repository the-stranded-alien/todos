# Todos — Guidelines Upgrade Plan

Bring the Todos app (React 19 + Vite, IndexedDB, GitHub Pages at `todos.guptasahil.in`) up to the **Client-Side Tool Guidelines** used for ReadMe.

Work happens in small batches. After each batch: `eslint .` clean → `vitest run` passes → `vite build` succeeds → real-Chrome check (Playwright + axe) → status updated here → commit → push to `main` (which deploys).

**Legend:** ⬜ todo · 🔄 in progress · ✅ done · ⏭️ skipped (with reason)

---

## Current state (audit, 2026-11-26)

| Area | Today | Gap vs guidelines |
|---|---|---|
| Tooling | No ESLint, no tests; CI only builds | §2: ESLint 9 + react-hooks v7, Vitest + jsdom + Testing Library, CI gate |
| Tokens | Partial token set; many hard-coded colours (`#fff`, `#ef4444`, `#10b981`, priority hexes, `rgba(0,0,0,.5)` backdrops) | §3: tokens only; `--text-4` (`#a0a5c0` on white ≈ 2.4:1) fails 4.5:1 |
| Themes | Light/Dark toggle only | §4: `themes.js`, Light/Dark/Sepia + optional set, high contrast, view transitions, density |
| Icons | `lucide-react` imported directly in every file | §5: IconPark through one `icons.jsx` wrapper, token-mapped colours |
| Components | Ad-hoc modals/menus; `alert()`; confirm dialog for delete; `title=` tooltips | §6: shared Dialog + `useDialogKeys`, keyboard menus, CSS tooltips, toast with Undo, shared EmptyState |
| A11y | `role="row"` without grid, nested buttons in tag rows, no `aria-current`, palette not a combobox, no live regions | §8: zero axe violations in every theme |
| Layout | Fixed 240px sidebar + 320px detail; breaks at phone width | §7: 3-column header grid, no horizontal scroll at 390px, reduced motion |
| Data | Import wipes everything with no snapshot; no undo for uncomplete/project/tag delete; no cross-tab sync; raw `localStorage` | §1/§9: never lose data, backups validated, BroadcastChannel, `try/catch` storage, persistent storage |
| PWA | No manifest; SW is cache-first for `index.html` (stale deploys), not versioned per build; SW registered in dev | §10: manifest, build-generated precache, versioned caches, share target, unregister in dev |
| Settings/Help | Shortcuts sheet only | §6: Settings dialog (Workspace, Appearance, Features, Storage, About), searchable Help |

### Pre-existing bugs found during audit (to fix in the batches noted)

1. **Timezone bug** — "today" is computed with `toISOString()` (UTC), so in IST before 05:30 the app thinks it's yesterday. Affects Today/Upcoming/overdue/calendar/quick-add. → Batch 1
2. **Ctrl/⌘+Z hijacks text undo** — the global undo hotkey runs inside inputs, so native undo in text fields never works. → Batch 1
3. **Undo spam from the detail panel** — every keystroke in the title/notes creates an IndexedDB history entry and an undo step. → Batch 7
4. **Deleting a parent orphans its subtasks** (they stay in IndexedDB, invisible). → Batch 7
5. **Shortcuts sheet lists Tab / Shift+Tab indent**, which isn't implemented. → Batch 4 (implement or remove)
6. **`F` hotkey**: the `Shift+F` entry can never match (requires `shift: false` with key `F`). → Batch 1
7. **Notes markdown links accept `javascript:` URLs** (imported JSON could carry one). → Batch 1
8. **SW serves cached `index.html` forever** → users may not get new deploys. → Batch 9
9. **`uncompleteTask` isn't undoable.** → Batch 7

---

## Batches

### Batch 1 — Tooling, safety net, quick bug fixes ✅
- [x] ESLint 9 flat config (`@eslint/js`, `eslint-plugin-react-hooks` v7, `eslint-plugin-react-refresh`, `globals`); `lint` script; fix all findings
- [x] Vitest + jsdom + Testing Library + `jest-dom` + `fake-indexeddb`; `test` script; setup file
- [x] Unit tests: `nlpDate`, `nlpParse`, local-date helper, markdown sanitiser
- [x] Smoke test rendering `<App/>` against fake IndexedDB (add a task through the quick-add box)
- [x] CI: run `lint` and `test` before `build`
- [x] Local date helper `todayISO()` / `toLocalISO()` used everywhere (bug 1)
- [x] Global undo/redo hotkeys don't fire inside text fields (bug 2)
- [x] Fix `Shift+F` focus-mode hotkey (bug 6)
- [x] Markdown renderer only allows `http(s):`/`mailto:` links (bug 7)
- [x] Unregister service worker in dev (§10)
- [x] Wrap every `localStorage` access in `try/catch` via `utils/storage.js`
- [x] Browser check script (`e2e/`) driving real Chrome via `playwright-core` + `axe-core` — baseline run
- **Notes:** ESLint found 26 problems (incl. `startTimer` calling `stopTimer` before declaration with a stale closure); all fixed. 27 unit/app tests. CI now runs on Node 24 (Vitest 5/jsdom need ≥ 22) and gates deploy on lint + tests. Sidebar project rows had dead drag code; dropping a task on a project now moves it. Blockquotes in notes never rendered (`>` was escaped before matching) — fixed in the new renderer.
- **Baseline browser run (before Batches 2–6):** 78 problems — `color-contrast` ×28, `aria-required-children`/`-parent` ×20 each (task rows use `role="row"`), `page-has-heading-one` ×8 (calendar, stats), `scrollable-region-focusable` ×2. At 390px the sidebar covers the content and rows are clipped (body overflow hidden, so it's not "horizontal scroll" — Batch 6 adds a clipping check).

### Batch 2 — Design tokens and themes ✅
- [x] Full token set per §3 (surfaces, lines, 4 text tiers, accent set, elevation, `--icon-hover-*`), plus semantic tokens: `--danger`, `--success`, `--warning`, `--info`, `--on-accent`, `--backdrop`, `--prio-1..3`
- [x] Fix `--text-4` contrast in every theme (≥ 4.5:1 on every surface)
- [x] Remove hard-coded colours from components (user-chosen project/tag colours stay data, rendered with `color-mix`)
- [x] `src/themes.js` (`THEMES`, `themeClasses`, `ALL_THEME_CLASSES`, `availableThemes`, `nextTheme`)
- [x] Base: Light, Dark, Sepia. Optional ("Additional themes" setting): Ocean, Forest, Nord, Monokai, Solarized, Sun, Neon Pink / Blue / Green / Purple / Rainbow (`theme-neon` family, `--neon-1..6`, `--rainbow`)
- [x] `html.high-contrast` works with every theme
- [x] `data-density="comfortable|compact"` on the app shell
- [x] Theme switch uses View Transitions + `flushSync`, skipped with reduced motion; header button cycles themes with a per-theme icon
- [x] Logo tile uses `--logo-bg`; high contrast keeps it readable
- [x] Pre-paint script in `index.html` applies the stored theme (no flash)
- [x] Global `prefers-reduced-motion` handling for animations
- **Notes:** Old `--text-4` was 2.4:1; new tiers pass everywhere. `e2e/contrast.mjs` checks 9 text tokens × 5 surfaces (incl. tinted selected rows) + text-on-accent in 14 themes × high contrast: **0 failing pairs** (first run had 50, mostly accent-on-tint). Axe sweep over all 28 variants × 7 views: **0 `color-contrast`** (baseline 28). User-chosen project/tag colours stay data and render through `tint()`/`ink()` so labels stay readable. Header theme button cycles with a per-theme icon (still Lucide until Batch 3); appearance commands are in the palette until Settings lands (Batch 8). Prefs live in `todos-prefs`; the old `theme` key is migrated. Rainbow/gradient `--frame` used on the focus-mode card. Verified in Chrome: cycling, reload persistence, no console errors.

### Batch 3 — Icons ✅
- [x] Add `@icon-park/react`; `src/icons.jsx` wrapper (`make()`, slot colours, `IconStyleContext`, size → style, `aria-hidden` by default)
- [x] Icon CSS mapping slots to theme tokens, dark three-tone `--ip-body`, wrapper guard `.i-icon.ip`
- [x] Replace every `lucide-react` import; remove `lucide-react`
- [x] Same action ⇒ same icon everywhere; per-feature `--feat` hues
- [x] Script check: every `<Capitalised>` JSX tag is imported/declared; browser scan for unmapped `rgb(10, 11, 1–4)` fills
- **Notes:** `src/icons.jsx` exports the app's existing names (e.g. `ChevronDown` → IconPark `Down`), so components changed only their import path; `lucide-react` removed. Project icons are a shared `PROJECT_ICONS` map (Sidebar and ProjectEditor had separate copies). Pre-existing bug fixed: the Stats nav item showed a folder icon because `BarChart3` was missing from the sidebar map. Icon tiles were taller than wide (inline icon on a text line box) — fixed. `e2e/jsx-tags.mjs` checks every JSX tag resolves; the sweep now scans for unmapped `rgb(10, 11, 1–4)` and stretched wrappers: **0 problems** in light, dark, sepia+hc, neon, dark+hc. Feature hues: danger (delete), success (complete, export), warning (timer). JS bundle +39 kB (34.6 kB gzip total app code).

### Batch 4 — Shared components and interaction patterns ✅
- [x] `useDialogKeys` + `Dialog` (`role="dialog"`, `aria-modal`, `aria-labelledby`, backdrop mouse-down closes, Escape, focus once, focus return)
- [x] Port ProjectEditor, TagEditor, ShortcutsHelp, ConfirmDelete, CommandPalette to `Dialog`
- [x] `Menu` (`role="menu"`/`menuitem`, arrows, Escape returns focus, outside click) — used by header Download ▾, sort menu, bulk pickers
- [x] Icon buttons: round hover in square hit area (≥ 28px), danger variant, CSS `data-tooltip` (+ `tooltip-start`/`tooltip-end`, hidden while its menu is open); every icon-only button gets `aria-label` + tooltip with the same words
- [x] Toast system (`role="status"`, tones, duration, optional **Undo** action); replace `alert()`
- [x] Shared `EmptyState` (icon, title, one sentence)
- [x] Shortcuts sheet grouped by area; Tab / Shift+Tab entries **removed** (bug 5) — hijacking Tab on rows would break keyboard navigation
- [x] Task row context menu (right-click / Shift+F10 / Menu key): Open details, Rename, Duplicate, Priority, Delete (danger, last, with Undo). "Move to…" stays in the bulk bar
- **Notes:** New primitives in `src/components/ui/` (Dialog, Menu/MenuButton/ContextMenu, IconButton, Toaster, TooltipLayer, EmptyState) and `useDialogKeys` with a dialog stack, so Escape closes only the top dialog. One portal tooltip layer serves every `[data-tooltip]`, so tooltips are never clipped by the scrolling sidebar. Rows: Enter opens, Delete deletes with Undo. `e2e/interactions.mjs` (13 real-Chrome checks: keyboard menus, focus return, outside click, nested Escape, backdrop close, tooltip timing, toast Undo, native text undo, no `alert()`) — **all pass**. Pre-existing bug found by these checks: QuickAdd refocused its input after the async save and stole focus if you'd moved on; fixed. Sidebar rows restructured (a row containing a main button and an edit button), which pulls part of Batch 5 forward. `e2e/jsx-tags.mjs` now also checks that every name imported from `icons.jsx` exists.

### Batch 5 — Accessibility ✅
- [x] Landmarks: `header`, `nav aria-label="Views, projects and tags"`, `main`, `aside aria-label="Task details"`; `role="search"` on the search box; one `h1` per view
- [x] Sidebar: `aria-current="page"` on the active view, project and tag; rows are a `div` with a main button + edit button
- [x] Task list: list semantics (`ul`/`li`, nested `ul` for subtasks, `h2` per date group); the title is a real button with due date/priority/tags as its description; ↑/↓/Home/End move focus, Enter opens the detail panel *with focus*, Escape returns focus to the task, Space completes, Delete deletes (Undo), F2 renames, Shift+F10 menu
- [x] Command palette: combobox pattern (`role="combobox"`, `aria-controls`, `aria-expanded`, `aria-activedescendant`, `listbox`/`option`, `aria-selected`), scroll active into view
- [x] `aria-pressed` on toggles, live region for counts/timer status, labels for every input/select
- [x] Visible `:focus-visible` rings on all controls
- [x] axe: zero violations in every view × base themes (+ high contrast)
- **Also done:** calendar rebuilt as a real `<table>` (column headers, one button per day with arrow-key movement, `aria-current="date"` on today); focus mode is a modal dialog; detail-panel fields are grouped and labelled, the tag picker is keyboard-usable; Escape now works from inside detail-panel fields; stats ring and weekly chart have text alternatives.
- **Pre-existing bugs fixed:** the palette's highlighted row and the row Enter ran could disagree (grouped vs flat order); "Most productive day: Sun" was shown with no completions.
- **Verified:** the axe sweep now also covers 8 open states (detail panel, filters, palette, shortcuts, project dialog, header menu, context menu, focus mode). **0 violations in all 28 theme variants (14 themes ± high contrast) × 7 views + 8 states** at 1280px (baseline was 78 in just 2 themes). 18/18 interaction checks pass (5 new: arrow keys, focus in/out of the detail panel, Space completes, combobox active option, calendar arrow keys, focus-mode dialog). Menus are portalled into `<main>` so they sit inside a landmark.

### Batch 6 — Layout and responsiveness ✅
- [x] Header as 3-column grid (`auto | minmax(0,1fr) | auto`); check 1280 / 1100 / 900 / 390px for overlap
- [x] ≤ 768px: sidebar becomes an overlay drawer; detail panel becomes a full-screen sheet
- [x] No horizontal page scroll at 390px in every view (calendar, stats, list)
- [x] Menus/dialogs stay inside the viewport at every width
- [x] Motion ≤ 320ms; reduced motion respected everywhere (incl. smooth scroll, pulsing dots)
- [x] `no-print` on chrome + a clean print style for task lists
- **Notes:** The sweep now flags anything sticking out past the viewport or cut off by a clipping parent, plus overlapping header groups. Run first, that found what the baseline missed: list headers, calendar toolbar and stats cards running off-screen at 390px. After the change: **0 problems at 1280 / 1100 / 900 / 390** in light, dark, sepia+hc, neon-rainbow and dark+hc, including all open states (detail sheet, drawer, palette, dialogs, menus, focus mode). Narrow screens use a separate `drawerOpen` state (no resize effects); the desktop sidebar preference is untouched. On phones, opening a task moves focus to the sheet heading, not the title field, so the on-screen keyboard doesn't pop up. 4 new phone interaction checks; 22/22 pass. All animations ≤ 300ms (the only longer ones are the decorative timer/mic pulses, switched off under reduced motion). Also fixed: the sidebar toggle showed a permanent hover circle (the "expanded" style is now limited to menu triggers).

### Batch 7 — Never lose data ✅
- [x] Delete task → toast with **Undo** (no confirm dialog); deletes subtasks with the parent and restores them on undo (bug 4)
- [x] Project/tag delete (new: there was no way to delete them at all) → Undo restores the project/tag and every task reassignment
- [x] Uncomplete is undoable (bug 9)
- [x] Detail-panel title/notes edits: debounced commit (one history + one undo step per editing burst) (bug 3)
- [x] Bulk delete/complete/move → single Undo step for the whole batch
- [x] Backup = JSON with `format`/`version` manifest + settings; restore validates and says plainly what's wrong; automatic snapshot of current data before restore, with Undo
- [x] Cross-tab sync via `BroadcastChannel` (ignore own messages, echo suppression)
- [x] `navigator.storage.persist()` request + `estimate()` helpers, with a palette command and a plain explanation when refused; the Settings → Storage panel itself comes in Batch 8
- **Notes:** The store now reads the current record from IndexedDB in every action, not from a render closure (stale-state bugs in bulk loops and debounced edits). Multi-step actions are one undo step (`grouped`); rapid edits to one field coalesce. DB schema v2 adds a `snapshots` store (upgrade-safe; keeps the last 5); restore saves "Before restoring a backup" first, and its toast offers Undo. Detail title/notes use `DraftText`: a local draft committed after 600ms idle or on blur, flushed on unmount, so native undo works inside the field. Cross-tab: every write announces on `BroadcastChannel`; other tabs reload from IndexedDB (own messages ignored, bursts collapsed). The confirm-before-delete dialog was removed: deletes are immediate with Undo, as the guidelines prefer.
- **Pre-existing bugs fixed:** undoing *complete* on a recurring task left the auto-created next occurrence behind (duplicate); deleting a parent orphaned its subtasks (bug 4); uncomplete wasn't undoable (bug 9); **redo (Ctrl/⌘+Shift+Z) never worked** (Shift makes `e.key` uppercase); **`?` didn't open shortcuts on real keyboards** (it needs Shift). Undo/redo hotkeys now confirm with a toast.
- **Verified:** 55 unit tests (+8 store data-safety tests, +11 backup validation, +5 hotkey matching). 28/28 real-Chrome interaction checks (+6: two-tab sync, title edits as one undo step with native in-field undo, backup → restore → Undo round trip with a real download, invalid backup changes nothing, project delete → Undo, real-keyboard `?` and redo). Axe/clipping sweep 0 at 1280 + 390; contrast audit 0.

### Batch 8 — Settings and Help ✅
- [x] Settings dialog with side nav (vertical tabs, arrow keys): Workspace (open-on view, week start), Appearance (theme picker with **live mini previews**, additional themes, high contrast, density, reduce motion), Features (voice input, time tracking, due-time reminders), Storage (usage meter, persistent storage, backup/restore, saved copies, clear completed with Undo), About (privacy: "No server involved", version, build date). "Hide AI features" moves to Batch 10 with the AI feature itself
- [x] `role="switch"` toggles with label + one-line description
- [x] Help dialog: sectioned how-to (quick-add syntax, views, timers, focus mode, shortcuts, data/privacy) with search
- [x] Header: Help and Settings buttons (Ctrl/⌘+, opens Settings); Download ▾ menu (Download backup, Export CSV, Restore…)
- [x] Command palette gets commands for every setting, theme, and help
- **Notes:** Live previews work because the token block also applies to `.theme-scope`, so each preview resets the full token set locally and its theme classes apply on top (verified: every card renders in its own colours, and high contrast shows through). Week start affects the calendar columns and the stats week. "Reduce motion" sets `data-motion="reduce"` (the same rules as the OS setting) and skips View Transitions. Reminders request permission only from the switch and explain if they're blocked. Backup logic now lives in one `useBackup` hook shared by the header and Settings. Restoring a saved copy also snapshots first and offers Undo.
- **Verified:** 32/32 interaction checks (+4: Settings tabs and theme cards, features/workspace options take effect, Storage clear-completed → Undo restores the exact count in IndexedDB, Help search and highlight). Axe now also covers all 5 Settings tabs and Help: **0 problems** at 1280 and 390 in light and dark+hc (found and fixed: two unnamed search landmarks, and Help topics creating a duplicate "Views" landmark). Contrast audit 0.

### Batch 9 — PWA and browser platform ✅
- [x] `manifest.webmanifest` (`id`, `scope`, `display: standalone`, `theme_color`, SVG + PNG icons, shortcuts: New task, Today)
- [x] Vite plugin emits `precache-manifest.json` with hashed assets; SW precaches it with a versioned cache name, deletes old caches, `skipWaiting` + `clients.claim`
- [x] Network-first for navigations (fixes bug 8), cache-first for hashed assets
- [x] `share_target` (GET with `title`/`text`/`url` → `/share-target`, served by a copy of the shell) → creates a task from shared content, with Undo
- [x] "Update available" toast when a new SW takes over
- [x] Wake Lock in focus mode (re-acquire on `visibilitychange`); fullscreen toggle in focus mode
- [x] Notifications: feature-detected, explained in Settings, permission requested from a click only (done in Batch 8; reminders now gated on that switch)
- **Also done:** Inter is self-hosted (`@fontsource-variable/inter`) instead of loaded from Google Fonts. That request sent each visitor's IP to a third party and broke the font offline; now the font is precached and nothing leaves the browser. App icons (192/512/maskable/Apple) are generated from the SVG by `scripts/make-icons.mjs`. Launch URLs (`?view=`, `?action=new-task`, `?task=` from notification clicks) are handled once and then removed from the address bar.
- **Bugs found while verifying:** the build plugin replaced only the first `__SW_VERSION__` (which was in a comment), so every deploy would have shipped an identical worker; it now replaces the quoted constant and fails the build if the placeholder survives. The manifest's share target needed an explicit `enctype`.
- **Migration:** existing installs run the old cache-first worker (bug 8). Their old page still registers `/sw.js`, which browsers fetch from the network, so the new worker installs, deletes `todos-v1`, and shows "Todos was updated — Reload".
- **Verified (`e2e/pwa.mjs`, real Chrome profile):** manifest has **0 parse errors** and **0 installability errors** (via DevTools Protocol); the worker controls the page and precaches every file in `precache-manifest.json`; **offline reload works**, including the font and adding a task; a simulated new deploy shows the update toast with Reload and deletes old caches (incl. the v1 `todos-v1`); manifest shortcuts and the share target work and clean the URL. Regression: 55 tests, 32/32 interactions, axe sweep 0, contrast 0.

### Batch 10 — On-device AI (optional, feature-detected) ✅
- [x] "Suggest subtasks" in the detail panel via Chrome `LanguageModel` (Prompt API): `availability()`, first-run download progress, `AbortController` (Cancel, and leaving the task cancels), JSON schema `responseConstraint`, step count scaled to the input size, results as a checklist you choose from, added as **one undo step**
- [x] Non-AI fallback ("Use quick version": list items or lines in the notes, then sentences, then a compound title), offered when AI is unsupported, while downloading, while thinking, and after errors
- [x] "Unsupported" notice with requirements instead of hiding silently; "Hide AI features" switch removes every AI button
- [x] UI says "Runs on your device — nothing is sent anywhere"
- [x] Settings → Features: "Hide AI features" switch (moved here from Batch 8)
- **Verified:** 8 unit tests for the fallback and output parsing. In real Chrome 158 (headless), `LanguageModel` exists but reports `unavailable` (no model on this machine), so the browser check covered the requirements notice → quick version → pick 2 of 3 → one Undo removes both. A second check **mocks `LanguageModel`** to cover the first-run download (progress bar and %), "Thinking…", the privacy line, a prompt that includes the task and a schema, adding 3, Cancel during the download (no prompt runs afterwards), and "Hide AI features" removing the button. Axe 0 with the panel open at 1280 and 390. **Not verified:** a real model download and answer, which needs desktop Chrome with the model installed — please try it once on your machine.

### Batch 11 — Final verification sweep ✅
- [x] Browser sweep: every view × every theme × high contrast — axe, console errors, icon scan, horizontal scroll / off-screen controls, header overlap — at 1280 (28 variants × 7 views + 17 open states) and 390 (28 variants); 1100 and 900 covered in Batch 6
- [x] Functional walk-through: new `e2e/walkthrough.mjs`, 21 steps (projects/tags, quick-add parsing, Today, reload persistence, timer, repeat, subtasks, rename, search, markdown preview, filters, sort, drag reorder, drag to project, palette, focus mode, stats, Completed view, CSV export, appearance persistence, "Open on")
- [x] Screenshots reviewed (desktop grid across 6 themes, phone layouts, menus, dialogs, Settings previews)
- [x] Help, shortcuts sheet and About updated (shortcuts now list F2, Delete, ↑/↓, Ctrl/⌘+, and the calendar keys)
- [x] Release checklist below fully ticked; live site checked against the new bundle hash
- **Bugs found by the walk-through and fixed:** the **Completed view also listed every open task** (since the original version; there's now a regression test); the inline rename field and the detail title had the same name "Task name"; returning focus to a task after closing the panel could, if you moved on within a frame, steal focus back (it now only restores focus that was actually lost); Help's search highlight failed contrast in Nord (it now uses audited tokens).
- **Final numbers:** ESLint 0 problems · 64 unit tests · 34 interaction checks · 21 walk-through steps (5 consecutive clean runs) · 6 PWA checks · contrast audit 0 of 448 token pairs failing · axe/clipping/icon sweep 0 at 1280 for all 28 variants and at 390 for all 28 variants.

---

## Next: top 10 features to build ⬜

Ranked by value to users. Every feature keeps the app's principles: **no server**, works offline, everything undoable, feature-detected with a fallback. Size is rough: **S** ≈ one batch, **M** ≈ two, **L** ≈ three or more. Each one ships the same way as Batches 1–11: unit tests + real-Chrome checks + axe in every theme, then commit and push.

| # | Feature | Why it matters | Size |
|---|---|---|---|
| 1 | Trash and task history | Strongest "never lose data" guarantee | S |
| 2 | Sync across devices through a folder | Biggest gap today: data is stuck on one device | L |
| 3 | Reliable reminders + calendar (.ics) | Reminders only fire while the app is open | M |
| 4 | Flexible repeats | "Every weekday", "2nd Tuesday", "3 days after done" | M |
| 5 | Smart lists (saved filters) | Custom views without new code per view | S |
| 6 | Board view (Kanban) | A second way to see and move work | M |
| 7 | Plan my day | Turns a long list into a realistic day | M |
| 8 | Pomodoro in focus mode | Builds on timers and focus mode already there | S |
| 9 | Share a list by link; Markdown / todo.txt import-export | Collaboration and portability without a server | M |
| 10 | On-device AI: smart quick-add and weekly review | Extends the Batch 10 AI with real daily value | M |

### 1. Trash and task history ⬜ (S)
- [ ] Deleted tasks go to **Trash** (kept 30 days; Restore / Delete permanently… with confirm + Undo), not straight out of IndexedDB
- [ ] Per-task **version history**: field-level snapshots already logged in `history`; show "Restore this version" in the Activity section
- [ ] Trash and history included in backups; "Empty trash" in Settings → Storage
- Guidelines: §1 never lose data, §9 version history before risky operations

### 2. Sync across devices through a folder ⬜ (L)
- [ ] Settings → Storage → **Sync to a folder** (`showDirectoryPicker`): one JSON file per task + a manifest, so a Dropbox/iCloud/OneDrive/Syncthing folder carries data between devices with no server
- [ ] Write after a 1.2s pause, pull on focus and `visibilitychange`, `FileSystemObserver` where available; one sync at a time with a single queued follow-up
- [ ] Remember last-written text per path across reloads; renames and deletes handled as in the guidelines; conflicts never overwrite silently (banner: Use folder version / Compare / Keep mine)
- [ ] Header sync-status icon with coloured dot; re-request permission from a click
- [ ] Fallback when unsupported (Safari/Firefox): explain, and offer scheduled backup reminders instead
- Tests: OPFS as a stand-in disk (guideline §12), in-memory directory-handle mock for unit tests
- Guidelines: §9 sync to a folder, §10 file system APIs

### 3. Reliable reminders + calendar ⬜ (M)
- [ ] Reminder per task (at due time, or 10 min / 1 h / 1 day before), separate from the due date
- [ ] While open: precise timers in the page; when closed: best available (`showTrigger` where supported, Periodic Background Sync for installed apps), with a clear note of what each browser can do
- [ ] **Add to calendar**: download `.ics` for one task or all dated tasks, so the OS calendar handles alarms reliably
- [ ] Snooze from the notification (actions: Done, Snooze 10 min)
- Guidelines: §10 feature detection with fallbacks, §13 say plainly what works where

### 4. Flexible repeats ⬜ (M)
- [ ] Every N days/weeks/months/years; specific weekdays; "2nd Tuesday", "last weekday of the month"
- [ ] Repeat from the due date **or** from completion ("3 days after I finish")
- [ ] End after N times or on a date; skip one occurrence
- [ ] Quick-add understands "every weekday", "every 2 weeks on fri", "monthly on the 15th"
- [ ] Tested with fake timers across month ends, DST and leap years

### 5. Smart lists (saved filters) ⬜ (S)
- [ ] Save the current search + filters + sort as a named list in the sidebar (icon, colour)
- [ ] Rules: project, tag (any/all), priority, due (overdue/today/this week/none), has notes, has timer time
- [ ] Shown in the palette; included in backups and sync

### 6. Board view (Kanban) ⬜ (M)
- [ ] Columns by status (To do / Doing / Done), by priority, or by project; drag cards between columns (keyboard alternative: "Move to…" menu, arrow keys)
- [ ] "Doing" as an optional status field (works with timers: starting a timer moves the card to Doing)
- [ ] Horizontal scroll at phone width with one column per screen; portal tooltips (guideline §6)

### 7. Plan my day ⬜ (M)
- [ ] Morning prompt (optional): pick tasks for today from overdue, due-soon and suggested
- [ ] Time estimates per task; a running total against available hours; warns when overbooked
- [ ] Optional time-blocks: drag tasks onto a simple day timeline; end-of-day "roll over unfinished" with Undo
- [ ] Uses tracked time from timers to show estimate vs actual in Stats

### 8. Pomodoro in focus mode ⬜ (S)
- [ ] 25/5 (configurable) work/break cycles in focus mode, tied to the task timer
- [ ] Gentle sound + notification at the end of each cycle (respects reduce motion and a mute switch)
- [ ] Session count and focus minutes in Stats; screen stays awake (wake lock already there)

### 9. Share a list by link; Markdown / todo.txt ⬜ (M)
- [ ] **Share link**: a project or selection compressed into the URL fragment (no server; nothing leaves the device until the user sends the link). Opening it shows a read-only preview with "Add to my tasks"
- [ ] Export a project as a Markdown checklist (`- [ ] task`) or todo.txt; copy to clipboard
- [ ] Import: paste or drop Markdown checklists / todo.txt / plain lines; preview before adding; one undo step
- Guidelines: §1 "a share link carries the document inside the URL itself", §10 clipboard

### 10. On-device AI: smart quick-add and weekly review ⬜ (M)
- [ ] **Smart quick-add**: paste messy text (an email, meeting notes) → on-device model extracts tasks with dates/priorities; review checklist before adding (fallback: one task per line + existing date parser)
- [ ] **Weekly review**: `Summarizer` writes a short summary of what got done, what slipped and what's next, shown in Stats (fallback: a templated summary from the numbers)
- [ ] Same rules as Batch 10: availability check, download progress, Cancel, "Use quick version", "Hide AI features", nothing leaves the device
- Guidelines: §11 on-device AI

---

## Release checklist (from guidelines)

- [x] Tokens only: no hard-coded colours; new surfaces work in all themes and high contrast
- [x] Icons go through the wrapper; decorative icons `aria-hidden`; every icon button has a label and a tooltip
- [x] Hovers round and consistent; tooltips not clipped and hidden while their menu is open
- [x] Menus, dialogs and palette keyboard-complete with correct ARIA
- [x] Destructive actions undoable; programmatic edits keep native undo
- [x] Data persists across reloads and tabs, included in backups, never silently overwritten
- [x] Capabilities feature-detected with fallbacks; works offline; SW versioned
- [x] No horizontal scroll at 390px; header doesn't overlap at 900–1280px; reduced motion respected
- [x] Zero axe violations in every theme ± high contrast; no console errors
- [x] `eslint .` clean, `vitest run` passes, `vite build` succeeds, browser scripts pass, screenshots reviewed
- [x] Help, shortcuts sheet and About text updated

---

## Not applicable to this app

Guideline sections written for a Markdown editor that don't fit a task manager: presentation mode and speaker notes, editor toolbars, find-and-replace across files, CodeMirror, syntax-highlighting themes, folder sync via `showDirectoryPicker`, `file_handlers` for `.md`, relative links between files, closed-files list. The *principles* behind them (undoable destructive actions, never overwrite silently, feature detection) are covered above.

---

## Log

| Batch | Date | Commit | Verified |
|---|---|---|---|
| 1 — Tooling & quick fixes | 2026-11-26 | `633f7f4` | lint ✔ · 27 tests ✔ · build ✔ · Chrome sweep ran (baseline recorded) |
| 2 — Tokens & themes | 2026-11-26 | `9d2205c` | lint ✔ · 31 tests ✔ · build ✔ · contrast audit 0 fails · axe contrast 0 in 28 variants |
| 3 — Icons | 2026-11-26 | `2487e04` | lint ✔ · 31 tests ✔ · build ✔ · JSX tag check ✔ · icon scan 0 in 5 themes |
| 4 — Shared components | 2026-11-26 | `a43a2da` | lint ✔ · 31 tests ✔ · build ✔ · 13/13 interaction checks ✔ · only Batch-5 axe items left |
| 5 — Accessibility | 2026-11-26 | `d9e6e97` | lint ✔ · 31 tests ✔ · build ✔ · 18/18 interactions ✔ · axe 0 in 28 variants × 15 views/states |
| 6 — Layout & responsive | 2026-11-26 | `4c2aa9d` | lint ✔ · 31 tests ✔ · build ✔ · 22/22 interactions ✔ · 0 problems at 4 widths |
| 7 — Never lose data | 2026-11-26 | `4e5fe0f` | lint ✔ · 55 tests ✔ · build ✔ · 28/28 interactions ✔ · axe 0 |
| 8 — Settings & Help | 2026-11-26 | `1b12329` | lint ✔ · 55 tests ✔ · build ✔ · 32/32 interactions ✔ · axe 0 incl. Settings/Help |
| 9 — PWA & platform | 2026-11-26 | `571f7b3` | lint ✔ · 55 tests ✔ · build ✔ · 6/6 PWA checks ✔ · 32/32 interactions ✔ · axe 0 |
| 10 — On-device AI | 2026-11-26 | `ef78176` | lint ✔ · 63 tests ✔ · build ✔ · 34/34 interactions ✔ (AI path mocked) · axe 0 |
| 11 — Final sweep | 2026-11-26 | `57b0e94` | lint ✔ · 64 tests ✔ · build ✔ · 34 interactions · 21-step walk-through · 6 PWA · axe 0 at 1280 + 390 × 28 variants |
