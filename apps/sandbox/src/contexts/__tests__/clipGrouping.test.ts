import { describe, it, expect } from 'vitest';
import { expandSelectionToGroups, type Track } from '../TracksContext';

const track = (clips: Array<Partial<{ id: number; selected: boolean; groupId: string }>>): Track => ({
  id: 1,
  name: 't',
  clips: clips.map((c, i) => ({
    id: c.id ?? i + 1,
    name: '',
    start: 0,
    duration: 1,
    envelopePoints: [],
    selected: c.selected,
    groupId: c.groupId,
  } as any)),
} as Track);

describe('expandSelectionToGroups', () => {
  it('returns input unchanged when no clip is selected', () => {
    const tracks: Track[] = [
      track([{ id: 1, groupId: 'g1' }, { id: 2, groupId: 'g1' }]),
    ];
    const result = expandSelectionToGroups(tracks);
    expect(result).toEqual(tracks);
  });

  it('returns input unchanged when selected clips have no groupId', () => {
    const tracks: Track[] = [
      track([{ id: 1, selected: true }, { id: 2 }]),
    ];
    const result = expandSelectionToGroups(tracks);
    expect(result[0].clips[0].selected).toBe(true);
    expect(result[0].clips[1].selected).toBeFalsy();
  });

  it('expands selection to all clips in the same group on the same track', () => {
    const tracks: Track[] = [
      track([
        { id: 1, selected: true, groupId: 'g1' },
        { id: 2, groupId: 'g1' },
        { id: 3, groupId: 'g2' },
      ]),
    ];
    const result = expandSelectionToGroups(tracks);
    expect(result[0].clips.find(c => c.id === 1)?.selected).toBe(true);
    expect(result[0].clips.find(c => c.id === 2)?.selected).toBe(true);
    expect(result[0].clips.find(c => c.id === 3)?.selected).toBeFalsy();
  });

  it('expands selection across tracks', () => {
    const tracks: Track[] = [
      track([{ id: 1, selected: true, groupId: 'g1' }]),
      track([{ id: 2, groupId: 'g1' }, { id: 3 }]),
    ];
    const result = expandSelectionToGroups(tracks);
    expect(result[1].clips.find(c => c.id === 2)?.selected).toBe(true);
    expect(result[1].clips.find(c => c.id === 3)?.selected).toBeFalsy();
  });

  it('is idempotent (running on already-expanded selection changes nothing)', () => {
    const tracks: Track[] = [
      track([
        { id: 1, selected: true, groupId: 'g1' },
        { id: 2, selected: true, groupId: 'g1' },
      ]),
    ];
    const once = expandSelectionToGroups(tracks);
    const twice = expandSelectionToGroups(once);
    expect(twice).toEqual(once);
  });
});
