import { useRef, useEffect, useState } from 'react';
import { useTracksDispatch } from '../contexts/TracksContext';
import { snapToGrid, SnapOptions } from '../utils/snapToGrid';

/**
 * Hook for visual-only time stretching of clips.
 *
 * Applies the same stretch ratio derived from the dragged clip to
 * every currently-selected clip (audio + MIDI). `STRETCH_CLIP` is
 * dispatched per clip with that clip's own initial duration / start
 * scaled by the shared ratio, so all selected clips remain visually
 * "in sync" rather than each running their own independent gesture.
 */

export interface ClipStretchInitialState {
  trackIndex: number;
  clipId: number;
  isMidi: boolean;
  initialDuration: number;
  initialStart: number;
  initialStretchFactor: number;
}

export interface ClipStretchState {
  trackIndex: number;
  clipId: number;
  edge: 'left' | 'right';
  /** Initial state of the dragged clip — used to compute the drag ratio. */
  initialDuration: number;
  initialStart: number;
  initialStretchFactor: number;
  /** Snapshots of every selected clip at the start of the gesture. */
  allClipsInitialState: ClipStretchInitialState[];
}

export interface UseClipStretchingOptions {
  containerRef: React.RefObject<HTMLDivElement>;
  tracks: any[];
  pixelsPerSecond: number;
  clipContentOffset: number;
  snapEnabled?: boolean;
  snapOptions?: SnapOptions;
}

export interface UseClipStretchingReturn {
  clipStretchStateRef: React.MutableRefObject<ClipStretchState | null>;
  startClipStretch: (stretchState: ClipStretchState) => void;
  cancelStretch: () => void;
  wasJustStretching: () => boolean;
  /** Time (in seconds) the active stretch has snapped to. */
  snapGuidelineTime: number | null;
}

const MIN_DURATION = 0.1; // never collapse below 100ms
const MIN_STRETCH = 0.1;
const MAX_STRETCH = 10;

export function useClipStretching(
  options: UseClipStretchingOptions,
): UseClipStretchingReturn {
  const { containerRef, tracks, pixelsPerSecond, clipContentOffset, snapEnabled = false, snapOptions } = options;
  const dispatch = useTracksDispatch();
  const clipStretchStateRef = useRef<ClipStretchState | null>(null);
  const justStretchedRef = useRef(false);
  const [snapGuidelineTime, setSnapGuidelineTime] = useState<number | null>(null);

  const startClipStretch = (stretchState: ClipStretchState) => {
    clipStretchStateRef.current = stretchState;
  };

  const cancelStretch = () => {
    clipStretchStateRef.current = null;
    setSnapGuidelineTime(null);
  };

  const wasJustStretching = () => justStretchedRef.current;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !clipStretchStateRef.current) return;
      const s = clipStretchStateRef.current;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const rawMouseTime = Math.max(0, (x - clipContentOffset) / pixelsPerSecond);
      const gridSnap = snapEnabled && !!snapOptions && !e.altKey;
      let mouseTime = rawMouseTime;
      let guideline: number | null = null;

      if (gridSnap) {
        mouseTime = Math.max(0, snapToGrid(rawMouseTime, snapOptions!));
        guideline = mouseTime;
      } else if (!e.altKey) {
        const ALIGN_THRESHOLD_PX = 6;
        const thresholdSec = ALIGN_THRESHOLD_PX / pixelsPerSecond;
        let bestEdge: number | null = null;
        let bestDist = thresholdSec;
        for (let ti = 0; ti < tracks.length; ti++) {
          const t = tracks[ti];
          const allClips = [...(t.clips || []), ...(t.midiClips || [])];
          for (const c of allClips) {
            if (ti === s.trackIndex && c.id === s.clipId) continue;
            for (const edge of [c.start, c.start + c.duration]) {
              const d = Math.abs(edge - rawMouseTime);
              if (d < bestDist) {
                bestDist = d;
                bestEdge = edge;
              }
            }
          }
        }
        if (bestEdge !== null) {
          mouseTime = bestEdge;
          guideline = bestEdge;
        }
      }
      setSnapGuidelineTime(guideline);

      // Compute the drag ratio from the DRAGGED clip's new vs initial
      // duration, then apply that same ratio to every selected clip.
      let ratio: number;
      if (s.edge === 'right') {
        const draggedNewDuration = Math.max(MIN_DURATION, mouseTime - s.initialStart);
        ratio = draggedNewDuration / s.initialDuration;
      } else {
        const draggedInitialRight = s.initialStart + s.initialDuration;
        const draggedNewStart = Math.min(
          draggedInitialRight - MIN_DURATION,
          Math.max(0, mouseTime),
        );
        const draggedNewDuration = draggedInitialRight - draggedNewStart;
        ratio = draggedNewDuration / s.initialDuration;
      }

      s.allClipsInitialState.forEach((c) => {
        const stretchFactor = Math.max(
          MIN_STRETCH,
          Math.min(MAX_STRETCH, c.initialStretchFactor * ratio),
        );
        const newDuration = Math.max(MIN_DURATION, c.initialDuration * ratio);
        if (s.edge === 'right') {
          dispatch({
            type: 'STRETCH_CLIP',
            payload: {
              trackIndex: c.trackIndex,
              clipId: c.clipId,
              newDuration,
              newStretchFactor: stretchFactor,
            },
          });
        } else {
          // Left edge: keep each clip's right edge fixed.
          const newStart = c.initialStart + c.initialDuration - newDuration;
          dispatch({
            type: 'STRETCH_CLIP',
            payload: {
              trackIndex: c.trackIndex,
              clipId: c.clipId,
              newDuration,
              newStretchFactor: stretchFactor,
              newStart,
            },
          });
        }
      });
    };

    const handleMouseUp = () => {
      if (!clipStretchStateRef.current) return;
      cancelStretch();
      // Tell the canvas click handler not to deselect on the click event the
      // browser is about to fire on the LCA of the mousedown + mouseup.
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
  }, [tracks, pixelsPerSecond, clipContentOffset, dispatch, containerRef, snapEnabled, snapOptions]);

  return {
    clipStretchStateRef,
    startClipStretch,
    cancelStretch,
    wasJustStretching,
    snapGuidelineTime,
  };
}
