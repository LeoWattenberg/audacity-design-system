# Design: types-1 — Context-Adoption Trio (AppDialogs, AppContextMenus, LabelRenderer)

**Date:** 2026-07-04
**Base branch:** `master`
**Status:** Approved for planning

## Goal

Apply the twice-proven EditorLayout pattern to the three remaining `state`/`dispatch` `any`-prop consumers, then strip their now-redundant inline `any`. First slice of the "finish all type work" program (see `memory/project-prototyping-machine-mission.md`).

## Motivation & recon (verified)

- `AppDialogs.tsx` (23 `any`): receives `dispatch: React.Dispatch<any>` (~line 33) and `state: any` (~line 129) as props, drilled from App (`<AppDialogs` ~1925, `dispatch={dispatch}` ~1930, `state={state}` ~1994). Recon (temp-typing state/dispatch): **0 tsc errors surface** — free.
- `AppContextMenus.tsx` (10 `any`): `dispatch: React.Dispatch<any>` (~line 18), drilled from App (`<AppContextMenus` ~1997, `dispatch={dispatch}` ~2002). Recon: 1 surfaced item.
- `LabelRenderer.tsx`: `dispatch: (action: any) => void;` prop (~line 18), passed by Canvas. Recon: 1 surfaced item (possibly probe artifact).

All three render inside `TracksProvider`; App/Canvas already source `state`/`dispatch` from `useTracks()`/`useTracksDispatch()` — so context adoption is a **source flip** (identity preserved, zero behavior change), exactly as with EditorLayout.

## Scope

1. **AppDialogs + AppContextMenus:** adopt `useTracks()` inside the component; delete `state`/`dispatch` from their props interfaces and from App's call sites. Fix any surfaced tsc error at the access (never re-`any`).
2. **LabelRenderer:** it is a child of Canvas (which passes its own context-sourced `dispatch`). Prefer adopting `useTracksDispatch()` directly and dropping the prop (consistent with the campaign); if adoption is awkward (e.g. the component is meant to stay prop-driven/presentational), instead type the prop precisely as `React.Dispatch<TracksAction>`. Executor decides with evidence and documents the choice.
3. **De-`any` cleanup (all three files):** with `state`/`dispatch` typed, strip the redundant inline `(x: any)` annotations and lazy casts per the established Procedure-P rules — batch + tsc-gate; justified casts kept only with `// justified:` comments; no new `any`.

## Constraints

- **Behavior-preserving.** Context adoption is a source flip; annotation removal is type-only. No logic/value/control-flow changes.
- Don't touch other `any` clusters (`useKeyboardShortcuts` options, AudioEngine, RecordingManager — later slices).
- Feature branch off `master`; standing gates: sandbox tsc, **core tsc**, 168 sandbox tests, sandbox build.

## Verification

Per task: sandbox tsc clean + full suite green. Final: both tscs clean, build green, `any` recount per file (AppDialogs 23→~0, AppContextMenus 10→~0, LabelRenderer dispatch typed), manual smoke deferred (dialogs open, context menus act, labels drag/delete).

## Success criteria

The last drilled `any`-typed `state`/`dispatch` props in the app are gone; the trio is compiler-checked; no behavior change.
