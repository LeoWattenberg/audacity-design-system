import { useState, useEffect } from 'react';
import { RecordingManager } from '../utils/RecordingManager';

export interface UseAudioDeviceMenuReturn {
  audioSetupMenuAnchor: { x: number; y: number } | null;
  setAudioSetupMenuAnchor: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  selectedRecordingDevice: string;
  setSelectedRecordingDevice: React.Dispatch<React.SetStateAction<string>>;
  selectedPlaybackDevice: string;
  setSelectedPlaybackDevice: React.Dispatch<React.SetStateAction<string>>;
  availableAudioInputs: MediaDeviceInfo[];
  availableAudioOutputs: MediaDeviceInfo[];
}

/**
 * Hook for the "Audio setup" menu: tracks the menu's anchor position,
 * the selected recording/playback devices, and loads the available
 * audio input/output devices whenever the menu is opened.
 */
export function useAudioDeviceMenu(): UseAudioDeviceMenuReturn {
  const [audioSetupMenuAnchor, setAudioSetupMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [selectedRecordingDevice, setSelectedRecordingDevice] = useState('MacBook Pro Microphone');
  const [selectedPlaybackDevice, setSelectedPlaybackDevice] = useState('Built-in Speakers');
  const [availableAudioInputs, setAvailableAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [availableAudioOutputs, setAvailableAudioOutputs] = useState<MediaDeviceInfo[]>([]);

  // Load available audio devices when audio setup menu opens
  useEffect(() => {
    if (audioSetupMenuAnchor) {
      // Load input devices
      RecordingManager.getAudioInputDevices().then(devices => {
        setAvailableAudioInputs(devices);
        if (devices.length > 0 && !selectedRecordingDevice) {
          setSelectedRecordingDevice(devices[0].label || 'Default');
        }
      });

      // Load output devices
      RecordingManager.getAudioOutputDevices().then(devices => {
        setAvailableAudioOutputs(devices);
        if (devices.length > 0 && !selectedPlaybackDevice) {
          setSelectedPlaybackDevice(devices[0].label || 'Default');
        }
      });
    }
  }, [audioSetupMenuAnchor]);

  return {
    audioSetupMenuAnchor,
    setAudioSetupMenuAnchor,
    selectedRecordingDevice,
    setSelectedRecordingDevice,
    selectedPlaybackDevice,
    setSelectedPlaybackDevice,
    availableAudioInputs,
    availableAudioOutputs,
  };
}
