import { useEffect } from 'react';
import { saveProject, getProject } from '../utils/projectDatabase';
import type { Track, Effect } from '../contexts/TracksContext';

export interface UseProjectAutoSaveDeps {
  currentProjectId: string | null;
  tracks: Track[];
  masterEffects: Effect[];
  playheadPosition: number;
}

export function useProjectAutoSave(deps: UseProjectAutoSaveDeps): void {
  const { currentProjectId, tracks, masterEffects, playheadPosition } = deps;

  // Debounced auto-save: whenever the project state changes (tracks, effects,
  // playhead, etc.), persist it back to IndexedDB so navigating Home → Project
  // and re-opening the project picks up the latest edits.
  useEffect(() => {
    if (!currentProjectId) return;
    const handle = setTimeout(async () => {
      try {
        const existing = await getProject(currentProjectId);
        if (!existing) return;
        await saveProject({
          ...existing,
          data: {
            ...(existing.data ?? {}),
            tracks: tracks,
            masterEffects: masterEffects,
            playheadPosition: playheadPosition,
            audioBuffers: existing.data?.audioBuffers,
          },
        });
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [currentProjectId, tracks, masterEffects, playheadPosition]);
}
