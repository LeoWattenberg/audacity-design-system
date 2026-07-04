# Design: EditorLayout Effect/Keyboard Hook Extraction

**Date:** 2026-07-04
**Base branch:** `master`
**Status:** Approved for planning

## Goal

Lift the self-contained `useEffect` side-effects out of `apps/sandbox/src/components/EditorLayout.tsx` (~2,389 lines) into dedicated, independently-tested hooks in `apps/sandbox/src/hooks/`. Behavior-preserving. ~250 lines out; the intricate keyboard/focus logic becomes named and testable.

## Motivation

`EditorLayout.tsx` is the largest file in the repo, but ~76% of it is layout JSX wiring around child components that are **already extracted** (`EffectsPanel`, `TrackControlSidePanel`, `VerticalRulerPanel`, `Canvas`, `MixerPanel`, `PianoRollPanel`, `TimelineRuler`, `PanelHeader`). That layout glue is irreducible without a context-slicing architecture change (a selection/focus context to kill the prop-drilling) — a large, higher-risk project that is out of scope here.

What *is* cleanly extractable, and highest-value, are several self-contained `useEffect` blocks: global-keydown tab routers and a RAF scroll animation. They have zero render coupling, are the most accessibility-fragile logic in the file, and today have no test coverage. Lifting them into named hooks isolates and test-covers exactly the treacherous parts.

## Constraints

- **Behavior-preserving.** Each hook is the same `useEffect`, moved verbatim, taking its closure variables as an explicit `deps` object; EditorLayout replaces each inline effect with a hook call. No effect ordering or dependency-array semantics change.
- **Do not touch the landmines.** Loop-region overlay sync (rendered in BOTH the timeline ruler and the canvas overlay trees), selection/focus routing across regions, scroll synchronization, and all layout JSX are left exactly as-is.
- Work on a feature branch off `master`.
- No unrelated refactoring; the other regions (BottomDrawer, ruler flyout, layout) are out of scope.

## Scope — five hooks (ordered safest-first)

All new files under `apps/sandbox/src/hooks/`:

### 1. `usePianoRollSmoothScroll` (~479–521)
RAF ease-out-cubic scroll that brings the selected MIDI clip into view. Owns `pianoRollScrollAnimRef` and `skipPianoRollScrollRef` (moved in). Dispatches `SET_PIANO_ROLL_SCROLL_X` per animation frame; cancellable. **Returns `skipPianoRollScrollRef`** so the piano-roll render (which sets it during clip creation) keeps working. Deps: the piano-roll state it reads (`pianoRollOpen`, `pianoRollTrackIndex`, `tracks`, `pianoRollScrollX`, the selected-clip trigger) + `dispatch`.

### 2. `useAutoOpenPianoRoll` (~456–466)
Dispatches `SET_PIANO_ROLL_OPEN` when a MIDI track gains focus. Deps: `focusedTrackIndex` (+ whatever else the effect reads) + `dispatch`.

### 3. `useDrawerTabAutoSwitch` (~439–453)
Switches the drawer's active tab when the mixer / piano roll open or close. Owns `prevMixerRef`/`prevPianoRollRef` (moved in). Deps: `showMixer`, `pianoRollOpen`, and takes the `setDrawerActiveTab` setter.

### 4. `useTimeSelectionTabHandler` (~243–335)
Global keydown listener governing Tab behavior while a time selection is active. Self-contained (one listener + cleanup, DOM-query based). Deps: the selection/track state it reads.

### 5. `useFlatNavTabRouter` (~343–434)
Global keydown listener that intercepts Tab in flat-navigation mode and routes focus through a custom DOM-ordered list (headers, clips, rulers). Self-contained. Deps: `isFlatNavigation` (+ any state it reads).

**Kept separate:** the two Tab handlers stay as two hooks (they are two distinct `useEffect`s with different triggers), not merged into one — this keeps each a pure verbatim move.

## Approach

For each block: create the hook file exporting `useXxx(deps)`; move the `useEffect` (and any refs it exclusively owns) into it verbatim, referencing `deps.*`; in EditorLayout, delete the inline effect/refs and call the hook. Thread every closure variable the effect read into the `deps` object — miss one and typecheck/behavior breaks (the verification gates catch this). Order the hook calls in EditorLayout to match the original effect declaration order (React runs effects in order; keeping declaration order avoids any ordering surprise).

## Testing — hybrid, targeted

No `EditorLayout` test exists today; these are the first, via `renderHook` from `@testing-library/react` (which works despite the sandbox's react-dom/react `render()` mismatch — hooks don't hit the broken DOM-render path).

- **`useFlatNavTabRouter` / `useTimeSelectionTabHandler`:** stage focusable DOM elements carrying the attributes the router queries, `renderHook` the hook with representative deps, dispatch a `Tab` (and `Shift+Tab`) `keydown`, and assert the observable outcome — focus moved to the expected element and/or `preventDefault` was called. This locks the accessibility behavior.
- **`usePianoRollSmoothScroll`:** `renderHook`, trigger a selected-clip change, drive the RAF loop (advance rAF/timers), and assert `dispatch(SET_PIANO_ROLL_SCROLL_X)` fires; assert that setting the returned `skipPianoRollScrollRef` suppresses the scroll.
- **`useAutoOpenPianoRoll` / `useDrawerTabAutoSwitch`:** `renderHook`, change the trigger dep, assert the expected `dispatch` / setter call.

If a keyboard hook's DOM staging proves too brittle to assert focus movement after faithfully reproducing what the code queries, fall back to asserting the observable dispatch/preventDefault it performs rather than weakening the test to nothing — and note it.

## Verification

- New hook tests green (characterization — green from the start).
- Full sandbox suite stays green: `pnpm --filter @audacity-ui/sandbox test`.
- Typecheck + production build succeed: `pnpm --filter @audacity-ui/sandbox build`.
- Manual smoke: flat-nav Tab cycles through tracks in the documented order; Tab during an active time selection behaves as before; selecting a MIDI clip smooth-scrolls the piano roll (and clip-creation doesn't jump); opening the mixer / piano roll auto-switches the drawer tab.

## Explicitly out of scope

- Layout JSX glue and prop-drilling (needs a selection/focus context — separate project).
- The landmine shared state: loop-region overlay sync, selection/focus routing, scroll sync.
- Extracting a `BottomDrawer` component, the ruler flyout, or any region component.
- The ruler-viewport `ResizeObserver` effect (tiny, ruler-coupled) — stays inline.
- Other monoliths (`App.tsx`, `PreferencesModal.tsx`).

## Success criteria

- The five effects live in named hooks under `hooks/`; EditorLayout calls them in place of the inline effects, with no behavior change.
- `usePianoRollSmoothScroll` owns its refs and returns `skipPianoRollScrollRef`; the piano-roll render still sets it.
- Each hook has a targeted characterization test (accessibility behavior for the tab routers; dispatch/setter for the rest); full suite + build green; manual smoke clean.
