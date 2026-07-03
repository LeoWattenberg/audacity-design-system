import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleSplitAtPlayhead } from '../splitHandlers';
import { initialState } from '../../../contexts/TracksContext';

const makeState = (o = {}) => ({ ...initialState, ...o });
const keyEvent = (over = {}) =>
  ({ key: 'i', metaKey: true, ctrlKey: false, shiftKey: false, preventDefault: () => {}, target: document.body, ...over } as unknown as KeyboardEvent);

afterEach(() => { document.body.innerHTML = ''; });

describe('handleSplitAtPlayhead', () => {
  it('splits the focused clip at the playhead (dispatches APPLY_CLIP_PLACEMENT)', () => {
    // A track with one clip spanning the playhead.
    const state = makeState({
      playheadPosition: 2,
      focusedTrackIndex: 0,
      tracks: [{ id: 1, name: 't', clips: [
        { id: 10, name: 'c', start: 0, duration: 5, envelopePoints: [] },
      ] }],
    });

    // The handler reads document.activeElement, then calls .closest('[data-clip-id]')
    // on it to find the clip wrapper element. From that wrapper element it reads
    // BOTH data-clip-id and data-track-index. Both attributes must be on the same
    // element that .closest('[data-clip-id]') resolves to.
    const el = document.createElement('div');
    el.setAttribute('data-clip-id', '10');
    el.setAttribute('data-track-index', '0');
    el.setAttribute('tabindex', '-1');
    document.body.appendChild(el);
    el.focus();

    const dispatch = vi.fn();
    handleSplitAtPlayhead(keyEvent(), { state, dispatch });

    const types = dispatch.mock.calls.map(c => c[0].type);
    expect(types).toContain('APPLY_CLIP_PLACEMENT');
  });
});
