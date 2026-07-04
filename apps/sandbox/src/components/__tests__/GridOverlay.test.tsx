import { describe, it, expect } from 'vitest';
import { computeGrid } from '../GridOverlay';

const CLIP_CONTENT_OFFSET = 8; // any positive offset; assertions are relative to it

describe('computeGrid', () => {
  it('beats-measures: emits lines classified by tier, first line on the measure boundary', () => {
    const { gridLines, measureBands } = computeGrid({
      bpm: 120, beatsPerMeasure: 4, timeFormat: 'beats-measures',
      pixelsPerSecond: 100, width: 2000, clipContentOffset: CLIP_CONTENT_OFFSET,
    });
    expect(gridLines.length).toBeGreaterThan(0);
    expect(gridLines[0]).toEqual({ x: CLIP_CONTENT_OFFSET, tier: 'measure' });
    for (const l of gridLines) {
      expect(['measure', 'beat', 'subdivision']).toContain(l.tier);
      expect(l.x).toBeLessThanOrEqual(2000);
    }
    // alternating bands exist and start at the content offset
    expect(measureBands.length).toBeGreaterThan(0);
    expect(measureBands[0].x).toBe(CLIP_CONTENT_OFFSET);
    expect(measureBands[0].w).toBeGreaterThan(0);
  });

  it('minutes-seconds: emits major/beat lines only (no bands)', () => {
    const { gridLines, measureBands } = computeGrid({
      bpm: 120, beatsPerMeasure: 4, timeFormat: 'minutes-seconds',
      pixelsPerSecond: 100, width: 1000, clipContentOffset: CLIP_CONTENT_OFFSET,
    });
    expect(gridLines.length).toBeGreaterThan(0);
    for (const l of gridLines) expect(['measure', 'beat']).toContain(l.tier);
    expect(measureBands).toEqual([]);
  });
});
