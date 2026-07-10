import { getAllEffects } from '@audacity-ui/core';
import type { Track, Effect } from '../contexts/TracksContext';

export interface FindMissingEffectsArgs {
  tracks: Track[];
  masterEffects: Effect[];
  installedIds: Set<string>;
}

/**
 * Scans track effect chains and master effects for effect ids that are
 * neither built-in (`getAllEffects()`) nor currently installed
 * (`installedIds`, e.g. purchased/installed MuseHub effects). Returns the
 * distinct, sorted set of missing effect *names* — used to drive the
 * "Missing plugins" modal.
 */
export function findMissingEffects({
  tracks,
  masterEffects,
  installedIds,
}: FindMissingEffectsArgs): string[] {
  const builtInIds = new Set(getAllEffects().map((e) => e.id));
  const missing = new Set<string>();
  const scan = (effects: Array<{ id: string; name: string }> | undefined) => {
    for (const e of effects ?? []) {
      if (!builtInIds.has(e.id) && !installedIds.has(e.id)) missing.add(e.name);
    }
  };
  for (const t of tracks) scan(t.effects);
  scan(masterEffects);
  return Array.from(missing).sort();
}
