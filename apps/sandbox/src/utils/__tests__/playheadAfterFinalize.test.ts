import { describe, it, expect } from 'vitest';
import { playheadAfterSelectionFinalize } from '../playheadAfterFinalize';

describe('playheadAfterSelectionFinalize', () => {
  const sel = { startTime: 2, endTime: 5 };

  it('playhead inside the range → null (do not move)', () => {
    expect(playheadAfterSelectionFinalize(3, sel)).toBeNull();
  });

  it('playhead exactly at the start edge → null', () => {
    expect(playheadAfterSelectionFinalize(2, sel)).toBeNull();
  });

  it('playhead exactly at the end edge → null', () => {
    expect(playheadAfterSelectionFinalize(5, sel)).toBeNull();
  });

  it('playhead before the range → selection start', () => {
    expect(playheadAfterSelectionFinalize(1, sel)).toBe(2);
  });

  it('playhead after the range → selection start', () => {
    expect(playheadAfterSelectionFinalize(7, sel)).toBe(2);
  });
});
