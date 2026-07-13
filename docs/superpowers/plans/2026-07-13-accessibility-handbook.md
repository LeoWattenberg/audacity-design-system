# Accessibility Handbook Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a four-page "Accessibility" section in the astro-audacity manual documenting the prototype's keyboard-navigation behaviour, code-verified, so a developer can implement it without reverse-engineering the prototype.

**Architecture:** Content is extracted from four prototype docs, verified claim-by-claim against prototype source code (Task 1) and a live sandbox spot-check (Task 2), consolidated into a single *verified behaviour inventory*. Four MDX pages (Tasks 3–6) are then written FROM the inventory — never directly from the (partially stale) source docs. A discrepancy report captures every doc-vs-code mismatch.

**Tech Stack:** Astro 5 content collections (MDX), existing manual components (`Callout.astro`, `Shortcut.jsx`), bun (astro repo), pnpm (prototype repo).

**Spec:** `docs/superpowers/specs/2026-07-13-accessibility-handbook-design.md` (prototype repo)

## Global Constraints

- Two repos are involved. **Prototype** (read + inventory/report commits): `/Users/alexdawsonsmac/Desktop/Audacity/clip-envelope-prototype`, branch `master`. **Astro site** (MDX pages): `/Users/alexdawsonsmac/Documents/Audacity/Website/astro-audacity`, branch `release/audacity-4` — commit on that branch, do NOT create a new branch, do NOT push either repo unless the user asks.
- New manual section frontmatter, identical on all four pages: `section: "Accessibility"`, `sectionOrder: 160`. Existing sections end at 150; EGAT stub (140) must not be touched.
- Document the **AU4 Tab Groups profile only** as product behaviour. `wcag-flat` gets exactly one callout on the navigation-model page.
- **Nothing goes into an MDX page unless the inventory marks it VERIFIED.** Behaviour that is documented in prototype docs but dead/absent in code is excluded from pages and recorded in the discrepancy report.
- Keyboard keys in MDX use the existing `Shortcut` component: `<Shortcut client:load keys="cmd+shift+left" />` (import `from "../../../components/manual/Shortcut.jsx"`). Recognised named keys: `cmd ctrl alt shift enter esc`; anything else renders uppercased (e.g. `keys="f10"` → F10). In table cells this works inline.
- Callouts use `<Callout type="info|tip|warning" title="...">` (import `from "../../../components/manual/Callout.astro"`).
- Keep MDX tone consistent with existing manual pages (second person, concise, action-oriented). Each page ends with an `## Implementation notes` section addressed to developers.
- Prototype repo commits are docs-only, but CLAUDE.md requires gates before every commit: run `node scripts/check-any.mjs` from repo root (sufficient for markdown-only changes; the test/tsc gates cannot be affected by `.md` files).

---

### Task 1: Verified behaviour inventory + discrepancy report

Cross-check every behavioural claim in the four prototype docs against the actual source code. Produce two markdown files in the prototype repo. This task is pure reading + writing markdown — no code changes.

**Files:**
- Read (docs — the claims): `docs/track-view-navigation.md`, `docs/keyboard-handlers-map.md`, `docs/accessibility-architecture.md`, `docs/export-modal-accessibility.md`
- Read (code — the truth):
  - `packages/core/src/accessibility/profiles.ts` (tab groups, `tabOrder`, `keyboardShortcuts` gating)
  - `packages/components/src/hooks/useTabGroup.ts` and `packages/components/src/hooks/useContainerTabGroup.ts`
  - `packages/components/src/Track/TrackNew.tsx` (clip `onKeyDown`)
  - `packages/components/src/TrackControlPanel/TrackControlPanel.tsx`
  - `apps/sandbox/src/hooks/useKeyboardShortcuts.ts` and `apps/sandbox/src/hooks/handlers/*.ts`
  - `packages/components/src/ApplicationHeader/ApplicationHeader.tsx`
  - Export modal + preferences modal components — locate via `docs/codebase-map.md`; expect `packages/components/src/ExportModal/` and `packages/components/src/PreferencesModal/`
  - `apps/sandbox/src/components/EditorLayout.tsx` (track panel tabIndex assembly)
- Create: `docs/superpowers/specs/2026-07-13-a11y-behaviour-inventory.md`
- Create: `docs/superpowers/specs/2026-07-13-a11y-discrepancy-report.md`

