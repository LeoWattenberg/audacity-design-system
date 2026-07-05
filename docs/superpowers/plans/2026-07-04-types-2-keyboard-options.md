# types-2 — De-`any` useKeyboardShortcuts body (spec + plan)

> Single-task slice; design = the twice-approved Procedure P (see `docs/superpowers/plans/2026-07-04-de-any-interaction-cluster.md`). Task review doubles as whole-branch review (branch == task).

**Recon (verified):** `UseKeyboardShortcutsOptions.state` is ALREADY `TracksState` and `dispatch` is `React.Dispatch<TracksAction>`. The file's 15 `any` (grep `: any|as any|<any>`) are all redundant inline body casts/annotations: `state.tracks[x] as any` (302/323/392/841), `(trackForBounds.midiClips as any[])` (513/559), `(c: any)`/`(t: any)`/`(cc: any)` callbacks (520/563/564/668/700/701/702), `(t.clips || []) as any[]` (649), `(c as any).selected` (669).

**Goal:** remove all 15; inference supplies `Track`/`Clip`/`MidiClip`. TYPE-ONLY, zero behavior change.

**Rules (Procedure P):** batch + tsc after each; a surfaced error = real masked access to fix at the access (never re-`any`); genuine gaps keep ONE cast with `// justified:` (known accepted: `stretchFactor` not on Clip/MidiClip; Clip|MidiClip union bridges as `as Clip`-style precise casts). `(t.clips || [])` guard removals only where `clips` is non-optional (it is on sandbox Track) — flag in report.

**Gates:** sandbox tsc 0; core tsc 0; `pnpm --filter @audacity-ui/sandbox test` 168; build green.

- [ ] Task 1: apply Procedure P to `apps/sandbox/src/hooks/useKeyboardShortcuts.ts` (15 → ~0 + justified). Commit `refactor(types): drop redundant any in useKeyboardShortcuts body`.
- [ ] Task 2 (controller): verify gates, recount, review, merge decision.
