# Design: Clip-Group Semantics for Copied Clips

**Date:** 2026-07-07
**Base branch:** `master`
**Status:** Design approved by user (this doc = the review artifact). Extends `2026-05-07-clip-grouping-design.md`.
**Kind:** DELIBERATE BEHAVIOR CHANGE (first intentional behavior work since the design freeze) — user-driven product decision.

## The question that prompted this

"If I duplicate a track that contains some, but not all, members of a clip group — what should happen?"

## What the code does today (verified — a latent design bug)

Every clone path spreads the source clip WITHOUT stripping `groupId`, so **copies silently join the original group**:
- `duplicateHandlers.ts` clip path (~line 63): `{ ...clip, id, start, selected, sourceClipId }` — dup inherits `groupId`.
- `duplicateHandlers.ts` track path (~line 114): `clips.map(c => ({ ...c, id, sourceClipId }))` — all clones inherit.
- `clipboardHandlers.ts` copy/cut (~31/51/75/106) and paste (~163/198): `{ ...clip }` / `{ ...clipData }` — clipboard and pasted clips inherit.

Consequence: selecting a duplicate auto-expands (via `expandSelectionToGroups`) to the ORIGINALS — dragging a copy drags its sources. Nobody designed this.

## The approved invariant

> **Copies never share a group with their originals. Copies form a fresh group of their own if and only if every member of the original group was copied whole — otherwise they are ungrouped.**

Sub-rules:
1. **No tethering:** a copied clip never carries the original `groupId`.
2. **Entirety → fresh group:** if the copied set contains ALL members of a group, the copies get one new `groupId` (structure preserved, independent of originals).
3. **Partial → ungrouped:** if only some members were copied, the copies have `groupId: undefined`. (This answers the original question: duplicating a track with partial members of a cross-track group → those copies are ungrouped.)
4. **Strict entirety (user decision — "whole clips only"):** a member counts as copied only if it is copied **whole and untrimmed**. A time-range fragment is NOT the member — any slicing → rule 3 applies. Rationale: a fragment is a different object; simplest mental model.
5. **Dissolve-below-two:** if rule 2 would ever create a fresh group with <2 members, the copies are ungrouped instead (mirrors existing `GROUP_SELECTED_CLIPS` dissolution semantics).

Key design insight: because selection auto-expands to whole groups in this app, partial-group situations arise only from **scope-bounded operations** (track duplication, time-range copy) — so the rule is defined on *the copied set*, not the selection.

## Behavior matrix

| Operation | Group situation | Copies come out |
|---|---|---|
| Ctrl+D clip(s) | whole group (selection auto-expands) | fresh group |
| Duplicate track | group entirely on that track | fresh group |
| Duplicate track | group spans tracks (partial on this track) | ungrouped |
| Copy/cut → paste | whole group in clipboard | fresh group |
| Copy/cut → paste | partial members in clipboard | ungrouped |
| Time-selection copy/cut → paste | all members covered whole + untrimmed | fresh group |
| Time-selection copy/cut → paste | any member sliced or omitted | ungrouped |
| Any | fresh group would have <2 members | ungrouped |

**Source-side corollary:** operations that REMOVE group members from the timeline (cut, delete-time-range, delete clip) must dissolve the surviving original group if it drops below 2 members. Implementer verifies whether delete paths already do this and aligns them (report current behavior).

## Implementation shape

- **One pure helper:** `apps/sandbox/src/utils/clipGroupCopy.ts` exporting `regroupCopiedClips(copiedClips, sourceTracks)` → returns the copies with fresh `groupId`s (rule 2) or `groupId: undefined` (rules 3–5). Determines per-group entirety by comparing the copied set against `sourceTracks` (all member clip ids present AND each copy untrimmed relative to its source — same `duration`/`trimStart` semantics as the source clip). Fresh ids minted the same way `GROUP_SELECTED_CLIPS` mints them (read the reducer; mirror exactly).
- **Every clone path calls it:** `duplicateHandlers.ts` (clip + track paths), `clipboardHandlers.ts` (at paste time — paste, not copy, so the clipboard retains source `groupId`s for the entirety computation; NOTE: entirety should be computed against the state AT COPY TIME — simplest correct approach: compute entirety at copy/cut time and store a per-clip `wholeGroupCopied` marker or strip/assign at copy time; implementer picks the approach that keeps paste deterministic even if originals changed after copy, and documents it), and the `AppContextMenus` track-duplicate path if separate from `duplicateHandlers`.
- MIDI clips: groups are audio-clip domain today (`Clip.groupId`; `MidiClip` has none) — no MIDI changes.

## Testing

- Unit tests for `regroupCopiedClips` covering EVERY matrix row + the dissolve-below-two edge.
- This is an intended behavior change: update the existing `clipGrouping` characterization tests where today's tether-to-original behavior is implicitly locked; new tests assert the NEW spec.
- Full suite + guard + both tsc + build gates as standard.
- Manual smoke (user, as designer): duplicate a track with a cross-track group → copies ungrouped; Ctrl+D a grouped clip → duplicate group moves independently of the original.

## Docs

- Extend `docs/superpowers/specs/2026-05-07-clip-grouping-design.md` lineage by reference (this doc).
- Add the invariant + matrix summary to `docs/clip-interactions.md`.

## Out of scope

- Split behavior of grouped clips (segments inheriting group on split) — existing behavior, unchanged.
- MIDI clip grouping (doesn't exist).
- Real MIDI paste path (separate parked feature).
