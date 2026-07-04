import { useRef, useMemo, useEffect } from 'react';
import type { TracksState, TracksAction } from '../contexts/TracksContext';

export interface UsePianoRollSmoothScrollDeps {
  state: TracksState;
  dispatch: React.Dispatch<TracksAction>;
}

export interface UsePianoRollSmoothScrollResult {
  skipPianoRollScrollRef: React.MutableRefObject<boolean>;
}

export function usePianoRollSmoothScroll(deps: UsePianoRollSmoothScrollDeps): UsePianoRollSmoothScrollResult {
  const { state, dispatch } = deps;

  // Smooth-scroll piano roll to the selected clip's boundary area
  const pianoRollScrollAnimRef = useRef<number | null>(null);
  // When true, the next selectedMidiClipId change will NOT trigger smooth-scroll
  // (used to suppress scroll when selection originates from within the piano roll)
  const skipPianoRollScrollRef = useRef(false);

  const selectedMidiClipId = useMemo(() => {
    if (!state.pianoRollOpen || state.pianoRollTrackIndex === null) return null;
    const track = state.tracks[state.pianoRollTrackIndex];
    return track?.midiClips?.find(c => c.selected)?.id ?? null;
  }, [state.pianoRollOpen, state.pianoRollTrackIndex, state.tracks]);

  useEffect(() => {
    if (selectedMidiClipId === null || state.pianoRollTrackIndex === null) return;
    // Skip scroll when selection was triggered from within the piano roll
    if (skipPianoRollScrollRef.current) {
      skipPianoRollScrollRef.current = false;
      return;
    }

    // Piano roll is in local time — always scroll to the start (0) on clip switch
    const targetScrollX = 0;
    const startScrollX = state.pianoRollScrollX;
    if (Math.abs(targetScrollX - startScrollX) < 1) return;

    const duration = 300; // ms
    const startTime = performance.now();

    // Cancel any in-flight animation
    if (pianoRollScrollAnimRef.current !== null) {
      cancelAnimationFrame(pianoRollScrollAnimRef.current);
    }

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = startScrollX + (targetScrollX - startScrollX) * eased;
      dispatch({ type: 'SET_PIANO_ROLL_SCROLL_X', payload: current });
      if (t < 1) {
        pianoRollScrollAnimRef.current = requestAnimationFrame(animate);
      } else {
        pianoRollScrollAnimRef.current = null;
      }
    };

    pianoRollScrollAnimRef.current = requestAnimationFrame(animate);
    return () => {
      if (pianoRollScrollAnimRef.current !== null) {
        cancelAnimationFrame(pianoRollScrollAnimRef.current);
        pianoRollScrollAnimRef.current = null;
      }
    };
  }, [selectedMidiClipId]);

  return { skipPianoRollScrollRef };
}
