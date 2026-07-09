# Design: Time-Selection Scope Decoupled from Track Selection

**Date:** 2026-07-09
**Base branch:** `master`
**Status:** Design approved by user (this doc = the review artifact).
**Kind:** DELIBERATE BEHAVIOR CHANGE — user-driven product decision, validated by the `explore/track-selection` prototype (commit ecc33b5, tagged `desktop-v0.7.0-explore.1`).

## The problem

Dragging out a time selection today also selects every track the drag touches (`onSelectedTracksChange` dispatches `SET_SELECTED_TRACKS` during the drag). The user's track selection is destroyed by a gesture that is about *time*, not tracks.

## Prior art — the explore prototype

The full model was built and user-validated on `explore/track-selection` (ecc33b5, 2026-07-02). Master has since moved ~106 commits (reducer domain split, a11y arrow-key guards, clip-group copy semantics), so this is a **re-implementation on master using the prototype as the behavior spec**, not a merge. The prototype's decisions are adopted wholesale except where noted.

## The model

Time selection and track selection are independent axes. The drag's vertical scope lives on the selection itself.

### 1. Data model

`TimeSelection` gains `tracks?: number[]` — the canvas rows the selection spans — in both the sandbox type (`apps/sandbox/src/contexts/TracksContext.tsx`) and `@audacity-ui/core` (`packages/core/src/types/index.ts`), with the prototype's doc comment.

**One shared scope-resolution helper** — new file `apps/sandbox/src/utils/timeSelectionScope.ts`, exporting `resolveTimeSelectionScope(timeSelection, selectedTrackIndices, trackCount): number[]` — used verbatim by every consumer:

1. `timeSelection.tracks` — if non-empty
2. `selectedTrackIndices` — legacy fallback, if non-empty
3. all tracks

### 2. Gestures — how scope gets set

- **Drag:** `useTimeSelection` (`packages/components/src/hooks/useTimeSelection.ts`) stamps `tracks` into the `onTimeSelectionChange` payload on every drag tick (rows the drag has crossed).
- **Canvas wiring:** `onSelectedTracksChange` in `Canvas.tsx` becomes a no-op. Drags never dispatch `SET_SELECTED_TRACKS`. Track selection stays where the user last put it.
- **Keyboard (user decision — differs from prototype):** keyboard-created selections stamp `[focusedTrackIndex]` as their scope. Known creation sites: `hooks/handlers/navigationHandlers.ts` (2 `SET_TIME_SELECTION` sites) and `hooks/handlers/playheadSelectionHandlers.ts` (1 site). Keyboard *edits* to an existing selection (Shift+Arrow edge nudging via `selectionEdgesRef`) preserve the existing scope. Implementer sweeps all non-null `SET_TIME_SELECTION` dispatches and applies the rule: creation stamps scope, edits preserve it. (No select-all shortcut exists today — nothing to do there.)
- **Scope editing:** Cmd+Click on a track's control panel toggles that row in/out of `timeSelection.tracks` while a scoped selection is active; `selectedTrackIndices` is untouched. Falls back to the classic track-toggle when no scoped selection is active. Applies to BOTH toggle sites in `EditorLayout` — mouse Cmd+Click (`onToggleSelection`) and keyboard Cmd+Enter (the `toggleTrackSelection` call in the track-panel key handler) — via one shared local helper. (The prototype only wired the mouse path; keyboard parity is required.)

### 3. Scoped operations — every consumer resolves through the helper

- `DELETE_TIME_RANGE` (`contexts/reducers/clipsReducer.ts` — currently keys on `selectedTrackIndices`).
- **Copy/cut time-selection paths** (`hooks/handlers/clipboardHandlers.ts`, both `handleCopy` and `handleCut` priority-1 branches). NEW since the prototype: these also compute the clip-group `wholeGroupIds` capture — the clip collection AND the entirety computation must use the same resolved scope, so cut-scoped-selection → paste regroups exactly what the scope covered. (See `2026-07-07-clip-group-copy-semantics-design.md`.)
- Cmd+Arrow horizontal promote (`useKeyboardShortcuts.ts`).
- Cmd+Arrow vertical (`Canvas.tsx`).
- Drag-clip-into-time-selection (`hooks/useClipMouseDown.ts`).
- `SELECT_CLIPS` reducer stops nudging `focusedTrackIndex` (prototype fix: auto-promotes on wide selections dragged focus to the last promoted row). Callers that want focus-follow dispatch `SET_FOCUSED_TRACK` themselves.

### 4. Scope integrity (new — prototype gap)

`DELETE_TRACK`, `DELETE_TRACKS`, and `MOVE_TRACK` (`contexts/reducers/tracksDomainReducer.ts`) must remap/drop `timeSelection.tracks` indices exactly the way they already remap `selectedTrackIndices`. Without this, deleting a track above the scope silently shifts the scope onto the wrong rows.

### 5. Rendering

`TrackNew` (`packages/components/src/Track/TrackNew.tsx`) computes `inTimeSelectionScope = timeSelection.tracks?.includes(trackIndex) ?? isSelected` and renders three states (prototype visuals, user-validated):

| State | Band |
|---|---|
| in scope | bright band |
| selected, out of scope | subtle white wash (selected fill reads through) |
| unselected, out of scope | original dim band |

### 6. Out of scope

- Persisting `tracks` in saved projects gets no special handling — the field serializes with the object naturally; stale indices on load resolve through the same integrity rules.
- Spectral selection scope — unchanged.
- No changes to clip selection semantics (already decoupled from track selection).

## Testing

- Unit tests for the scope-resolution helper (all three fallback tiers).
- Reducer tests: `DELETE_TIME_RANGE` uses scope over selectedTracks; `SELECT_CLIPS` no longer moves focus; `DELETE_TRACK(S)`/`MOVE_TRACK` remap scope.
- Handler tests: copy/cut scope filtering including `wholeGroupIds` under a scope narrower than the clip spread (a group member outside the scope → partial → pasted ungrouped).
- Characterization updates: any test locking "drag sets track selection" asserts the new behavior instead.
- Gates: guard:any, sandbox suite, apps/sandbox tsc, build. (The `Canvas.tsx:528` tsc error previously flagged on master turned out to be a stale `packages/core/dist` — rebuilding core+components resolves it; no code fix needed. Build packages before running tsc gates.)

## Versioning & docs

- Desktop bump to `0.8.0` on landing (per-behavior versioning convention).
- Document the model in `docs/clip-interactions.md` (or `track-view-navigation.md` if a selection section exists there) + this spec.
