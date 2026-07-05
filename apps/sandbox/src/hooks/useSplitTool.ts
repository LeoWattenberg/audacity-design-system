import { useState, useRef, useEffect } from 'react';
import type { Track, TracksAction } from '../contexts/TracksContext';
import { resolveTrackIndexFromY, buildSplitForTrack } from '../utils/canvasGeometry';
import { calculateTrackYOffset } from '../utils/trackLayout';
import { TOP_GAP, TRACK_GAP, DEFAULT_TRACK_HEIGHT, CLIP_HEADER_HEIGHT } from '../constants/canvas';

/** Extract the element type of the `mutations` array from APPLY_CLIP_PLACEMENT. */
type ClipMutation = Extract<TracksAction, { type: 'APPLY_CLIP_PLACEMENT' }>['payload']['mutations'][number];

/** Filter null/undefined from an array with a proper type predicate. */
function compact<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((x): x is T => x != null);
}

export interface UseSplitToolDeps {
  tracks: Track[];
  pixelsPerSecond: number;
  leftPadding: number;
  splitMode: boolean;
  dispatch: React.Dispatch<TracksAction>;
  /** Called when a mousedown lands on a non-body area in split mode — replicates the original !isOverBody path. */
  handleClipMouseDown: (e: React.MouseEvent) => void;
}

export interface UseSplitToolResult {
  splitHover: { x: number; trackIndex: number; shiftKey: boolean } | null;
  handlers: {
    /** Returns true when the event was consumed (Canvas should return early from its handler). */
    onMouseDownCapture: (e: React.MouseEvent) => boolean;
    /** Returns true when the event was handled by the split branch (Canvas should return early). */
    onMouseDown: (e: React.MouseEvent) => boolean;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onClickCapture: (e: React.MouseEvent) => void;
  };
}

