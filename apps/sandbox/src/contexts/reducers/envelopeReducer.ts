import type { TracksState, TracksAction } from '../TracksContext';

export function envelopeReducer(state: TracksState, action: TracksAction): TracksState {
  switch (action.type) {
    case 'UPDATE_CLIP_ENVELOPE_POINTS': {
      const { trackIndex, clipId, envelopePoints } = action.payload;
      const newTracks = [...state.tracks];
      newTracks[trackIndex] = {
        ...newTracks[trackIndex],
        clips: newTracks[trackIndex].clips.map(clip =>
          clip.id === clipId
            ? { ...clip, envelopePoints }
            : clip
        ),
      };
      return { ...state, tracks: newTracks };
    }

    case 'SET_ENVELOPE_MODE':
      return {
        ...state,
        envelopeMode: action.payload,
        envelopeAltMode: action.payload ? false : state.envelopeAltMode
      };

    case 'SET_ENVELOPE_ALT_MODE':
      return {
        ...state,
        envelopeAltMode: action.payload,
        envelopeMode: action.payload ? false : state.envelopeMode
      };

    default:
      return state;
  }
}
