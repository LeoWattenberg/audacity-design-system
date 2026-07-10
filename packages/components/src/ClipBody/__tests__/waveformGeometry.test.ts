import { describe, it, expect } from 'vitest';
import { computeWaveformGeometry } from '../waveformGeometry';

describe('computeWaveformGeometry', () => {
  it('derives sample rate from full duration and computes samples per pixel', () => {
    // 50_000 samples/sec over 2s = 100_000 samples; 100 px/s, no stretch
    const g = computeWaveformGeometry({
      dataLength: 100_000,
      clipFullDuration: 2,
      clipTrimStart: 0,
      clipDuration: 2,
      pixelsPerSecond: 100,
      clipStretchFactor: 1,
    });
    expect(g.samplesPerPixel).toBeCloseTo(500); // 50_000 / 100
    expect(g.trimStartSample).toBe(0);
  });

  it('falls back to trimStart + duration when clipFullDuration is undefined', () => {
    const g = computeWaveformGeometry({
      dataLength: 150_000,
      clipFullDuration: undefined,
      clipTrimStart: 1,
      clipDuration: 2, // fullDuration = 3 → rate 50_000
      pixelsPerSecond: 100,
      clipStretchFactor: 1,
    });
    expect(g.samplesPerPixel).toBeCloseTo(500);
    expect(g.trimStartSample).toBe(50_000); // floor(1 * 50_000)
  });

  it('divides samples per pixel by the stretch factor', () => {
    const g = computeWaveformGeometry({
      dataLength: 100_000,
      clipFullDuration: 2,
      clipTrimStart: 0.5,
      clipDuration: 1.5,
      pixelsPerSecond: 100,
      clipStretchFactor: 2,
    });
    expect(g.samplesPerPixel).toBeCloseTo(250);
    expect(g.trimStartSample).toBe(25_000);
  });
});
