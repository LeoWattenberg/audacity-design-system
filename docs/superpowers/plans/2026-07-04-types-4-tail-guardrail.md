# types-4 — Tail sweep, logged follow-ups, and the `any` guardrail (spec + plan)

> Final slice of the type campaign. Three implementer tasks + controller verify. Per-task review; final review doubles with T3's.

**State:** ~50 `any` remain across 16 sandbox files (several already justified). Backlog follow-ups from prior reviews are in `.superpowers/sdd/progress.md` history and repeated below.

## Task 1 — Logged follow-ups (from fable's types-1 review)
Files: `AppDialogs.tsx`, `useKeyboardShortcuts.ts` (ClipboardState), `AppContextMenus.tsx`, `App.tsx`.
1. AppDialogs deferred-typables: `activeProfile`/`profiles` → `AccessibilityProfile` (exported at `packages/core/src/accessibility/types.ts:142`, re-exported via core); `indexedDBProjects: any[]` → `StoredProject[]` (`apps/sandbox/src/utils/projectDatabase.ts:81`) — ALSO type App.tsx's matching `useState<any[]>` (line ~130) so producer+consumer agree; `updatePreference: (key: string, value: any)` → mirror the precise signature from `usePreferences()` (read it). `audioManagerRef: React.RefObject<any>` stays but gets `// justified: AudioPlaybackManager cluster deferred (PlaybackContext blocker)`.
2. **ClipboardState honest union:** `clips: ((Clip | MidiClip) & { trackIndex: number })[]` (import `MidiClip` type from `@audacity-ui/core`); update the paste path in `clipboardHandlers.ts` to handle the union honestly (it reads only union-common fields — per fable's trace — so this should be annotation-level); DELETE the two `as Clip & {...}` bridges in `AppContextMenus.tsx` (now unneeded). If paste genuinely reads a Clip-only field tsc flags, STOP → DONE_WITH_CONCERNS.
3. **Load-boundary normalization (SMALL RUNTIME HARDENING — disclose, don't hide):** at App.tsx's `SET_TRACKS` from persisted data (~line 1668), normalize `clips: t.clips ?? []` (and `midiClips` if same risk) so the non-optional `Track.clips` invariant holds for external data. This is the ONE intentional runtime change in the slice — report it as such (DONE_WITH_CONCERNS convention).
Gates + commit per group.

## Task 2 — Tail sweep (Procedure P, per file)
Files & counts: `clipsReducer.ts` 6, `App.tsx` 6, `audioPlayback.ts` 4, `useSplitTool.ts` 4, `trackSelection.ts` 2, `projectDatabase.ts` 2, `usePlaybackControls.ts` 2, `useMarqueeSelection.ts` 2, `tracksDomainReducer.ts` 2, `cutOperations.ts` 1, `TokenReview.tsx` 1, `useRecording.ts` 1, `useContainerClick.ts` 1. (Canvas 6 + EditorLayout 3 + AppDialogs residual are already justified keeps — SKIP except to ensure each carries `// justified:`.)
- Standard rules: remove redundant; fix surfaced accesses; precise casts over `any`; keeps require `// justified:`. Special case `Effect.parameters?: Record<string, any>` (TracksContext + clipsReducer): try `Record<string, unknown>`; if accesses cascade beyond these files, keep `Record<string, any>` with `// justified: open effect-param shape` instead. `stretchFactor` casts in useSplitTool/tracksDomainReducer (if that's what they are): keep, justified (product: stretch is audio-only, MidiClip must NOT get stretchFactor — see memory).
Commit per 3-4 files.

## Task 3 — The guardrail (dependency-free; no ESLint adoption in this slice)
Create `scripts/check-any.mjs` (node, zero deps): scan `apps/sandbox/src/**/*.{ts,tsx}` and `packages/*/src/**/*.{ts,tsx}` excluding `__tests__`/`*.test.*`/`dist`; regex `: any\b|as any\b|<any[,>]`; a match line is OK iff it contains `// justified:`; otherwise collect. Exit 1 with a file:line listing and the message "every `any` needs a `// justified:` comment — see docs/codebase-map.md". Add root package.json script `"guard:any": "node scripts/check-any.mjs"`, and chain it into the sandbox `"test"` script (`node ../../scripts/check-any.mjs && vitest run`) so it runs on every test invocation. Ensure the CURRENT tree passes (annotate any stragglers found). Document the convention in `docs/codebase-map.md` (one paragraph) + note ESLint adoption as future infra. Commit.

**Gates (every task):** sandbox tsc 0; core tsc 0; 168 tests; sandbox build. T3 additionally: `pnpm guard:any` exits 0 on clean tree and exits 1 when a test `any` is temporarily injected (prove both, then remove the injection).

**Out of scope:** ESLint adoption; the `tracks as any` boundary already justified in Canvas; packages/components' justified keeps.
