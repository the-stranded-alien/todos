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

### Batch 7 — Never lose data ⬜
- [ ] Delete task → toast with **Undo** (no confirm dialog); deletes subtasks with the parent and restores them on undo (bug 4)
- [ ] Project/tag delete → Undo restores the project/tag and every task reassignment
- [ ] Uncomplete is undoable (bug 9)
- [ ] Detail-panel title/notes edits: debounced commit (one history + one undo step per editing burst) (bug 3)
- [ ] Bulk delete/complete/move → single Undo step for the whole batch
- [ ] Backup = JSON with `format`/`version` manifest + settings; restore validates and says plainly what's wrong; automatic snapshot of current data before restore, with Undo
- [ ] Cross-tab sync via `BroadcastChannel` (ignore own messages, echo suppression)
- [ ] `navigator.storage.persist()` request + usage via `estimate()` (Settings → Storage)

### Batch 8 — Settings and Help ⬜
- [ ] Settings dialog with side nav: Workspace (default view, week start), Appearance (theme picker with **live mini previews**, additional themes, high contrast, density, reduced motion), Features (voice input, timers, notifications, hide AI features), Storage (usage, persist, backup/restore, clear completed with Undo), About (privacy: "No server involved", version, links)
- [ ] `role="switch"` toggles with label + one-line description
- [ ] Help dialog: sectioned how-to (quick-add syntax, views, timers, focus mode, shortcuts, data/privacy) with search
- [ ] Header: Settings button; Download ▾ menu (Backup JSON, Export CSV, Restore…)
- [ ] Command palette gets commands for every setting, theme, and help

### Batch 9 — PWA and browser platform ⬜
- [ ] `manifest.webmanifest` (`id`, `scope`, `display: standalone`, `theme_color`, SVG + PNG icons, shortcuts: New task, Today)
- [ ] Vite plugin emits `precache-manifest.json` with hashed assets; SW precaches it with a versioned cache name, deletes old caches, `skipWaiting` + `clients.claim`
- [ ] Network-first for navigations (fixes bug 8), cache-first for hashed assets
- [ ] `share_target` (GET with `title`/`text`/`url`) → creates a task from shared content
- [ ] "Update available" toast when a new SW takes over
- [ ] Wake Lock in focus mode (re-acquire on `visibilitychange`); fullscreen toggle in focus mode
- [ ] Notifications: feature-detected, explained in Settings, permission requested from a click only

### Batch 10 — On-device AI (optional, feature-detected) ⬜
- [ ] "Break into subtasks" in the detail panel via Chrome `LanguageModel`; `availability()`, download progress, `AbortController`
- [ ] Non-AI fallback (split notes lines / bullet list into subtasks)
- [ ] "Unsupported" notice with requirements instead of hiding silently; "Hide AI features" switch removes every AI button
- [ ] UI says "Runs on your device — nothing is sent anywhere"

### Batch 11 — Final verification sweep ⬜
- [ ] Browser sweep: every view × every theme × high contrast — axe, console errors, icon scan, horizontal scroll, header overlap at 4 widths
- [ ] Functional walk-through (~25 steps): quick-add parsing, persistence across reload, undo/redo, edit, subtasks, timers, filters/sort, search, palette, calendar, stats, focus mode, bulk actions, backup → restore, cross-tab sync, themes, settings, help, mobile
- [ ] Screenshots reviewed
- [ ] Help, shortcuts sheet and About updated for everything new
- [ ] Release checklist below fully ticked; live site checked against new bundle hash

---

## Release checklist (from guidelines)

- [ ] Tokens only: no hard-coded colours; new surfaces work in all themes and high contrast
- [ ] Icons go through the wrapper; decorative icons `aria-hidden`; every icon button has a label and a tooltip
- [ ] Hovers round and consistent; tooltips not clipped and hidden while their menu is open
- [ ] Menus, dialogs and palette keyboard-complete with correct ARIA
- [ ] Destructive actions undoable; programmatic edits keep native undo
- [ ] Data persists across reloads and tabs, included in backups, never silently overwritten
- [ ] Capabilities feature-detected with fallbacks; works offline; SW versioned
- [ ] No horizontal scroll at 390px; header doesn't overlap at 900–1280px; reduced motion respected
- [ ] Zero axe violations in every theme ± high contrast; no console errors
- [ ] `eslint .` clean, `vitest run` passes, `vite build` succeeds, browser scripts pass, screenshots reviewed
- [ ] Help, shortcuts sheet and About text updated

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
| 6 — Layout & responsive | 2026-11-26 | _see git log_ | lint ✔ · 31 tests ✔ · build ✔ · 22/22 interactions ✔ · 0 problems at 4 widths |