**Interfaces:**
- Produces: the inventory file — the SINGLE content source for Tasks 3–6. Every entry has: surface, trigger (key), behaviour, status (`VERIFIED` / `DEAD-CODE` / `NOT-FOUND` / `UNCLEAR`), and code reference (`file:line`). Also produces the discrepancy report listed for the user.

- [ ] **Step 1: Read the four source docs fully** and extract every keyboard-behaviour claim into a working list.

- [ ] **Step 2: Verify each claim against code.** For each claim, find the handler in the code files above and record `file:line`. Known conflicts that MUST each get an explicit verdict (these were found during planning — resolve ALL of them):

1. **Track tab-order stride**: `accessibility-architecture.md` says stride 3 (container 100, panel 101, clips 102); the tab audit in `track-view-navigation.md`, CLAUDE.md, and the doc's own earlier table say stride 2 (panels 100/102/…, clips 101/103/…). Check `profiles.ts` + `EditorLayout.tsx` + `TrackNew.tsx` tabIndex math.
2. **Label keyboard move/trim** (`Cmd+Arrow`, `Shift+Arrow` on labels): `keyboard-handlers-map.md` says `useLabelKeyboardHandling.ts` is DEAD CODE (not in render tree), while `track-view-navigation.md` documents it as live. Confirm with `grep -rn "useLabelKeyboardHandling\|LabelMarker" apps/sandbox/src packages/components/src` — check imports in the ACTIVE render tree only.
3. **F2 rename** (clip and label): claimed in `track-view-navigation.md` only. Search: `grep -rn "'F2'\|\"F2\"" apps/sandbox/src packages/components/src`.
4. **Playhead `,` / `.` shortcuts** (incl. `Shift+,` `Cmd+Shift+.` selection variants): claimed in `track-view-navigation.md`. Search `useKeyboardShortcuts.ts` + `handlers/*`.
5. **Delete/Backspace on clips**: `keyboard-handlers-map.md` says a GLOBAL handler reads `data-clip-id` from `document.activeElement`; `track-view-navigation.md` implies it's a clip-level AU4-only shortcut. Establish where it lives and whether `wcag-flat` disables it.
6. **Effects panel arrows**: `track-view-navigation.md` says "arrows disabled, Enter to open"; CLAUDE.md says the effects panel has grid keyboard navigation. Check the EffectsPanel component + its `tabGroups` config.
7. **Export modal group IDs**: `export-modal-accessibility.md` names groups `export-type/file/audio-options/rendering/footer` at the top but `export-settings/format-options/additional-options/footer` in its own Implementation Details section. Check `profiles.ts` for which IDs actually exist.
8. **Selection-toolbar tab position**: `tabOrder` says 200, but the live audit shows the timecode group at `tabIndex 0` appearing first AND last in the Tab cycle. Check `SelectionToolbar.tsx` / profile config and explain the observed behaviour.
9. **Track-header child navigation wrap** ("after last child → back to panel"): verify in `TrackControlPanel.tsx`.
10. **`Cmd+Up/Down` clip move to adjacent track + Cmd-release overlap resolution** (`useCmdArrowMove.ts`, `pendingClipMoveResolution`): verify trigger-on-release behaviour.

- [ ] **Step 3: Write the inventory** to `docs/superpowers/specs/2026-07-13-a11y-behaviour-inventory.md`, organised by the four handbook pages (Navigation model / Track view / Toolbars & panels / Modals & menus). Entry format:

```markdown
### <Surface> — <Key(s)>
- **Behaviour:** <one sentence, exactly what the code does>
- **Status:** VERIFIED | DEAD-CODE | NOT-FOUND | UNCLEAR
- **Code:** `path/to/file.tsx:123`
- **Profile-gated:** yes (AU4 only) / no (always active)
```

- [ ] **Step 4: Write the discrepancy report** to `docs/superpowers/specs/2026-07-13-a11y-discrepancy-report.md`: one table — Claim / Source doc / What the code actually does / Verdict. Include every DEAD-CODE / NOT-FOUND / UNCLEAR item and every doc-vs-doc contradiction from Step 2, plus anything else found.

- [ ] **Step 5: Gate + commit (prototype repo)**

