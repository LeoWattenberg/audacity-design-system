import React from 'react';
import type { Track } from '../../contexts/TracksContext';
import { calculateTrackYOffset } from '../../utils/trackLayout';
import { TOP_GAP, TRACK_GAP, DEFAULT_TRACK_HEIGHT } from '../../constants/canvas';

export interface SplitPreviewLineProps {
  /** Caller is responsible for the split-mode / hover null checks —
   *  this component always renders. */
  splitHover: { x: number; trackIndex: number; shiftKey: boolean };
  tracks: Track[];
  focusColor: string;
}

/** Split-tool preview line. Bare hover shows it spanning just the
 *  hovered track; Shift held extends it across all tracks. */
export function SplitPreviewLine({ splitHover, tracks, focusColor }: SplitPreviewLineProps) {
  const fullSpan = splitHover.shiftKey;
  // Shift extends the line to the full canvas height (top:0 →
  // bottom:0) so it visibly reaches past the last track into the
  // empty area below. Without Shift the line is constrained to
  // the hovered track's body.
  const positional: React.CSSProperties = fullSpan
    ? { top: 0, bottom: 0 }
    : {
        top: `${calculateTrackYOffset(splitHover.trackIndex, tracks, TOP_GAP, TRACK_GAP, DEFAULT_TRACK_HEIGHT)}px`,
        height: `${tracks[splitHover.trackIndex].height || DEFAULT_TRACK_HEIGHT}px`,
      };
  return (
    <div
      style={{
        position: 'absolute',
        left: `${splitHover.x}px`,
        ...positional,
        width: '1px',
        background: focusColor,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  );
}
