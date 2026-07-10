import { describe, it, expect } from 'vitest';
import { findMissingEffects } from '../findMissingEffects';
import type { Track, Effect } from '../../contexts/TracksContext';

function makeTrack(id: number, effects: Effect[]): Track {
  return { id, name: `Track ${id}`, clips: [], effects };
}

describe('findMissingEffects', () => {
  it('reports a track effect whose id is not built-in and not installed', () => {
    const tracks = [makeTrack(1, [{ id: 'acme-verb', name: 'Acme Verb', enabled: true }])];
    const result = findMissingEffects({ tracks, masterEffects: [], installedIds: new Set() });
    expect(result).toEqual(['Acme Verb']);
  });

  it('dedups the same missing effect referenced on multiple tracks', () => {
    const tracks = [
      makeTrack(1, [{ id: 'acme-verb', name: 'Acme Verb', enabled: true }]),
      makeTrack(2, [{ id: 'acme-verb', name: 'Acme Verb', enabled: true }]),
    ];
    const result = findMissingEffects({ tracks, masterEffects: [], installedIds: new Set() });
    expect(result).toEqual(['Acme Verb']);
  });

  it('does not report an effect whose id is installed', () => {
    const tracks = [makeTrack(1, [{ id: 'acme-verb', name: 'Acme Verb', enabled: true }])];
    const result = findMissingEffects({
      tracks,
      masterEffects: [],
      installedIds: new Set(['acme-verb']),
    });
    expect(result).toEqual([]);
  });

  it('does not report a built-in effect id', () => {
    const tracks = [makeTrack(1, [{ id: 'compressor', name: 'Compressor', enabled: true }])];
    const result = findMissingEffects({ tracks, masterEffects: [], installedIds: new Set() });
    expect(result).toEqual([]);
  });

  it('includes missing effects found in masterEffects', () => {
    const masterEffects: Effect[] = [{ id: 'acme-verb', name: 'Acme Verb', enabled: true }];
    const result = findMissingEffects({ tracks: [], masterEffects, installedIds: new Set() });
    expect(result).toEqual(['Acme Verb']);
  });

  it('returns an empty array when there are no missing effects', () => {
    const tracks = [makeTrack(1, [{ id: 'compressor', name: 'Compressor', enabled: true }])];
    const result = findMissingEffects({
      tracks,
      masterEffects: [{ id: 'reverb', name: 'Reverb', enabled: true }],
      installedIds: new Set(),
    });
    expect(result).toEqual([]);
  });

  it('handles tracks with undefined effects', () => {
    const tracks: Track[] = [{ id: 1, name: 'Track 1', clips: [] }];
    const result = findMissingEffects({ tracks, masterEffects: [], installedIds: new Set() });
    expect(result).toEqual([]);
  });

  it('sorts the returned names', () => {
    const tracks = [
      makeTrack(1, [
        { id: 'zebra-fx', name: 'Zebra FX', enabled: true },
        { id: 'aardvark-fx', name: 'Aardvark FX', enabled: true },
      ]),
    ];
    const result = findMissingEffects({ tracks, masterEffects: [], installedIds: new Set() });
    expect(result).toEqual(['Aardvark FX', 'Zebra FX']);
  });
});