```bash
cd /Users/alexdawsonsmac/Desktop/Audacity/clip-envelope-prototype
node scripts/check-any.mjs
git add docs/superpowers/specs/2026-07-13-a11y-behaviour-inventory.md docs/superpowers/specs/2026-07-13-a11y-discrepancy-report.md
git commit -m "docs: code-verified a11y behaviour inventory + discrepancy report

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: check-any reports 0 violations; commit succeeds.

---

### Task 2: Interactive spot-check of tricky behaviours

Confirm a sample of the hardest-to-read behaviours in the running sandbox. Amend the inventory/report where reality disagrees with the code reading.

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-a11y-behaviour-inventory.md`, `docs/superpowers/specs/2026-07-13-a11y-discrepancy-report.md` (only if findings differ)

**Interfaces:**
- Consumes: inventory from Task 1.
- Produces: inventory entries upgraded with `(spot-checked)` on the Status line for the checked items.

- [ ] **Step 1: Start the sandbox** with the preview tools (`preview_start`; if `.claude/launch.json` lacks an entry, create one: runtimeExecutable `pnpm`, runtimeArgs `["--filter", "@audacity-ui/sandbox", "dev"]`, port 5173). Load the app, use Debug > Generate Tracks (or equivalent) to get ≥3 tracks with clips.