export function useSplitTool(deps: UseSplitToolDeps): UseSplitToolResult {
  const { tracks, pixelsPerSecond, leftPadding, splitMode, dispatch, handleClipMouseDown } = deps;

  // Tracks the live cursor position while the split tool is active. Only
  // set when the cursor is hovering over a clip's body (below the clip
  // header). When null, both the cursor swap and preview line stay off so
  // the user knows there's nothing to split at the current position.
  const [splitHover, setSplitHover] = useState<{ x: number; trackIndex: number; shiftKey: boolean } | null>(null);

  // Cache the most recent in-canvas mouse position so toggling split mode
  // can immediately compute splitHover from where the cursor is at toggle
  // time — without waiting for the user to wiggle the mouse.
  const lastMouseRef = useRef<{ x: number; y: number; shiftKey: boolean } | null>(null);

  // Shift state has to track keydown/keyup separately because the user
  // may press/release Shift without moving the mouse. Without this the
  // preview line wouldn't switch between single-track and full-canvas
  // until the next mouse wiggle.
  useEffect(() => {
    if (!splitMode) return;
    const sync = (e: KeyboardEvent) => {
      if (e.key !== 'Shift') return;
      setSplitHover((prev) => (prev && prev.shiftKey !== e.shiftKey ? { ...prev, shiftKey: e.shiftKey } : prev));
    };
    window.addEventListener('keydown', sync);
    window.addEventListener('keyup', sync);
    return () => {
      window.removeEventListener('keydown', sync);
      window.removeEventListener('keyup', sync);
    };
  }, [splitMode]);

  // When split mode is enabled, immediately compute hover from the last
  // known cursor position so the custom cursor / preview line appear
  // without waiting for the next mousemove. Clear hover on disable.
  useEffect(() => {
    if (!splitMode) {
      setSplitHover(null);
      return;
    }
    const last = lastMouseRef.current;
    if (!last) return;
    const trackIndex = resolveTrackIndexFromY(last.y, tracks);
    if (trackIndex === null) return;
    const time = (last.x - leftPadding) / pixelsPerSecond;
    const trackTop = calculateTrackYOffset(trackIndex, tracks, TOP_GAP, TRACK_GAP, DEFAULT_TRACK_HEIGHT);
    const bodyTop = trackTop + CLIP_HEADER_HEIGHT;
    if (last.y >= bodyTop && buildSplitForTrack(trackIndex, time, tracks)) {
      setSplitHover({ x: last.x, trackIndex, shiftKey: last.shiftKey });
    }
  }, [splitMode, leftPadding, pixelsPerSecond, tracks]);

  const onMouseDownCapture = (e: React.MouseEvent): boolean => {
    // Split mode runs in the capture phase so it beats clip-level
    // mousedown handlers (drag start, selection) that would otherwise
    // initiate a drag and clear our just-dispatched selection on
    // mouseup. Outside split mode, this capture handler does nothing
    // and the regular bubble-phase onMouseDown runs.
    if (splitMode && e.button === 0) {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const time = (x - leftPadding) / pixelsPerSecond;
      const ti = resolveTrackIndexFromY(y, tracks);
      const isOverBody = ti !== null && y >= calculateTrackYOffset(ti, tracks, TOP_GAP, TRACK_GAP, DEFAULT_TRACK_HEIGHT) + CLIP_HEADER_HEIGHT;
      if (!isOverBody) return true;
      const mutations: ClipMutation[] = e.shiftKey
        ? compact(tracks.map((_, i) => buildSplitForTrack(i, time, tracks)))
        : (() => {
            const m = buildSplitForTrack(ti, time, tracks);
            return m ? [m as ClipMutation] : [];
          })();
      if (mutations.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        dispatch({
          type: 'APPLY_CLIP_PLACEMENT',
          payload: { placements: [], mutations },
        });
        // Select every left segment — the left side keeps the
        // original clipId, so the mutation's clipId points to it.
        dispatch({
          type: 'SELECT_CLIPS',
          payload: mutations.map((m) => ({
            trackIndex: m.trackIndex,
            clipId: m.clipId,
          })),
        });
      }
      return true;
    }
    return false;
  };

  const onMouseDown = (e: React.MouseEvent): boolean => {
    // --- Split tool intercept (legacy bubble path; kept as a no-op
    //     fallback — the capture handler above takes care of it). ---
    if (splitMode && e.button === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const time = (x - leftPadding) / pixelsPerSecond;
      const ti = resolveTrackIndexFromY(y, tracks);
      // Click must land on a clip BODY (below the header) — same
      // rule the hover preview uses. Header clicks fall through to
      // the normal handler so the menu / focus behaviour still
      // works while split mode is active.
      const isOverBody = ti !== null && y >= calculateTrackYOffset(ti, tracks, TOP_GAP, TRACK_GAP, DEFAULT_TRACK_HEIGHT) + CLIP_HEADER_HEIGHT;
      if (!isOverBody) {
        handleClipMouseDown(e);
        return true;
      }
      const mutations: ClipMutation[] = e.shiftKey
        ? compact(tracks.map((_, i) => buildSplitForTrack(i, time, tracks)))
        : (() => {
            const m = buildSplitForTrack(ti, time, tracks);
            return m ? [m as ClipMutation] : [];
          })();
      if (mutations.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        dispatch({
          type: 'APPLY_CLIP_PLACEMENT',
          payload: { placements: [], mutations },
        });
        // Select the LEFT segment of the split that happened on the
        // user-targeted track (the left segment keeps the original
        // clipId). With Shift held this picks the clip on the row
        // they were hovering, leaving the other tracks unselected.
        const primary = mutations.find((m) => m.trackIndex === ti) ?? mutations[0];
        if (primary) {
          dispatch({
            type: 'SELECT_CLIP',
            payload: { trackIndex: primary.trackIndex, clipId: primary.clipId },
          });
        }
      }
      return true;
    }
    return false;
  };

  const onMouseMove = (e: React.MouseEvent): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    lastMouseRef.current = { x: mx, y: my, shiftKey: e.shiftKey };
    if (splitMode) {
      const trackIndex = resolveTrackIndexFromY(my, tracks);
      const time = (mx - leftPadding) / pixelsPerSecond;
      // Only treat as a valid hover when the cursor is over a clip's
      // BODY (not the header) on the resolved track. Outside of a
      // clip — gaps, headers, empty tracks — we clear hover so the
      // cursor reverts to default and no preview line shows.
      let overClipBody = false;
      if (trackIndex !== null) {
        const trackTop = calculateTrackYOffset(trackIndex, tracks, TOP_GAP, TRACK_GAP, DEFAULT_TRACK_HEIGHT);
        const bodyTop = trackTop + CLIP_HEADER_HEIGHT;
        if (my >= bodyTop) {
          overClipBody = !!buildSplitForTrack(trackIndex, time, tracks);
        }
      }
      if (overClipBody && trackIndex !== null) {
        setSplitHover({ x: mx, trackIndex, shiftKey: e.shiftKey });
      } else if (splitHover) {
        setSplitHover(null);
      }
    } else if (splitHover) {
      setSplitHover(null);
    }
  };

  const onMouseLeave = (_e: React.MouseEvent): void => {
    if (splitHover) setSplitHover(null);
    lastMouseRef.current = null;
  };

  const onClickCapture = (e: React.MouseEvent): void => {
    // Split mode: swallow the click at capture so neither child
    // clip-level click handlers nor the container's blank-area
    // click handler can clear the selection that mousedown just
    // dispatched.
    if (splitMode) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return {
    splitHover,
    handlers: {
      onMouseDownCapture,
      onMouseDown,
      onMouseMove,
      onMouseLeave,
      onClickCapture,
    },
  };
}
