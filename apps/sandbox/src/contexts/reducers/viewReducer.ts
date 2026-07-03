import type { TracksState, TracksAction } from '../TracksContext';

export function viewReducer(state: TracksState, action: TracksAction): TracksState {
  switch (action.type) {
    case 'SET_SPLIT_MODE':
      return { ...state, splitMode: action.payload };

    case 'SET_SPECTROGRAM_MODE': {
      const isEnabling = action.payload;

      if (isEnabling) {
        // Save current view modes before applying overlay
        const savedViewModes = state.tracks.map(track => track.viewMode);

        // Apply spectrogram overlay to all tracks
        const newTracks = state.tracks.map(track => ({
          ...track,
          viewMode: 'spectrogram' as const,
        }));

        return {
          ...state,
          spectrogramMode: true,
          viewModesBeforeOverlay: savedViewModes,
          tracks: newTracks,
        };
      } else {
        // Restore previous view modes
        const newTracks = state.tracks.map((track, index) => ({
          ...track,
          viewMode: state.viewModesBeforeOverlay?.[index],
        }));

        return {
          ...state,
          spectrogramMode: false,
          viewModesBeforeOverlay: null,
          tracks: newTracks,
        };
      }
    }

    case 'SET_TIME_SELECTION':
      return { ...state, timeSelection: action.payload };

    case 'SET_PLAYHEAD_POSITION':
      return { ...state, playheadPosition: action.payload };

    case 'SET_CUT_MODE':
      return { ...state, cutMode: action.payload };

    case 'SET_CANVAS_SNAP':
      return { ...state, canvasSnap: action.payload };

    default:
      return state;
  }
}
