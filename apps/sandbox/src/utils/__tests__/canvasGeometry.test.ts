import { describe, it, expect } from 'vitest';
import { resolveTrackIndexFromY, buildSplitForTrack } from '../canvasGeometry';
import type { Track } from '../../contexts/TracksContext';

// TOP_GAP=2, TRACK_GAP=2, DEFAULT_TRACK_HEIGHT=114
const twoTracks = [
  { id: 1, name: 'a', clips: [{ id: 10, name: 'c', start: 0, duration: 5, envelopePoints: [] }] },
  { id: 2, name: 'b', clips: [] },
] as unknown as Track[];

describe('resolveTrackIndexFromY', () => {
  it('returns track 0 for a Y inside the first row', () => {
    expect(resolveTrackIndexFromY(2, twoTracks)).toBe(0);      // at TOP_GAP
    expect(resolveTrackIndexFromY(100, twoTracks)).toBe(0);    // inside row 0 (2..116)
  });
  it('returns track 1 for a Y inside the second row', () => {
    expect(resolveTrackIndexFromY(200, twoTracks)).toBe(1);    // row1 starts 2+114+2=118
  });
  it('returns null past the last row', () => {
    expect(resolveTrackIndexFromY(100000, twoTracks)).toBeNull();
  });
});

describe('buildSplitForTrack', () => {
  it('returns a split mutation for a time strictly inside a clip', () => {
    expect(buildSplitForTrack(0, 2.5, twoTracks)).toEqual({
      type: 'split', clipId: 10, trackIndex: 0, leftEnd: 2.5, rightStart: 2.5,
    });
  });
  it('returns null at a clip edge (no zero-width split)', () => {
    expect(buildSplitForTrack(0, 0, twoTracks)).toBeNull();
    expect(buildSplitForTrack(0, 5, twoTracks)).toBeNull();
  });
  it('returns null on an empty track and an out-of-range index', () => {
    expect(buildSplitForTrack(1, 1, twoTracks)).toBeNull();
    expect(buildSplitForTrack(99, 1, twoTracks)).toBeNull();
  });
});
