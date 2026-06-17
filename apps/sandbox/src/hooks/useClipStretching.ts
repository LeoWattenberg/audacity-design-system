import { useRef, useEffect } from 'react';
import { useTracksDispatch } from '../contexts/TracksContext';

/**
 * Hook for visual-only time stretching of a clip.
 *
 * Mirrors useClipTrimming in shape but is much simpler: stretch doesn't touch
 * trim, doesn't snap to neighbors, and only affects the dragged clip. The
 * dispatched STRETCH_CLIP action updates duration + stretchFactor so the
 * waveform renders horizontally expanded / compressed without the underlying
 * audio data changing.
 */
export interface ClipStretchState {
  trackIndex: number;
  clipId: number;
  edge: 'left' | 'right';
  initialDuration: number;
  initialStart: number;
  initialStretchFactor: number;
}

export interface UseClipStretchingOptions {
  containerRef: React.RefObject<HTMLDivElement>;
  tracks: any[];
  pixelsPerSecond: number;
  clipContentOffset: number;
}

export interface UseClipStretchingReturn {
  clipStretchStateRef: React.MutableRefObject<ClipStretchState | null>;
  startClipStretch: (stretchState: ClipStretchState) => void;
  cancelStretch: () => void;
  /**
   * Mirrors the time-selection hook's wasJustDragging: returns true for a
   * brief window after a stretch drag ends. Canvas's track-background click
   * handler reads this to skip its `DESELECT_ALL_CLIPS` dispatch, which
   * otherwise fires when the browser synthesises a click on the LCA of the
   * mousedown (stretch handle) and mouseup (track area).
   */
  wasJustStretching: () => boolean;
}

const MIN_DURATION = 0.1; // never collapse below 100ms
const MIN_STRETCH = 0.1;
const MAX_STRETCH = 10;

export function useClipStretching(
  options: UseClipStretchingOptions,
): UseClipStretchingReturn {
  const { containerRef, tracks, pixelsPerSecond, clipContentOffset } = options;
  const dispatch = useTracksDispatch();
  const clipStretchStateRef = useRef<ClipStretchState | null>(null);
  const justStretchedRef = useRef(false);

  const startClipStretch = (stretchState: ClipStretchState) => {
    clipStretchStateRef.current = stretchState;
  };

  const cancelStretch = () => {
    clipStretchStateRef.current = null;
  };

  const wasJustStretching = () => justStretchedRef.current;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !clipStretchStateRef.current) return;
      const stretchState = clipStretchStateRef.current;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const mouseTime = Math.max(0, (x - clipContentOffset) / pixelsPerSecond);

      if (stretchState.edge === 'right') {
        // Drag right edge: new duration = mouseTime - clip.start.
        const newDuration = Math.max(MIN_DURATION, mouseTime - stretchState.initialStart);
        const ratio = newDuration / stretchState.initialDuration;
        const newStretchFactor = Math.max(
          MIN_STRETCH,
          Math.min(MAX_STRETCH, stretchState.initialStretchFactor * ratio),
        );
        dispatch({
          type: 'STRETCH_CLIP',
          payload: {
            trackIndex: stretchState.trackIndex,
            clipId: stretchState.clipId,
            newDuration,
            newStretchFactor,
          },
        });
      } else {
        // Drag left edge: shift the start so the right edge stays put.
        const initialRight = stretchState.initialStart + stretchState.initialDuration;
        const newStart = Math.min(initialRight - MIN_DURATION, Math.max(0, mouseTime));
        const newDuration = initialRight - newStart;
        const ratio = newDuration / stretchState.initialDuration;
        const newStretchFactor = Math.max(
          MIN_STRETCH,
          Math.min(MAX_STRETCH, stretchState.initialStretchFactor * ratio),
        );
        dispatch({
          type: 'STRETCH_CLIP',
          payload: {
            trackIndex: stretchState.trackIndex,
            clipId: stretchState.clipId,
            newDuration,
            newStretchFactor,
            newStart,
          },
        });
      }
    };

    const handleMouseUp = () => {
      if (!clipStretchStateRef.current) return;
      cancelStretch();
      // Tell the canvas click handler not to deselect on the click event the
      // browser is about to fire on the LCA of the mousedown + mouseup.
      // 0ms timeout lets the synthesised click run between mouseup and the
      // next macrotask, then we reset.
      justStretchedRef.current = true;
      setTimeout(() => {
        justStretchedRef.current = false;
      }, 0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [tracks, pixelsPerSecond, clipContentOffset, dispatch, containerRef]);

  return { clipStretchStateRef, startClipStretch, cancelStretch, wasJustStretching };
}
