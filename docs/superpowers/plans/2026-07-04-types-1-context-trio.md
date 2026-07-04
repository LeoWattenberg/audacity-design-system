# types-1 Context-Adoption Trio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AppDialogs + AppContextMenus adopt the typed `TracksContext` (dropping drilled `state`/`dispatch` `any`-props); LabelRenderer's dispatch prop gets precisely typed (or context-adopted); then all three files lose their redundant inline `any`. Zero behavior change.

**Architecture:** Identical to the EditorLayout elegance pass: `useTracks()` inside the consumer is a source flip (same context value App drilled), so identity and behavior are unchanged; the restored types then make the inline `(x: any)` annotations redundant, removed under tsc gating.

**Tech Stack:** TypeScript 5 (tsc primary gate), Vitest (backstop).

## Global Constraints

- Branch `refactor/types-1-context-trio` (created).
- **Behavior-preserving; type-only.** No logic/value/control-flow edits. Never add `any` to silence an error — fix the access; genuine gaps keep ONE cast with `// justified: <reason>`.
- Do NOT touch other `any` clusters (useKeyboardShortcuts options interface, AudioEngineContext, RecordingManager).
- Gates per task: `cd apps/sandbox && npx tsc --noEmit -p tsconfig.json` (0) ; final also `cd packages/core && npx tsc --noEmit` (0) ; `pnpm --filter @audacity-ui/sandbox test` (168) ; `pnpm --filter @audacity-ui/sandbox build`.
- Implementers DO THE WORK THEMSELVES with Edit/Bash tools — no delegation narration.

---

## Task 0: Baseline
- [ ] `git branch --show-current` → `refactor/types-1-context-trio`; suite 168 green; sandbox tsc 0. Record `grep -cE ': any|as any'` for the three files (expect ~23 / ~10 / ~2).

## Task 1: AppDialogs — adopt context + de-any
**Files:** `apps/sandbox/src/components/AppDialogs.tsx`; `apps/sandbox/src/App.tsx` (call site ~1925–1994).
- [ ] **Step 1:** In AppDialogs: `import { useTracks } from '../contexts/TracksContext';` (+ `import type { TracksState, TracksAction }` if referenced). Add `const { state, dispatch } = useTracks();` at the top of the component that currently receives them. Remove `dispatch: React.Dispatch<any>` (~33) and `state: any` (~129) from the props interface(s) and the destructures. NOTE: the file may have MULTIPLE interfaces/components — find every `state: any`/`dispatch:.*any` prop in the file (`grep -nE 'state: any|dispatch:.*any' apps/sandbox/src/components/AppDialogs.tsx`) and handle each: if a nested sub-component receives them as props from the top component, either thread the now-typed values or let the sub-component adopt context too (prefer whichever is the smaller diff; document).
- [ ] **Step 2:** In App.tsx remove `state={state}`/`dispatch={dispatch}` from the `<AppDialogs .../>` call ONLY (App keeps its own `useTracks()` — other consumers still use it).
- [ ] **Step 3:** tsc → fix surfaced accesses (recon says ~0). Then strip redundant inline `(x: any)`/lazy casts in the file, batch + tsc after each; `// justified:` for genuine keeps.
- [ ] **Step 4:** sandbox tsc 0; suite 168; commit `refactor(types): AppDialogs consumes typed TracksContext; drop any-props + inline any`.

## Task 2: AppContextMenus — adopt context + de-any
**Files:** `apps/sandbox/src/components/AppContextMenus.tsx`; `apps/sandbox/src/App.tsx` (call ~1997–2002).
- [ ] Same procedure as Task 1 (dispatch ~line 18; check whether it also receives `state` — grep — and drop that too). Recon surfaced 1 item — fix at the access. Then inline de-any (10 → ~0). Gates; commit `refactor(types): AppContextMenus consumes typed TracksContext; drop any-props + inline any`.

## Task 3: LabelRenderer — type or adopt dispatch
**Files:** `apps/sandbox/src/components/LabelRenderer.tsx` (~line 18); its caller `apps/sandbox/src/components/Canvas.tsx` if the prop is dropped.
- [ ] **Decide with evidence:** prefer `useTracksDispatch()` inside LabelRenderer + drop the `dispatch` prop from its interface and Canvas's call site. If that's awkward (component intended prop-driven), instead type the prop `dispatch: React.Dispatch<TracksAction>` (import type from TracksContext). Document the choice + why in the report.
- [ ] Fix surfaced accesses; strip any remaining inline `any` in the file. Gates; commit `refactor(types): type LabelRenderer dispatch (drop (action: any) => void)`.

## Task 4: Final verification + report
- [ ] Suite 168; sandbox build; sandbox tsc 0; **core tsc 0**. Recount the three files' `any` (report before→after; list justified keeps). Manual smoke deferred to user (open dialogs, use context menus, drag/delete a label).

## Self-Review notes (author)
- Spec→plan: adoption (T1/T2), LabelRenderer decision (T3), de-any cleanup folded into each task, verification (T4). Recon numbers embedded so implementers know expected error counts. Multi-interface AppDialogs handled explicitly. No placeholders.
