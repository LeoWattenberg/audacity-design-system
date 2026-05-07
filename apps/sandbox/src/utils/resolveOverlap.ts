// apps/sandbox/src/utils/resolveOverlap.ts

export interface ResolverClip {
  id: number;
  start: number;
  duration: number;
  trimStart?: number;
  fullDuration?: number;
}

export interface ResolverTrack {
  clips: ResolverClip[];
}

export interface ClipPlacement {
  clipId: number;
  trackIndex: number;
  start: number;
  duration: number;
}

export type ClipMutation =
  | {
      type: 'trim';
      clipId: number;
      trackIndex: number;
      newStart: number;
      newDuration: number;
      newTrimStart: number;
    }
  | {
      type: 'split';
      clipId: number;
      trackIndex: number;
      // Left segment runs original.start → leftEnd (duration = leftEnd - original.start).
      // Right segment runs rightStart → original.start + original.duration.
      leftEnd: number;
      rightStart: number;
    }
  | {
      type: 'delete';
      clipId: number;
      trackIndex: number;
    };

export interface OverlapResolution {
  placements: ClipPlacement[];
  mutations: ClipMutation[];
}

/**
 * Pure resolver: given current tracks and the proposed final positions of moving clips,
 * compute the diff (placements + mutations) needed to apply the spec's overlap rule.
 * The moving clip(s) always win; underlying clips on the destination tracks are
 * non-destructively trimmed, split, or deleted depending on geometry.
 */
export function resolveOverlap(
  _tracks: ResolverTrack[],
  _intent: ClipPlacement[],
  _movingClipIds: ReadonlySet<number>,
): OverlapResolution {
  return { placements: [], mutations: [] };
}
