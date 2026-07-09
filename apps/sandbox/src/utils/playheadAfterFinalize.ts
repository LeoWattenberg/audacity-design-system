// Spec: docs/superpowers/specs/2026-07-09-playhead-selection-overlap-design.md
// Finalizing a selection drag must not move a playhead the user parked
// inside the drawn range. Returns the new playhead position, or null
// when the playhead should stay where it is.
export function playheadAfterSelectionFinalize(
  playheadPosition: number,
  sel: { startTime: number; endTime: number },
): number | null {
  if (playheadPosition >= sel.startTime && playheadPosition <= sel.endTime) {
    return null;
  }
  return sel.startTime;
}
