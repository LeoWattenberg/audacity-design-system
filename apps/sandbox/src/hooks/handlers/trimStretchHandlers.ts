import type { TracksState, TracksAction } from '../../contexts/TracksContext';

/**
 * Keyboard shortcuts for trimming and stretching the currently
 * selected clips.
 *
 * Bindings (handled by useKeyboardShortcuts):
 *   [          → trim left edge in    (shrink)
 *   ]          → trim right edge in   (shrink)
 *   Shift+[    → trim left edge out   (extend)
 *   Shift+]    → trim right edge out  (extend)
 *   Alt+[      → stretch left in      (shorter)
 *   Alt+]      → stretch right in     (shorter)
 *   Alt+Shift+[→ stretch left out     (longer)
 *   Alt+Shift+]→ stretch right out    (longer)
 *
 * Every action applies to ALL selected clips at once, matching the
 * mouse-drag handles' multi-selection behaviour.
 */

export interface TrimStretchHandlerDeps {
  state: TracksState;
  dispatch: React.Dispatch<TracksAction>;
}

const TRIM_STEP_SECONDS = 0.1;
const STRETCH_RATIO_STEP = 1.1; // 10% per keystroke; reverse via 1/STRETCH_RATIO_STEP
const MIN_DURATION = 0.05;
const MIN_STRETCH = 0.1;
const MAX_STRETCH = 10;

interface SelectedClip {
  trackIndex: number;
  clipId: number;
  isMidi: boolean;
  start: number;
  duration: number;
  trimStart: number;
  fullDuration: number;
  stretchFactor: number;
}

/** Collect every selected audio + MIDI clip with the fields needed to
 *  compute new trim / stretch state. */
function collectSelectedClips(state: TracksState): SelectedClip[] {
  const out: SelectedClip[] = [];
  state.tracks.forEach((track, trackIndex) => {
    track.clips.forEach((c: any) => {
      if (c.selected) {
        const trimStart = c.trimStart ?? 0;
        const stretchFactor = c.stretchFactor ?? 1;
        const fullDuration = c.fullDuration ?? trimStart + c.duration / stretchFactor;
        out.push({
          trackIndex,
          clipId: c.id,
          isMidi: false,
          start: c.start,
          duration: c.duration,
          trimStart,
          fullDuration,
          stretchFactor,
        });
      }
    });
    (track.midiClips || []).forEach((c: any) => {
      if (c.selected) {
        const trimStart = c.trimStart ?? 0;
        const stretchFactor = c.stretchFactor ?? 1;
        const fullDuration = c.fullDuration ?? trimStart + c.duration;
        out.push({
          trackIndex,
          clipId: c.id,
          isMidi: true,
          start: c.start,
          duration: c.duration,
          trimStart,
          fullDuration,
          stretchFactor,
        });
      }
    });
  });
  return out;
}

/** Trim the left or right edge of every selected clip. Positive
 *  `deltaSeconds` shrinks (edge moves inward); negative extends. */
export function handleTrimEdge(
  edge: 'left' | 'right',
  deltaSeconds: number,
  deps: TrimStretchHandlerDeps,
): void {
  const { state, dispatch } = deps;
  const clips = collectSelectedClips(state);
  if (clips.length === 0) return;

  for (const c of clips) {
    if (edge === 'left') {
      // Positive delta = pull left edge right (shrink).
      // Negative = pull left edge left (extend, reveal trimmed audio).
      const sourceDelta = deltaSeconds / c.stretchFactor;
      const newTrimStart = Math.max(
        0,
        Math.min(c.fullDuration - MIN_DURATION / c.stretchFactor, c.trimStart + sourceDelta),
      );
      const trimAppliedDelta = (newTrimStart - c.trimStart) * c.stretchFactor;
      const newDuration = Math.max(MIN_DURATION, c.duration - trimAppliedDelta);
      const newStart = Math.max(0, c.start + trimAppliedDelta);
      if (newDuration === c.duration && newStart === c.start) continue;
      dispatch({
        type: 'TRIM_CLIP',
        payload: {
          trackIndex: c.trackIndex,
          clipId: c.clipId,
          newTrimStart,
          newDuration,
          newStart,
        },
      });
    } else {
      // Right edge. Positive delta shrinks; negative extends.
      const maxAvailableDuration = (c.fullDuration - c.trimStart) * c.stretchFactor;
      const newDuration = Math.max(
        MIN_DURATION,
        Math.min(maxAvailableDuration, c.duration - deltaSeconds),
      );
      if (newDuration === c.duration) continue;
      dispatch({
        type: 'TRIM_CLIP',
        payload: {
          trackIndex: c.trackIndex,
          clipId: c.clipId,
          newTrimStart: c.trimStart,
          newDuration,
        },
      });
    }
  }
}

/** Stretch every selected clip. `direction` is 'longer' or 'shorter'.
 *  Left-edge stretches keep each clip's right edge fixed; right-edge
 *  stretches keep the left edge fixed. */
export function handleStretchEdge(
  edge: 'left' | 'right',
  direction: 'longer' | 'shorter',
  deps: TrimStretchHandlerDeps,
): void {
  const { state, dispatch } = deps;
  const clips = collectSelectedClips(state);
  if (clips.length === 0) return;

  const ratio = direction === 'longer' ? STRETCH_RATIO_STEP : 1 / STRETCH_RATIO_STEP;

  for (const c of clips) {
    const newStretchFactor = Math.max(
      MIN_STRETCH,
      Math.min(MAX_STRETCH, c.stretchFactor * ratio),
    );
    if (newStretchFactor === c.stretchFactor) continue;
    const actualRatio = newStretchFactor / c.stretchFactor;
    const newDuration = Math.max(MIN_DURATION, c.duration * actualRatio);

    if (edge === 'right') {
      dispatch({
        type: 'STRETCH_CLIP',
        payload: {
          trackIndex: c.trackIndex,
          clipId: c.clipId,
          newDuration,
          newStretchFactor,
        },
      });
    } else {
      const newStart = Math.max(0, c.start + c.duration - newDuration);
      dispatch({
        type: 'STRETCH_CLIP',
        payload: {
          trackIndex: c.trackIndex,
          clipId: c.clipId,
          newDuration,
          newStretchFactor,
          newStart,
        },
      });
    }
  }
}

export const TRIM_STRETCH_STEP_SECONDS = TRIM_STEP_SECONDS;