- [ ] **Step 2: Spot-check these five behaviours** using `preview_eval` (dispatch `KeyboardEvent`s / inspect `document.activeElement`) and `preview_snapshot`:
1. Global Tab cycle order and the track panel/clip tabIndex interleave (settles conflict #1 and #8 from Task 1)
2. ArrowLeft/Right clip cycling within a track; ArrowUp/Down to adjacent track
3. `Cmd+ArrowRight` clip move, then Cmd release → overlap resolution
4. Track panel two-level navigation (ArrowRight into children, Escape back)
5. Effects panel arrow behaviour (settles conflict #6)

- [ ] **Step 3: Record results.** Mark confirmed entries `(spot-checked)`; where the live app contradicts the code reading, correct the inventory entry and add a discrepancy row.

- [ ] **Step 4: Gate + commit (prototype repo)** — only if files changed:

```bash
cd /Users/alexdawsonsmac/Desktop/Audacity/clip-envelope-prototype
node scripts/check-any.mjs
git add docs/superpowers/specs/2026-07-13-a11y-behaviour-inventory.md docs/superpowers/specs/2026-07-13-a11y-discrepancy-report.md
git commit -m "docs: spot-check amendments to a11y inventory

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Section scaffold + `navigation-model.mdx`

**Files:**
- Create: `/Users/alexdawsonsmac/Documents/Audacity/Website/astro-audacity/src/content/manual/accessibility/navigation-model.mdx`

**Interfaces:**
- Consumes: inventory (Task 1/2) — Navigation model section.
- Produces: the `"Accessibility"` section (sectionOrder 160) in the manual nav; the page other pages link to for the tab-group concept. URL slug: `/manual/accessibility/navigation-model`.

- [ ] **Step 1: Write the page.** Draft below — **replace every ⚠️VERIFY value with the inventory's verdict** and drop any table row whose inventory status is not VERIFIED:

```mdx
---
title: How keyboard navigation works
description: The tab-group navigation model — how Tab, arrow keys and focus behave across the whole application.
section: "Accessibility"
sectionOrder: 160
order: 1
---

import Callout from "../../../components/manual/Callout.astro";
import Shortcut from "../../../components/manual/Shortcut.jsx";

The application uses a **tab-group** navigation model (the WAI-ARIA composite-widget / roving-tabindex pattern). Interactive controls are organised into groups; <Shortcut client:load keys="tab" /> moves between groups, arrow keys move within a group.

## Core rules

| Rule | Behaviour |
|---|---|
| One tab stop per group | Exactly one element in each group has `tabIndex = 0`; all others have `tabIndex = -1` |
| <Shortcut client:load keys="tab" /> / <Shortcut client:load keys="shift+tab" /> | Move forward/backward **between groups** |
| Arrow keys | Move focus **within** the current group, wrapping from last to first |
| <Shortcut client:load keys="home" /> / <Shortcut client:load keys="end" /> | Jump to first / last item in the group |
| Focus-on-entry reset | Entering a group from outside always lands on its first item |
| Blur reset | When focus leaves a group, its first element becomes the group's tab stop again |
| Hidden elements | Skipped during arrow navigation (visibility computed at keypress time) |
| Child veto | If a focused child already handled a key (`preventDefault`), the group navigation must not also act on it |

## Global tab order

Groups are visited in this order (numbers are the roving `tabIndex` values):

| # | Group | tabIndex |
|---|---|---|
| 1 | File menu (menubar) | 1 |
| 2 | Project toolbar — tabs (Home, Project, Export) | 2 |
| 3 | Project toolbar — actions (Audio setup, Share, Get effects) | 3 |
| 4 | Project toolbar — workspace (Workspace dropdown, Undo/Redo) | 4 |
| 5 | Tool toolbar (transport + tools) | 5 |
| 6 | Effects panel | 6 |
| 7 | Add new track | 99 |
| 8+ | Track area (see below) | 100… |
| last | Selection toolbar (timecodes) | ⚠️VERIFY (200 in config; live audit observed tabIndex 0) |

## Track area tab order

⚠️VERIFY — sources conflict (stride 2 vs 3). Use the inventory verdict; the live audit observed:

Each track contributes two tab stops, interleaved: track control panels at `100 + index × 2` (100, 102, 104…) and the track's clips (one roving stop per track) at `101 + index × 2` (101, 103, 105…). Tab therefore alternates panel → clips → next panel → …

<Callout type="info" title="Debug profile: WCAG flat navigation">
The prototype also ships a debug profile (`wcag-flat`) in which every interactive element is its own tab stop, arrow-key grouping is off, and clip/label editing shortcuts are disabled. It exists for comparison testing via the Debug Panel and is <strong>not product behaviour</strong>; the rest of this section documents the default AU4 Tab Groups profile only.
</Callout>

## Implementation notes

- The group configuration (which groups exist, arrows on/off, wrap on/off) and the tab order table are a single data structure — one source of truth, not per-component constants.
- The tab order is fixed; it is not affected by DOM order within a group container.
- Focus-on-entry and blur reset both matter: without blur reset, re-entering a toolbar resumes from a stale item.
```

- [ ] **Step 2: Verify it renders.** Start the astro dev server (`cd /Users/alexdawsonsmac/Documents/Audacity/Website/astro-audacity && bun run dev`, or the preview tools with a launch.json entry: runtimeExecutable `bun`, runtimeArgs `["run", "dev"]`, port 4321). Load `/manual/accessibility/navigation-model`. Check: page renders, "Accessibility" appears in the manual sidebar after all existing sections, tables and `<kbd>` chips render, Callout renders.

Expected: no build error in server logs; sidebar shows the new section with this page.

- [ ] **Step 3: Commit (astro repo)**

```bash
cd /Users/alexdawsonsmac/Documents/Audacity/Website/astro-audacity
git add src/content/manual/accessibility/navigation-model.mdx
git commit -m "docs(manual): accessibility section — navigation model page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `track-view.mdx`

**Files:**
- Create: `/Users/alexdawsonsmac/Documents/Audacity/Website/astro-audacity/src/content/manual/accessibility/track-view.mdx`

**Interfaces:**
- Consumes: inventory — Track view section (this page has the most DEAD-CODE/NOT-FOUND candidates: label keyboard move/trim, F2, playhead `,`/`.` — include ONLY VERIFIED rows).
- Produces: `/manual/accessibility/track-view`.

- [ ] **Step 1: Write the page.** Draft (same ⚠️VERIFY discipline; every row below must match an inventory entry before it ships):

```mdx
---
title: Tracks, clips and labels
description: Keyboard navigation and editing in the track area — track headers, clips and labels.
section: "Accessibility"
sectionOrder: 160
order: 2
---

import Callout from "../../../components/manual/Callout.astro";
import Shortcut from "../../../components/manual/Shortcut.jsx";

The track area interleaves two kinds of tab stops per track: the **track control panel** and the track's **clips** (see [How keyboard navigation works](/manual/accessibility/navigation-model)).

## Track control panel

The panel is a two-level composite: the panel itself is one focusable group; its child buttons (mute, solo, pan, effects…) are an inner level.

### Panel focused

| Shortcut | Action | Notes |
|---|---|---|
| <Shortcut client:load keys="enter" /> | Toggle track selection | |
| <Shortcut client:load keys="up" /> / <Shortcut client:load keys="down" /> | Focus previous / next track panel | |
| <Shortcut client:load keys="shift+up" /> / <Shortcut client:load keys="shift+down" /> | Extend track range selection | Also works without panel focus ⚠️VERIFY |
| <Shortcut client:load keys="right" /> | Enter children — focus first child button | |
| <Shortcut client:load keys="left" /> | Enter children — focus last child button | |
| <Shortcut client:load keys="shift+f10" /> | Open track context menu, focus first item | Also the dedicated Menu key |

### Child button focused

| Shortcut | Action | Notes |
|---|---|---|
| <Shortcut client:load keys="right" /> / <Shortcut client:load keys="down" /> | Next child | After the last child: ⚠️VERIFY (back to panel) |
| <Shortcut client:load keys="left" /> / <Shortcut client:load keys="up" /> | Previous child | Before the first child: ⚠️VERIFY (back to panel) |
| <Shortcut client:load keys="esc" /> | Return focus to the panel | |
| <Shortcut client:load keys="tab" /> | Leave the panel — to the track's clips | |

## Clips

| Shortcut | Action | Notes |
|---|---|---|
| <Shortcut client:load keys="left" /> / <Shortcut client:load keys="right" /> | Cycle focus through the track's clips | Handled by the track container, wraps |
| <Shortcut client:load keys="up" /> / <Shortcut client:load keys="down" /> | Focus first clip on the adjacent track | |
| <Shortcut client:load keys="enter" /> | Toggle clip selection | |
| <Shortcut client:load keys="shift+f10" /> | Open clip context menu, focus first item | Also the dedicated Menu key |
| <Shortcut client:load keys="cmd+left" /> / <Shortcut client:load keys="cmd+right" /> | Move clip backward / forward by 0.1 s | |
| <Shortcut client:load keys="cmd+up" /> / <Shortcut client:load keys="cmd+down" /> | Move clip to the adjacent track | Overlap resolution on modifier release — see notes |
| <Shortcut client:load keys="shift+left" /> | Extend: move the clip's LEFT edge left | |
| <Shortcut client:load keys="shift+right" /> | Extend: move the clip's RIGHT edge right | |
| <Shortcut client:load keys="cmd+shift+left" /> | Reduce: move the clip's RIGHT edge left | |
| <Shortcut client:load keys="cmd+shift+right" /> | Reduce: move the clip's LEFT edge right | |
| <Shortcut client:load keys="delete" /> | Delete focused clip (and other selected clips) | ⚠️VERIFY location + profile gating |

## Labels

⚠️VERIFY — per the inventory, keyboard move/trim for labels is expected to be DEAD CODE; if so this table only contains:

| Shortcut | Action | Notes |
|---|---|---|
| <Shortcut client:load keys="delete" /> | Delete selected label(s) | Backspace equivalent |

## Track-area global shortcuts

Active regardless of what is focused (suppressed only inside toolbars/menus — see notes):

| Shortcut | Action |
|---|---|
| <Shortcut client:load keys="up" /> / <Shortcut client:load keys="down" /> | Move the track focus outline to the adjacent track |
| <Shortcut client:load keys="shift+up" /> / <Shortcut client:load keys="shift+down" /> | Extend multi-track selection |
| <Shortcut client:load keys="home" /> / <Shortcut client:load keys="end" /> | Playhead to project start / end (clears time selection) ⚠️VERIFY |
| <Shortcut client:load keys="shift+home" /> / <Shortcut client:load keys="shift+end" /> | Extend time selection to project start / end ⚠️VERIFY |
| <Shortcut client:load keys="l" /> | Toggle loop region ⚠️VERIFY |

## Implementation notes

- **Edge semantics for trim:** Extend mode (Shift) moves the NAMED edge outward; Reduce mode (Cmd+Shift) moves the OPPOSITE edge inward. Cmd+Shift+Left moves the RIGHT edge left. Getting this backwards is the most common implementation bug.
- **Event ownership contract:** arrow-key clip cycling is handled by the track *container*; each clip's own handler calls `preventDefault()` for the shortcuts it owns (Cmd/Shift combinations), and the container must skip any event with `defaultPrevented` set.
- **Cmd+Arrow overlap resolution fires on Cmd RELEASE, not per keypress:** while Cmd is held the clip may temporarily overlap others; a single shared pending-resolution step runs when the modifier is released (keyup).
- **Global ArrowUp/Down guard:** the global track-focus handler must not fire when focus is inside any `role="toolbar"`, `role="group"` or `role="menubar"` container, otherwise arrow navigation inside toolbars also scrolls track focus.
```

- [ ] **Step 2: Verify it renders** (dev server already configured in Task 3): load `/manual/accessibility/track-view`, confirm page + sidebar entry + tables render.

- [ ] **Step 3: Commit (astro repo)**

```bash
cd /Users/alexdawsonsmac/Documents/Audacity/Website/astro-audacity
git add src/content/manual/accessibility/track-view.mdx
git commit -m "docs(manual): accessibility section — track view page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `toolbars-and-panels.mdx`

**Files:**
- Create: `/Users/alexdawsonsmac/Documents/Audacity/Website/astro-audacity/src/content/manual/accessibility/toolbars-and-panels.mdx`

**Interfaces:**
- Consumes: inventory — Toolbars & panels section (key open item: effects-panel arrow verdict, conflict #6).
- Produces: `/manual/accessibility/toolbars-and-panels`.

- [ ] **Step 1: Write the page.** Draft:

```mdx
---
title: Toolbars and panels
description: Keyboard behaviour of the menu bar, toolbars, effects panel and selection toolbar.
section: "Accessibility"
sectionOrder: 160
order: 3
---

import Callout from "../../../components/manual/Callout.astro";
import Shortcut from "../../../components/manual/Shortcut.jsx";

All toolbars share the standard group behaviour from [How keyboard navigation works](/manual/accessibility/navigation-model): one tab stop per toolbar, arrows to move within, wrap-around, <Shortcut client:load keys="home" />/<Shortcut client:load keys="end" /> to jump.

## Shared toolbar behaviour

| Shortcut | Action |
|---|---|
| <Shortcut client:load keys="left" /> / <Shortcut client:load keys="up" /> | Previous item (wraps) |
| <Shortcut client:load keys="right" /> / <Shortcut client:load keys="down" /> | Next item (wraps) |
| <Shortcut client:load keys="home" /> / <Shortcut client:load keys="end" /> | First / last item |
| <Shortcut client:load keys="tab" /> | Leave the toolbar (next group) |
| <Shortcut client:load keys="enter" /> / <Shortcut client:load keys="space" /> | Activate the focused control |

Composite controls inside a toolbar (e.g. the timecode widget) are treated as a single arrow-navigation stop, not one stop per internal button. ⚠️VERIFY

## Menu bar (File, Edit, …)

| Shortcut | Action |
|---|---|
| <Shortcut client:load keys="left" /> / <Shortcut client:load keys="right" /> | Move between top-level menus |
| <Shortcut client:load keys="enter" /> | Open the focused menu ⚠️VERIFY |

## Project toolbar

Three separate groups, in tab order: **tabs** (Home, Project, Export) → **actions** (Audio setup, Share audio, Get effects) → **workspace** (Workspace dropdown, Undo, Redo).

## Tool toolbar

One group containing transport and tools: Play, Stop, Record, Step back/forward, Loop, Automation, Zoom controls, Cut, Copy, Paste, Trim, Silence, Timecode. ⚠️VERIFY exact item list against the live toolbar.

## Effects panel

⚠️VERIFY (conflict #6) — write this section entirely from the inventory verdict: either grid navigation (2-D arrows) or Enter-to-open with arrows disabled.

## Selection toolbar

The bottom bar of timecode inputs. ⚠️VERIFY tab position (config 200 vs observed tabIndex 0) and describe what actually happens, plus arrow behaviour between timecode fields and within a timecode's digits.

## Implementation notes

- The toolbar group discovers its focusable children at runtime from the DOM (buttons, selects, inputs) and skips hidden ones — items added or removed by state changes must not require re-registering.
- Timecode-style composite widgets need `role="group"` so they collapse to a single navigation stop and so the global ArrowUp/Down guard covers them.
```

- [ ] **Step 2: Verify it renders**: load `/manual/accessibility/toolbars-and-panels`.

- [ ] **Step 3: Commit (astro repo)**

```bash
cd /Users/alexdawsonsmac/Documents/Audacity/Website/astro-audacity
git add src/content/manual/accessibility/toolbars-and-panels.mdx
git commit -m "docs(manual): accessibility section — toolbars and panels page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `modals-and-menus.mdx`

**Files:**
- Create: `/Users/alexdawsonsmac/Documents/Audacity/Website/astro-audacity/src/content/manual/accessibility/modals-and-menus.mdx`

**Interfaces:**
- Consumes: inventory — Modals & menus section (key open item: export-modal group IDs, conflict #7).
- Produces: `/manual/accessibility/modals-and-menus`.

- [ ] **Step 1: Write the page.** Draft:

```mdx
---
title: Modals and menus
description: Keyboard behaviour of the export modal, preferences, and context menus — including focus trapping and restore.
section: "Accessibility"
sectionOrder: 160
order: 4
---

import Callout from "../../../components/manual/Callout.astro";
import Shortcut from "../../../components/manual/Shortcut.jsx";

Modals follow the same tab-group model as the main window, scoped to the dialog: <Shortcut client:load keys="tab" /> moves between the dialog's groups, arrows move within a group.

## Export modal

Five groups in tab order ⚠️VERIFY IDs and count (conflict #7): **Export type** → **File** (name, folder, browse, format) → **Audio options** (channels, sample rate, encoding) → **Rendering** (trim-silence checkbox) → **Footer** (Edit metadata, Cancel, Export).

| Shortcut | Action | Notes |
|---|---|---|
| <Shortcut client:load keys="tab" /> / <Shortcut client:load keys="shift+tab" /> | Next / previous group | |
| <Shortcut client:load keys="up" /> / <Shortcut client:load keys="down" /> | Previous / next item in the group | ⚠️VERIFY wrap on/off |
| <Shortcut client:load keys="enter" /> / <Shortcut client:load keys="space" /> | Activate control (open dropdown, toggle, click) | |
| <Shortcut client:load keys="esc" /> | Close the modal (same as Cancel) | From any focused element |

Behaviours to state explicitly (all ⚠️VERIFY):
- On open, every group resets to its first item.
- Closing a dropdown returns focus to its trigger.
- The nested Channel Mapping dialog traps focus; <Shortcut client:load keys="esc" /> closes it and returns focus to the "Edit mapping" button.

## Preferences modal

⚠️VERIFY — from the inventory: sidebar group + content-area groups (per-page groups such as Inputs & Outputs, Buffer & Latency, Sample Rate…); describe Tab/arrow flow between sidebar and content, and Escape behaviour.

## Context menus

⚠️VERIFY — from the inventory: opening via <Shortcut client:load keys="shift+f10" /> or the Menu key focuses the first item; arrows navigate; <Shortcut client:load keys="enter" /> activates; <Shortcut client:load keys="esc" /> closes and (⚠️VERIFY) restores focus to the invoking element.

## Implementation notes

- Focus restore is part of the contract everywhere: dropdown → trigger, nested dialog → invoking button, context menu → invoking clip/track. Losing focus to `document.body` after a close is a bug.
- Escape must work from ANY focused element inside the modal, including while a child group has focus — implement it on the dialog container, not per control.
```

- [ ] **Step 2: Verify it renders**: load `/manual/accessibility/modals-and-menus`.

- [ ] **Step 3: Commit (astro repo)**

```bash
cd /Users/alexdawsonsmac/Documents/Audacity/Website/astro-audacity
git add src/content/manual/accessibility/modals-and-menus.mdx
git commit -m "docs(manual): accessibility section — modals and menus page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Final pass — build check, cross-links, no-orphaned-VERIFY sweep

**Files:**
- Modify (if needed): the four MDX pages
- Read: `docs/superpowers/specs/2026-07-13-a11y-discrepancy-report.md`

**Interfaces:**
- Consumes: all four published pages + discrepancy report.
- Produces: the finished section + a user-facing summary of discrepancies (reported in chat, not a file).

- [ ] **Step 1: Sweep for leftovers.** `grep -rn "VERIFY\|⚠️\|TODO\|TBD" /Users/alexdawsonsmac/Documents/Audacity/Website/astro-audacity/src/content/manual/accessibility/` — must return nothing. Any hit means a page shipped an unresolved claim; fix it from the inventory.

- [ ] **Step 2: Check cross-links** between the four pages resolve (each page links to `/manual/accessibility/navigation-model` at minimum) and sidebar ordering is 1–4.

- [ ] **Step 3: Production build check**

```bash
cd /Users/alexdawsonsmac/Documents/Audacity/Website/astro-audacity
bun run build
```

Expected: build succeeds (includes pagefind indexing); no MDX compile errors.

- [ ] **Step 4: Commit any fixes (astro repo)** using message `docs(manual): accessibility section — final pass fixes`, then summarise for the user: the four page URLs + the discrepancy report highlights (every DEAD-CODE/NOT-FOUND item and each resolved doc conflict, one line each).
