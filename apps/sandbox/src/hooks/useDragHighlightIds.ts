import React from 'react';
import type { ClipDragState, Track } from '../contexts/TracksContext';

export interface UseDragHighlightIdsOptions {
  isDraggingClips: boolean;
  clipDragStateRef: React.MutableRefObject<ClipDragState | null>;
  isCmdArrowMoving: boolean;
  tracks: Track[];
}

export interface UseDragHighlightIdsReturn {
  draggingClipIds: Set<number>;
  raisedClipIds: Set<number>;
}

/**
 * Derives the clip-id sets Canvas uses to highlight clips mid-drag:
 * `draggingClipIds` (mouse-drag ghosting) and `raisedClipIds` (Cmd+Arrow
 * keyboard nudge z-index lift). Verbatim relocation of Canvas.tsx's
 * `draggingClipIds` / `raisedClipIds` useMemos, including their dependency
 * arrays.
 */
export function useDragHighlightIds(options: UseDragHighlightIdsOptions): UseDragHighlightIdsReturn {
  const { isDraggingClips, clipDragStateRef, isCmdArrowMoving, tracks } = options;

  const draggingClipIds = React.useMemo(() => {
    if (!isDraggingClips) return new Set<number>();
    const dragState = clipDragStateRef.current;
    if (!dragState) return new Set<number>();
    if (dragState.selectedClipsInitialPositions && dragState.selectedClipsInitialPositions.length > 1) {
      return new Set<number>(dragState.selectedClipsInitialPositions.map(p => p.clipId));
    }
    return new Set<number>([dragState.clip.id]);
  }, [isDraggingClips, clipDragStateRef]);

  // Every selected clip while Cmd/Ctrl is held during a Cmd+Arrow
  // clip nudge. Used to lift z-index only — the ghost 50% opacity
  // that mouse-drag applies is intentionally omitted so keyboard
  // moves render the clip solidly on top of anything it passes over.
  const raisedClipIds = React.useMemo(() => {
    if (!isCmdArrowMoving) return new Set<number>();
    const ids = new Set<number>();
    tracks.forEach((t) => {
      t.clips.forEach((c) => {
        if (c.selected) ids.add(c.id);
      });
      (t.midiClips || []).forEach((c) => {
        if (c.selected) ids.add(c.id);
      });
    });
    return ids;
  }, [isCmdArrowMoving, tracks]);

  return { draggingClipIds, raisedClipIds };
}
