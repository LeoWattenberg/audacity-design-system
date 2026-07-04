// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import type React from 'react';
import { useSplitTool } from '../useSplitTool';
import type { Track } from '../../contexts/TracksContext';

afterEach(cleanup);

// TOP_GAP=2, CLIP_HEADER_HEIGHT=20, DEFAULT_TRACK_HEIGHT=114.
// Track 0 y range: [2, 116). Body starts at 2+20=22.
// clientX=250, leftPadding=0, pixelsPerSecond=100 → x=250, time=2.5s.
// clientY=60 → y=60. Track 0: y ∈ [2,116), body y>=22 ✓.
// Clip: start=0, duration=5. time=2.5 > 0.0001 && 2.5 < 4.9999 ✓ → hit.

const tracks = [
  {
    id: 1,
    name: 'a',
    height: 114,
    clips: [{ id: 10, name: 'c', start: 0, duration: 5, envelopePoints: [] }],
  },
] as unknown as Track[];

function makeContainer() {
  const el = document.createElement('div');
  // getBoundingClientRect drives client→canvas coord conversion; stub a known rect.
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 1000, bottom: 500, width: 1000, height: 500, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
  document.body.appendChild(el);
  return el;
}

describe('useSplitTool', () => {
  it('split-mode mousedown over a clip dispatches a split placement', () => {
    const dispatch = vi.fn();
    const handleClipMouseDown = vi.fn();
    const el = makeContainer();

    const { result } = renderHook(() =>
      useSplitTool({
        tracks,
        pixelsPerSecond: 100,
        leftPadding: 0,
        splitMode: true,
        dispatch,
        handleClipMouseDown,
      })
    );

    // clientX=250 → time 2.5s at 100px/s; clientY=60 inside track-0 body (past CLIP_HEADER_HEIGHT=20).
    // currentTarget must be the element whose getBoundingClientRect we stubbed.
    const e = {
      button: 0,
      clientX: 250,
      clientY: 60,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      currentTarget: el,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handlers.onMouseDownCapture(e);
    });

    const types = dispatch.mock.calls.map((c) => c[0].type);
    expect(types).toContain('APPLY_CLIP_PLACEMENT');
    const placement = dispatch.mock.calls.find((c) => c[0].type === 'APPLY_CLIP_PLACEMENT')![0];
    expect(placement.payload.mutations.some((m: any) => m.type === 'split' && m.clipId === 10)).toBe(true);
  });
});
