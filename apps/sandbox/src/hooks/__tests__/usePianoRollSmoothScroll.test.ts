// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { usePianoRollSmoothScroll } from '../usePianoRollSmoothScroll';
import { initialState, type TracksState } from '../../contexts/TracksContext';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Build a TracksState with a selected MIDI clip so selectedMidiClipId !== null.
// The effect fires when selectedMidiClipId changes from null → some id.
const makeStateWithSelectedClip = (scrollX = 100): TracksState => ({
  ...initialState,
  pianoRollOpen: true,
  pianoRollTrackIndex: 0,
  pianoRollScrollX: scrollX,
  tracks: [
    {
      id: 1,
      name: 'Track 1',
      clips: [],
      midiClips: [{ id: 99, name: 'MIDI Clip', start: 0, duration: 4, notes: [], selected: true }],
    } as any,
  ],
});

const makeStateNoSelection = (): TracksState => ({
  ...initialState,
  pianoRollOpen: true,
  pianoRollTrackIndex: 0,
  pianoRollScrollX: 100,
  tracks: [
    {
      id: 1,
      name: 'Track 1',
      clips: [],
      midiClips: [{ id: 99, name: 'MIDI Clip', start: 0, duration: 4, notes: [], selected: false }],
    } as any,
  ],
});

// Stub requestAnimationFrame to run callbacks synchronously (one shot per call).
// This drives the RAF ease-out loop without relying on fake timers + browser RAF.
//
// Approach: performance.now() returns 0 on the first call (capturing startTime)
// and 400ms on subsequent calls (inside the animate callback). With elapsed=400
// and duration=300, t = min(1, 400/300) = 1 → animation completes in one frame,
// so requestAnimationFrame is NOT called again (t >= 1 path) — no infinite recursion.
function stubRafImmediate() {
  let nowCallCount = 0;
  vi.stubGlobal('performance', {
    now: vi.fn(() => {
      // First call: startTime capture → 0
      // Subsequent calls (inside animate): 400ms elapsed → t = 1 → complete
      return nowCallCount++ === 0 ? 0 : 400;
    }),
  });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(400); // invoke immediately; t = min(1, 400/300) = 1 → no further rAF call
    return 1; // fake handle
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
}

describe('usePianoRollSmoothScroll', () => {
  describe('dispatch behavior', () => {
    it('dispatches SET_PIANO_ROLL_SCROLL_X when a clip becomes selected and scrollX differs from target', () => {
      stubRafImmediate();
      const dispatch = vi.fn();
      // Start with no selection so selectedMidiClipId = null (no effect trigger)
      const initialProps = { state: makeStateNoSelection(), dispatch };
      const { rerender } = renderHook(
        ({ state, dispatch: d }) => usePianoRollSmoothScroll({ state, dispatch: d }),
        { initialProps },
      );

      // Now select the clip — selectedMidiClipId changes null → 99 → triggers effect
      act(() => {
        rerender({ state: makeStateWithSelectedClip(100), dispatch });
      });

      expect(dispatch.mock.calls.some(c => c[0].type === 'SET_PIANO_ROLL_SCROLL_X')).toBe(true);
    });

    it('returns skipPianoRollScrollRef initialized to false', () => {
      stubRafImmediate();
      const dispatch = vi.fn();
      const { result } = renderHook(() =>
        usePianoRollSmoothScroll({ state: makeStateNoSelection(), dispatch }),
      );
      expect(result.current.skipPianoRollScrollRef.current).toBe(false);
    });

    it('suppresses dispatch when skipPianoRollScrollRef is true at the time of effect run', () => {
      stubRafImmediate();
      const dispatch = vi.fn();
      const initialProps = { state: makeStateNoSelection(), dispatch };
      const { result, rerender } = renderHook(
        ({ state, dispatch: d }) => usePianoRollSmoothScroll({ state, dispatch: d }),
        { initialProps },
      );

      // Set the skip flag before the effect would fire
      act(() => {
        result.current.skipPianoRollScrollRef.current = true;
      });

      // Trigger the effect by changing selectedMidiClipId
      act(() => {
        rerender({ state: makeStateWithSelectedClip(100), dispatch });
      });

      // The effect should have cleared the flag and returned early — no dispatch
      expect(dispatch.mock.calls.some(c => c[0].type === 'SET_PIANO_ROLL_SCROLL_X')).toBe(false);
      // Flag should be reset to false after being consumed
      expect(result.current.skipPianoRollScrollRef.current).toBe(false);
    });

    it('does not animate when scrollX is already at target (< 1px diff)', () => {
      stubRafImmediate();
      const dispatch = vi.fn();
      // scrollX = 0 which equals targetScrollX = 0, diff < 1 → early return
      const initialProps = { state: makeStateNoSelection(), dispatch };
      const { rerender } = renderHook(
        ({ state, dispatch: d }) => usePianoRollSmoothScroll({ state, dispatch: d }),
        { initialProps },
      );

      act(() => {
        rerender({ state: makeStateWithSelectedClip(0), dispatch });
      });

      expect(dispatch.mock.calls.some(c => c[0].type === 'SET_PIANO_ROLL_SCROLL_X')).toBe(false);
    });
  });
});
