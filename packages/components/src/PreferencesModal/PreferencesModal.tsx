import React, { useState, useRef, useEffect } from 'react';
import { Dialog } from '../Dialog';
import { Button } from '../Button';
import { Dropdown, DropdownOption } from '../Dropdown';
import { LabeledCheckbox } from '../LabeledCheckbox';
import { LabeledInput } from '../LabeledInput';
import { LabeledRadio } from '../LabeledRadio';
import { NumberStepper } from '../NumberStepper';
import { Separator } from '../Separator';
import { Icon } from '../Icon';
import { DialogSideNav } from '../DialogSideNav/DialogSideNav';
import { useAccessibilityProfile } from '../contexts/AccessibilityProfileContext';
import { usePreferences, type PreferencesState } from '../contexts/PreferencesContext';
import type { PreferencesPage, PreferencesModalProps } from './types';
import { menuItems } from './menuItems';
import { TabGroupField } from './TabGroupField';
import { EditingPage } from './pages/EditingPage';
import { ShortcutsPage } from './pages/ShortcutsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import './PreferencesModal.css';

export type { PreferencesPage, PreferencesModalProps };

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
  currentPage = 'general',
  onPageChange,
  os = 'macos',
  className = '',
  zoomToggleLevel1 = 'zoom-default',
  onZoomToggleLevel1Change,
  zoomToggleLevel2 = 'seconds',
  onZoomToggleLevel2Change,
  onResetWarnings,
  onOpenPluginManager,
  accountsContent,
}) => {
  const [selectedPage, setSelectedPage] = useState<PreferencesPage>(currentPage);
  const contentRef = useRef<HTMLDivElement>(null);
  const [focusedRegion, setFocusedRegion] = useState<'sidebar' | 'content'>('sidebar');
  const { activeProfile } = useAccessibilityProfile();

  // Footer tab group state
  const footerRefs = useRef<(HTMLElement | null)[]>([]);
  const footerActiveIndexRef = useRef<number>(0);
  const [footerActiveIndex, setFooterActiveIndex] = useState<number>(0);

  // Sync footer state with ref
  useEffect(() => {
    footerActiveIndexRef.current = footerActiveIndex;
  }, [footerActiveIndex]);

  // Reset footer active index when modal opens or page changes
  useEffect(() => {
    if (isOpen) {
      setFooterActiveIndex(0);
      footerActiveIndexRef.current = 0;
    }
  }, [isOpen, selectedPage]);

  const handlePageChange = (page: PreferencesPage) => {
    setSelectedPage(page);
    onPageChange?.(page);
  };

  // Handle F6 keyboard navigation between regions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F6 to cycle between regions
      if (e.key === 'F6') {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+F6: Go to sidebar
          const sidebar = document.querySelector('.dialog-sidenav');
          if (sidebar) {
            const firstButton = sidebar.querySelector<HTMLButtonElement>('button');
            firstButton?.focus();
            setFocusedRegion('sidebar');
          }
        } else {
          // F6: Go to content
          if (contentRef.current) {
            const firstFocusable = contentRef.current.querySelector<HTMLElement>(
              'button:not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([tabindex="-1"]), select:not([tabindex="-1"]), textarea:not([tabindex="-1"])'
            );
            if (firstFocusable) {
              firstFocusable.focus();
              setFocusedRegion('content');
            }
          }
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Preferences"
      os={os}
      className={`preferences-modal ${className}`}
      width="880px"
      maximizable={true}
      closeOnClickOutside={false}
    >
      <div className="preferences-modal__content">
        {/* Sidebar Menu */}
        <DialogSideNav
          items={menuItems}
          selectedId={selectedPage}
          onSelectId={handlePageChange}
          ariaLabel="Preferences navigation"
          className="preferences-modal__sidebar"
        />

        {/* Content Area */}
        <main
          ref={contentRef}
          className="preferences-modal__body"
          role="tabpanel"
          id="preferences-content"
          aria-label={`${selectedPage} preferences`}
        >
          <div className="preferences-modal__scroll-container" tabIndex={-1}>
            {selectedPage === 'general' && <GeneralPage onResetWarnings={onResetWarnings} />}
            {selectedPage === 'accounts' && (
              <div className="preferences-page">{accountsContent}</div>
            )}
            {selectedPage === 'appearance' && <AppearancePage />}
            {selectedPage === 'audio-settings' && <AudioSettingsPage />}
            {selectedPage === 'playback-recording' && <PlaybackRecordingPage />}
            {selectedPage === 'spectral-display' && <SpectralDisplayPage />}
            {selectedPage === 'editing' && (
              <EditingPage
                zoomToggleLevel1={zoomToggleLevel1}
                onZoomToggleLevel1Change={onZoomToggleLevel1Change}
                zoomToggleLevel2={zoomToggleLevel2}
                onZoomToggleLevel2Change={onZoomToggleLevel2Change}
              />
            )}
            {selectedPage === 'shortcuts' && <ShortcutsPage />}
            {selectedPage === 'plugins' && <PluginsPage onOpenPluginManager={onOpenPluginManager} />}
            {selectedPage === 'cloud' && <CloudPage />}
          </div>
        </main>
      </div>

      {/* Footer */}
      <div className="preferences-modal__footer">
        <TabGroupField
          groupId="dialog-footer"
          itemIndex={0}
          totalItems={3}
          itemRefs={footerRefs}
          activeIndexRef={footerActiveIndexRef}
          activeIndex={footerActiveIndex}
          onActiveIndexChange={setFooterActiveIndex}
          resetKey={selectedPage}
        >
          <Button variant="secondary" onClick={() => {/* Reset */}}>
            Reset preferences
          </Button>
        </TabGroupField>
        <div className="preferences-modal__footer-actions">
          <TabGroupField
            groupId="dialog-footer"
            itemIndex={1}
            totalItems={3}
            itemRefs={footerRefs}
            activeIndexRef={footerActiveIndexRef}
            activeIndex={footerActiveIndex}
            onActiveIndexChange={setFooterActiveIndex}
            resetKey={selectedPage}
          >
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </TabGroupField>
          <TabGroupField
            groupId="dialog-footer"
            itemIndex={2}
            totalItems={3}
            itemRefs={footerRefs}
            activeIndexRef={footerActiveIndexRef}
            activeIndex={footerActiveIndex}
            onActiveIndexChange={setFooterActiveIndex}
            resetKey={selectedPage}
          >
            <Button variant="primary" onClick={onClose}>
              OK
            </Button>
          </TabGroupField>
        </div>
      </div>
    </Dialog>
  );
};

// General Page Content
function GeneralPage({ onResetWarnings }: { onResetWarnings?: () => void }) {
  const { preferences, updatePreference } = usePreferences();

  const languageOptions: DropdownOption[] = [
    { value: 'en', label: 'System (English)' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
  ];

  return (
    <div className="preferences-page">
      <div className="preferences-page__section">
        <div className="preferences-page__field preferences-page__field--small">
          <label className="preferences-page__label">Language</label>
          <Dropdown
            options={languageOptions}
            value="en"
          />
        </div>

        <div className="preferences-page__field preferences-page__field--small">
          <label className="preferences-page__label">Number format</label>
          <Dropdown
            options={languageOptions}
            value="en"
          />
          <span className="preferences-page__hint">Example: 1,000,000.99</span>
        </div>
      </div>

      <Separator />

      <div className="preferences-page__section">
        <div className="preferences-page__field preferences-page__field--large">
          <label className="preferences-page__label">Temporary files location</label>
          <div className="preferences-page__input-group">
            <LabeledInput
              label=""
              value="C:\Users\mc\AppData\Local\audacity"
            />
            <Button variant="secondary">
              Browse
            </Button>
          </div>
          <span className="preferences-page__hint">
            Folder in which unsaved projects and other data are kept
          </span>
        </div>

        <div className="preferences-page__field preferences-page__field--large">
          <label className="preferences-page__label">Free space</label>
          <div className="preferences-page__value">547.2 GB</div>
        </div>
      </div>

      <Separator />

      <div className="preferences-page__section">
        <div className="preferences-page__checkboxes">
          <LabeledCheckbox
            label="Show what's new on launch"
            checked={preferences.showWelcomeDialog}
            onChange={(checked) => updatePreference('showWelcomeDialog', checked)}
          />
          <LabeledCheckbox
            label="Check to see if a new version of Audacity is available"
            checked={preferences.checkForUpdates}
            onChange={(checked) => updatePreference('checkForUpdates', checked)}
          />
        </div>

        <div className="preferences-page__info-box">
          Update checking requires network access. In order to protect your privacy,
          Audacity does not store any personal information. See our{' '}
          <a href="#" className="preferences-page__link">Privacy Policy</a> for more info.
        </div>
      </div>

      <Separator />

      <div className="preferences-page__section">
        <div className="preferences-page__field preferences-page__field--large">
          <label className="preferences-page__label">Warnings and dialogs</label>
          <div className="preferences-page__button-group">
            <Button
              variant="secondary"
              onClick={onResetWarnings}
            >
              Reset warnings
            </Button>
            <span className="preferences-page__hint">
              Reset all "Don't show again" checkboxes for warning dialogs
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Appearance Page Content
function AppearancePage() {
  const { preferences, updatePreference } = usePreferences();

  return (
    <div className="preferences-page">
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Theme</h3>

        <div className="preferences-page__radio-group">
          <LabeledRadio
            label="Light"
            checked={preferences.theme === 'light'}
            onChange={() => updatePreference('theme', 'light')}
            name="theme"
            value="light"
          />

          <LabeledRadio
            label="Dark"
            checked={preferences.theme === 'dark'}
            onChange={() => updatePreference('theme', 'dark')}
            name="theme"
            value="dark"
          />
        </div>
      </div>

      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Clip style</h3>

        <div className="preferences-page__radio-group">
          <LabeledRadio
            label="Colourful"
            checked={preferences.clipStyle === 'colourful'}
            onChange={() => updatePreference('clipStyle', 'colourful')}
            name="clipStyle"
            value="colourful"
          />

          <LabeledRadio
            label="Classic"
            checked={preferences.clipStyle === 'classic'}
            onChange={() => updatePreference('clipStyle', 'classic')}
            name="clipStyle"
            value="classic"
          />
        </div>
      </div>
    </div>
  );
}

// Audio Settings Page Content
function AudioSettingsPage() {
  const { preferences, updatePreference } = usePreferences();

  const hostOptions: DropdownOption[] = [
    { value: 'mme', label: 'MME' },
    { value: 'wasapi', label: 'Windows WASAPI' },
    { value: 'directsound', label: 'Windows DirectSound' },
    { value: 'core-audio', label: 'Core Audio' },
  ];

  const deviceOptions: DropdownOption[] = [
    { value: 'scarlett', label: 'Scarlett Solo USB' },
    { value: 'realtek', label: 'Realtek High Definition Audio' },
    { value: 'default', label: 'Default Device' },
  ];

  const channelOptions: DropdownOption[] = [
    { value: 'mono', label: '1 (mono)' },
    { value: 'stereo', label: '2 (stereo)' },
  ];

  const sampleRateOptions: DropdownOption[] = [
    { value: '44100', label: '44100 Hz' },
    { value: '48000', label: '48000 Hz' },
    { value: '96000', label: '96000 Hz' },
  ];

  const sampleFormatOptions: DropdownOption[] = [
    { value: '16bit', label: '16-bit PCM' },
    { value: '24bit', label: '24-bit PCM' },
    { value: '32bit', label: '32-bit float' },
  ];

  // Separate tab groups for each section
  const inputsOutputsRefs = useRef<(HTMLElement | null)[]>([]);
  const inputsOutputsActiveIndexRef = useRef<number>(0);
  const [inputsOutputsActiveIndex, setInputsOutputsActiveIndex] = useState<number>(0);

  const bufferRefs = useRef<(HTMLElement | null)[]>([]);
  const bufferActiveIndexRef = useRef<number>(0);
  const [bufferActiveIndex, setBufferActiveIndex] = useState<number>(0);

  const sampleRateRefs = useRef<(HTMLElement | null)[]>([]);
  const sampleRateActiveIndexRef = useRef<number>(0);
  const [sampleRateActiveIndex, setSampleRateActiveIndex] = useState<number>(0);

  // Reset all active indices to 0 on mount
  useEffect(() => {
    setInputsOutputsActiveIndex(0);
    inputsOutputsActiveIndexRef.current = 0;
    setBufferActiveIndex(0);
    bufferActiveIndexRef.current = 0;
    setSampleRateActiveIndex(0);
    sampleRateActiveIndexRef.current = 0;
  }, []);

  // Sync state with refs
  useEffect(() => {
    inputsOutputsActiveIndexRef.current = inputsOutputsActiveIndex;
  }, [inputsOutputsActiveIndex]);

  useEffect(() => {
    bufferActiveIndexRef.current = bufferActiveIndex;
  }, [bufferActiveIndex]);

  useEffect(() => {
    sampleRateActiveIndexRef.current = sampleRateActiveIndex;
  }, [sampleRateActiveIndex]);

  return (
    <div className="preferences-page">
      {/* Section 1: Inputs and outputs */}
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Inputs and outputs</h3>

        <TabGroupField
          groupId="inputs-outputs"
          itemIndex={0}
          totalItems={4}
          itemRefs={inputsOutputsRefs}
          activeIndexRef={inputsOutputsActiveIndexRef}
          activeIndex={inputsOutputsActiveIndex}
          onActiveIndexChange={setInputsOutputsActiveIndex}
          resetKey="audio-settings"
        >
          <label className="preferences-page__label">Host</label>
          <Dropdown
            options={hostOptions}
            value={preferences.audioHost}
            onChange={(value) => updatePreference('audioHost', value)}
          />
        </TabGroupField>

        <TabGroupField
          groupId="inputs-outputs"
          itemIndex={1}
          totalItems={4}
          itemRefs={inputsOutputsRefs}
          activeIndexRef={inputsOutputsActiveIndexRef}
          activeIndex={inputsOutputsActiveIndex}
          onActiveIndexChange={setInputsOutputsActiveIndex}
          resetKey="audio-settings"
        >
          <label className="preferences-page__label">Playback device</label>
          <Dropdown
            options={deviceOptions}
            value={preferences.playbackDevice}
            onChange={(value) => updatePreference('playbackDevice', value)}
          />
        </TabGroupField>

        <TabGroupField
          groupId="inputs-outputs"
          itemIndex={2}
          totalItems={4}
          itemRefs={inputsOutputsRefs}
          activeIndexRef={inputsOutputsActiveIndexRef}
          activeIndex={inputsOutputsActiveIndex}
          onActiveIndexChange={setInputsOutputsActiveIndex}
          resetKey="audio-settings"
        >
          <label className="preferences-page__label">Recording device</label>
          <Dropdown
            options={deviceOptions}
            value={preferences.recordingDevice}
            onChange={(value) => updatePreference('recordingDevice', value)}
          />
        </TabGroupField>

        <TabGroupField
          groupId="inputs-outputs"
          itemIndex={3}
          totalItems={4}
          itemRefs={inputsOutputsRefs}
          activeIndexRef={inputsOutputsActiveIndexRef}
          activeIndex={inputsOutputsActiveIndex}
          onActiveIndexChange={setInputsOutputsActiveIndex}
          resetKey="audio-settings"
        >
          <label className="preferences-page__label">Recording channels</label>
          <Dropdown
            options={channelOptions}
            value="stereo"
          />
        </TabGroupField>
      </div>

      <Separator />

      {/* Section 2: Buffer settings */}
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Buffer and latency</h3>

        <TabGroupField
          groupId="buffer-latency"
          itemIndex={0}
          totalItems={2}
          itemRefs={bufferRefs}
          activeIndexRef={bufferActiveIndexRef}
          activeIndex={bufferActiveIndex}
          onActiveIndexChange={setBufferActiveIndex}
          resetKey="audio-settings"
        >
          <label className="preferences-page__label">Buffer length</label>
          <LabeledInput
            label=""
            value="50 ms"
          />
        </TabGroupField>

        <TabGroupField
          groupId="buffer-latency"
          itemIndex={1}
          totalItems={2}
          itemRefs={bufferRefs}
          activeIndexRef={bufferActiveIndexRef}
          activeIndex={bufferActiveIndex}
          onActiveIndexChange={setBufferActiveIndex}
          resetKey="audio-settings"
        >
          <label className="preferences-page__label">Latency compensation</label>
          <LabeledInput
            label=""
            value="50 ms"
          />
        </TabGroupField>
      </div>

      <Separator />

      {/* Section 3: Sample rate */}
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Sample rate</h3>

        <TabGroupField
          groupId="sample-rate"
          itemIndex={0}
          totalItems={2}
          itemRefs={sampleRateRefs}
          activeIndexRef={sampleRateActiveIndexRef}
          activeIndex={sampleRateActiveIndex}
          onActiveIndexChange={setSampleRateActiveIndex}
          resetKey="audio-settings"
        >
          <label className="preferences-page__label">Default sample rate</label>
          <Dropdown
            options={sampleRateOptions}
            value="44100"
          />
        </TabGroupField>

        <TabGroupField
          groupId="sample-rate"
          itemIndex={1}
          totalItems={2}
          itemRefs={sampleRateRefs}
          activeIndexRef={sampleRateActiveIndexRef}
          activeIndex={sampleRateActiveIndex}
          onActiveIndexChange={setSampleRateActiveIndex}
          resetKey="audio-settings"
        >
          <label className="preferences-page__label">Default sample format</label>
          <Dropdown
            options={sampleFormatOptions}
            value="32bit"
          />
        </TabGroupField>
      </div>
    </div>
  );
}

// Playback/Recording Page Content
function PlaybackRecordingPage() {
  const { preferences, updatePreference } = usePreferences();

  const playbackQualityOptions: DropdownOption[] = [
    { value: 'best', label: 'Best quality' },
    { value: 'high', label: 'High quality' },
    { value: 'medium', label: 'Medium quality' },
  ];

  const ditheringOptions: DropdownOption[] = [
    { value: 'none', label: 'None' },
    { value: 'rectangle', label: 'Rectangle' },
    { value: 'triangle', label: 'Triangle' },
  ];

  // Tab group states
  const playbackPerformanceRefs = useRef<(HTMLElement | null)[]>([]);
  const playbackPerformanceActiveIndexRef = useRef<number>(0);
  const [playbackPerformanceActiveIndex, setPlaybackPerformanceActiveIndex] = useState<number>(0);

  const soloBehaviorRefs = useRef<(HTMLElement | null)[]>([]);
  const soloBehaviorActiveIndexRef = useRef<number>(0);
  const [soloBehaviorActiveIndex, setSoloBehaviorActiveIndex] = useState<number>(0);

  const cursorMovementRefs = useRef<(HTMLElement | null)[]>([]);
  const cursorMovementActiveIndexRef = useRef<number>(0);
  const [cursorMovementActiveIndex, setCursorMovementActiveIndex] = useState<number>(0);

  const recordingBehaviorRefs = useRef<(HTMLElement | null)[]>([]);
  const recordingBehaviorActiveIndexRef = useRef<number>(0);
  const [recordingBehaviorActiveIndex, setRecordingBehaviorActiveIndex] = useState<number>(0);

  const soloBehaviorTabRefs = useRef<(HTMLElement | null)[]>([]);
  const soloBehaviorTabActiveIndexRef = useRef<number>(0);
  const [soloBehaviorTabActiveIndex, setSoloBehaviorTabActiveIndex] = useState<number>(0);

  // Sync state with refs
  useEffect(() => {
    playbackPerformanceActiveIndexRef.current = playbackPerformanceActiveIndex;
  }, [playbackPerformanceActiveIndex]);

  useEffect(() => {
    soloBehaviorActiveIndexRef.current = soloBehaviorActiveIndex;
  }, [soloBehaviorActiveIndex]);

  useEffect(() => {
    cursorMovementActiveIndexRef.current = cursorMovementActiveIndex;
  }, [cursorMovementActiveIndex]);

  useEffect(() => {
    recordingBehaviorActiveIndexRef.current = recordingBehaviorActiveIndex;
  }, [recordingBehaviorActiveIndex]);

  useEffect(() => {
    soloBehaviorTabActiveIndexRef.current = soloBehaviorTabActiveIndex;
  }, [soloBehaviorTabActiveIndex]);

  return (
    <div className="preferences-page">
      {/* Section 1: Playback performance */}
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Playback performance</h3>

        <TabGroupField
          groupId="playback-performance"
          itemIndex={0}
          totalItems={2}
          itemRefs={playbackPerformanceRefs}
          activeIndexRef={playbackPerformanceActiveIndexRef}
          activeIndex={playbackPerformanceActiveIndex}
          onActiveIndexChange={setPlaybackPerformanceActiveIndex}
          resetKey="playback-recording"
        >
          <label className="preferences-page__label">Playback quality</label>
          <Dropdown
            options={playbackQualityOptions}
            value="best"
          />
        </TabGroupField>

        <TabGroupField
          groupId="playback-performance"
          itemIndex={1}
          totalItems={2}
          itemRefs={playbackPerformanceRefs}
          activeIndexRef={playbackPerformanceActiveIndexRef}
          activeIndex={playbackPerformanceActiveIndex}
          onActiveIndexChange={setPlaybackPerformanceActiveIndex}
          resetKey="playback-recording"
        >
          <label className="preferences-page__label">Dithering</label>
          <Dropdown
            options={ditheringOptions}
            value="none"
          />
        </TabGroupField>
      </div>

      <Separator />

      {/* Section 2: Solo button behavior */}
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Solo button behavior</h3>

        <div className="preferences-page__radio-group">
          <TabGroupField
            groupId="solo-behavior-tab"
            itemIndex={0}
            totalItems={2}
            itemRefs={soloBehaviorTabRefs}
            activeIndexRef={soloBehaviorTabActiveIndexRef}
            activeIndex={soloBehaviorTabActiveIndex}
            onActiveIndexChange={setSoloBehaviorTabActiveIndex}
            resetKey="playback-recording"
          >
            <LabeledRadio
              label="Solo can be activated for multiple tracks at the same time"
              checked={preferences.soloMode === 'multiple'}
              onChange={() => updatePreference('soloMode', 'multiple')}
              name="solo-mode"
              value="multiple"
            />
          </TabGroupField>
          <TabGroupField
            groupId="solo-behavior-tab"
            itemIndex={1}
            totalItems={2}
            itemRefs={soloBehaviorTabRefs}
            activeIndexRef={soloBehaviorTabActiveIndexRef}
            activeIndex={soloBehaviorTabActiveIndex}
            onActiveIndexChange={setSoloBehaviorTabActiveIndex}
            resetKey="playback-recording"
          >
            <LabeledRadio
              label="When solo is activated, it deactivates solo for all other tracks"
              checked={preferences.soloMode === 'single'}
              onChange={() => updatePreference('soloMode', 'single')}
              name="solo-mode"
              value="single"
            />
          </TabGroupField>
        </div>
      </div>

      <Separator />

      {/* Section 3: Move cursor along the timeline during playback */}
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Move cursor along the timeline during playback</h3>

        <TabGroupField
          groupId="cursor-movement"
          itemIndex={0}
          totalItems={2}
          itemRefs={cursorMovementRefs}
          activeIndexRef={cursorMovementActiveIndexRef}
          activeIndex={cursorMovementActiveIndex}
          onActiveIndexChange={setCursorMovementActiveIndex}
          resetKey="playback-recording"
        >
          <label className="preferences-page__label">Short skip</label>
          <NumberStepper
            value={preferences.shortSkip}
            onChange={(value) => updatePreference('shortSkip', value)}
          />
        </TabGroupField>

        <TabGroupField
          groupId="cursor-movement"
          itemIndex={1}
          totalItems={2}
          itemRefs={cursorMovementRefs}
          activeIndexRef={cursorMovementActiveIndexRef}
          activeIndex={cursorMovementActiveIndex}
          onActiveIndexChange={setCursorMovementActiveIndex}
          resetKey="playback-recording"
        >
          <label className="preferences-page__label">Long skip</label>
          <NumberStepper
            value={preferences.longSkip}
            onChange={(value) => updatePreference('longSkip', value)}
          />
        </TabGroupField>
      </div>

      <Separator />

      {/* Section 4: Recording behaviour */}
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Recording behaviour</h3>

        <TabGroupField
          groupId="recording-behavior"
          itemIndex={0}
          totalItems={3}
          itemRefs={recordingBehaviorRefs}
          activeIndexRef={recordingBehaviorActiveIndexRef}
          activeIndex={recordingBehaviorActiveIndex}
          onActiveIndexChange={setRecordingBehaviorActiveIndex}
          resetKey="playback-recording"
        >
          <label className="preferences-page__label">Lead in time</label>
          <NumberStepper
            value={preferences.rollInTime}
            onChange={(value) => updatePreference('rollInTime', value)}
          />
        </TabGroupField>

      </div>

      <Separator />

      {/* Section 5: Monitoring */}
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Monitoring</h3>

        <TabGroupField
          groupId="recording-behavior"
          itemIndex={1}
          totalItems={3}
          itemRefs={recordingBehaviorRefs}
          activeIndexRef={recordingBehaviorActiveIndexRef}
          activeIndex={recordingBehaviorActiveIndex}
          onActiveIndexChange={setRecordingBehaviorActiveIndex}
          resetKey="playback-recording"
        >
          <LabeledCheckbox
            label="Show mic metering"
            checked={preferences.showMicMetering}
            onChange={(checked) => updatePreference('showMicMetering', checked)}
          />
        </TabGroupField>

        <TabGroupField
          groupId="recording-behavior"
          itemIndex={2}
          totalItems={3}
          itemRefs={recordingBehaviorRefs}
          activeIndexRef={recordingBehaviorActiveIndexRef}
          activeIndex={recordingBehaviorActiveIndex}
          onActiveIndexChange={setRecordingBehaviorActiveIndex}
          resetKey="playback-recording"
        >
          <LabeledCheckbox
            label="Enable input monitoring"
            checked={preferences.enableInputMonitoring}
            onChange={(checked) => updatePreference('enableInputMonitoring', checked)}
          />
        </TabGroupField>
      </div>
    </div>
  );
}

// Spectral Display Page Content
function SpectralDisplayPage() {
  const { preferences, updatePreference } = usePreferences();

  const scaleOptions: DropdownOption[] = [
    { value: 'mel', label: 'Mel' },
    { value: 'linear', label: 'Linear' },
    { value: 'logarithmic', label: 'Logarithmic' },
  ];

  const schemeOptions: DropdownOption[] = [
    { value: 'inverse-grayscale', label: 'Inverse grayscale' },
    { value: 'grayscale', label: 'Grayscale' },
    { value: 'color', label: 'Color' },
  ];

  const algorithmOptions: DropdownOption[] = [
    { value: 'frequencies', label: 'Frequencies' },
    { value: 'reassignment', label: 'Reassignment' },
    { value: 'pitch-eac', label: 'Pitch (EAC)' },
  ];

  const windowSizeOptions: DropdownOption[] = [
    { value: '32768', label: '32768 - most narrowband' },
    { value: '16384', label: '16384' },
    { value: '8192', label: '8192' },
    { value: '4096', label: '4096' },
    { value: '2048', label: '2048' },
    { value: '1024', label: '1024' },
    { value: '512', label: '512' },
    { value: '256', label: '256 - most wideband' },
  ];

  const windowTypeOptions: DropdownOption[] = [
    { value: 'blackman-harris', label: 'Blackman-Harris' },
    { value: 'hann', label: 'Hann' },
    { value: 'hamming', label: 'Hamming' },
  ];

  const zeroPaddingOptions: DropdownOption[] = [
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '4', label: '4' },
    { value: '8', label: '8' },
  ];

  // Tab group states
  const coloursRefs = useRef<(HTMLElement | null)[]>([]);
  const coloursActiveIndexRef = useRef<number>(0);
  const [coloursActiveIndex, setColoursActiveIndex] = useState<number>(0);

  const algorithmRefs = useRef<(HTMLElement | null)[]>([]);
  const algorithmActiveIndexRef = useRef<number>(0);
  const [algorithmActiveIndex, setAlgorithmActiveIndex] = useState<number>(0);

  // Sync state with refs
  useEffect(() => {
    coloursActiveIndexRef.current = coloursActiveIndex;
  }, [coloursActiveIndex]);

  useEffect(() => {
    algorithmActiveIndexRef.current = algorithmActiveIndex;
  }, [algorithmActiveIndex]);

  return (
    <div className="preferences-page">
      {/* Section 1: Selection */}
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Selection</h3>
        <LabeledCheckbox
          label="Enable spectral selection"
          checked={true}
        />
      </div>

      <Separator />

      {/* Section 2: Scale */}
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Scale</h3>

        <div className="preferences-page__field preferences-page__field--small">
          <label className="preferences-page__label">Scale</label>
          <Dropdown
            options={scaleOptions}
            value="mel"
          />
        </div>
      </div>

      <Separator />

      {/* Section 3: Colours */}
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Colours</h3>

        <TabGroupField
          groupId="spectral-colours"
          itemIndex={0}
          totalItems={4}
          itemRefs={coloursRefs}
          activeIndexRef={coloursActiveIndexRef}
          activeIndex={coloursActiveIndex}
          onActiveIndexChange={setColoursActiveIndex}
          resetKey="spectral-display"
        >
          <label className="preferences-page__label">Gain</label>
          <NumberStepper
            value={preferences.spectralGain}
            onChange={(value) => updatePreference('spectralGain', value)}
          />
        </TabGroupField>

        <TabGroupField
          groupId="spectral-colours"
          itemIndex={1}
          totalItems={4}
          itemRefs={coloursRefs}
          activeIndexRef={coloursActiveIndexRef}
          activeIndex={coloursActiveIndex}
          onActiveIndexChange={setColoursActiveIndex}
          resetKey="spectral-display"
        >
          <label className="preferences-page__label">Range</label>
          <NumberStepper
            value="80 dB"
          />
        </TabGroupField>

        <TabGroupField
          groupId="spectral-colours"
          itemIndex={2}
          totalItems={4}
          itemRefs={coloursRefs}
          activeIndexRef={coloursActiveIndexRef}
          activeIndex={coloursActiveIndex}
          onActiveIndexChange={setColoursActiveIndex}
          resetKey="spectral-display"
        >
          <label className="preferences-page__label">High boost</label>
          <NumberStepper
            value="20 dB/dec"
          />
        </TabGroupField>

        <TabGroupField
          groupId="spectral-colours"
          itemIndex={3}
          totalItems={4}
          itemRefs={coloursRefs}
          activeIndexRef={coloursActiveIndexRef}
          activeIndex={coloursActiveIndex}
          onActiveIndexChange={setColoursActiveIndex}
          resetKey="spectral-display"
        >
          <label className="preferences-page__label">Scheme</label>
          <Dropdown
            options={schemeOptions}
            value={preferences.spectralScheme}
            onChange={(value) => updatePreference('spectralScheme', value)}
          />
        </TabGroupField>
      </div>

      <Separator />

      {/* Section 4: Algorithm */}
      <div className="preferences-page__section">
        <h3 className="preferences-page__section-title">Algorithm</h3>

        <TabGroupField
          groupId="spectral-algorithm"
          itemIndex={0}
          totalItems={4}
          itemRefs={algorithmRefs}
          activeIndexRef={algorithmActiveIndexRef}
          activeIndex={algorithmActiveIndex}
          onActiveIndexChange={setAlgorithmActiveIndex}
          resetKey="spectral-display"
        >
          <label className="preferences-page__label">Algorithm</label>
          <Dropdown
            options={algorithmOptions}
            value="frequencies"
          />
        </TabGroupField>

        <TabGroupField
          groupId="spectral-algorithm"
          itemIndex={1}
          totalItems={4}
          itemRefs={algorithmRefs}
          activeIndexRef={algorithmActiveIndexRef}
          activeIndex={algorithmActiveIndex}
          onActiveIndexChange={setAlgorithmActiveIndex}
          resetKey="spectral-display"
        >
          <label className="preferences-page__label">Window size</label>
          <Dropdown
            options={windowSizeOptions}
            value="32768"
          />
        </TabGroupField>

        <TabGroupField
          groupId="spectral-algorithm"
          itemIndex={2}
          totalItems={4}
          itemRefs={algorithmRefs}
          activeIndexRef={algorithmActiveIndexRef}
          activeIndex={algorithmActiveIndex}
          onActiveIndexChange={setAlgorithmActiveIndex}
          resetKey="spectral-display"
        >
          <label className="preferences-page__label">Scheme</label>
          <Dropdown
            options={windowTypeOptions}
            value="blackman-harris"
          />
        </TabGroupField>

        <TabGroupField
          groupId="spectral-algorithm"
          itemIndex={3}
          totalItems={4}
          itemRefs={algorithmRefs}
          activeIndexRef={algorithmActiveIndexRef}
          activeIndex={algorithmActiveIndex}
          onActiveIndexChange={setAlgorithmActiveIndex}
          resetKey="spectral-display"
        >
          <label className="preferences-page__label">Zero padding factor</label>
          <Dropdown
            options={zeroPaddingOptions}
            value="2"
          />
        </TabGroupField>
      </div>
    </div>
  );
}

// Placeholder for other pages
function PluginsPage({ onOpenPluginManager }: { onOpenPluginManager?: () => void }) {
  const { preferences, updatePreference } = usePreferences();

  const pluginPaths: { key: keyof PreferencesState; label: string }[] = [
    { key: 'vst3PluginLocation', label: 'VST3 plugin location' },
    { key: 'vstPluginLocation', label: 'VST plugin location' },
    { key: 'lv2PluginLocation', label: 'LV2 plugin location' },
    { key: 'ladspaPluginLocation', label: 'LADSPA plugin location' },
    { key: 'audioUnitsPluginLocation', label: 'Audio Units plugin location' },
  ];

  return (
    <div className="preferences-page">
      <div className="preferences-page__section">
        <div>
          <Button variant="secondary" onClick={onOpenPluginManager}>
            Open plugin manager
          </Button>
        </div>

        <LabeledCheckbox
          label="Group effects in menus"
          checked={preferences.groupEffectsInMenus}
          onChange={(checked) => updatePreference('groupEffectsInMenus', checked)}
        />
      </div>

      <Separator />

      <div className="preferences-page__section">
        <div className="preferences-page__section-title">Custom plugin search paths</div>

        {pluginPaths.map(({ key, label }) => (
          <div key={key} className="preferences-page__field preferences-page__field--large">
            <label className="preferences-page__label">{label}</label>
            <div className="preferences-page__input-group">
              <LabeledInput
                label=""
                value={preferences[key] as string}
                onChange={(val) => updatePreference(key, val as any)} // justified: updatePreference is dynamically keyed — pending components sweep
              />
              <Button variant="secondary">
                Browse
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CloudPage() {
  const { preferences, updatePreference } = usePreferences();

  const mixdownIntervalOptions: DropdownOption[] = [
    { value: '3', label: '3 saves' },
    { value: '5', label: '5 saves' },
    { value: '10', label: '10 saves' },
    { value: '20', label: '20 saves' },
  ];

  return (
    <div className="preferences-page">
      <div className="preferences-page__section">
        <label className="preferences-page__label">Generate mixdown for audio.com playback</label>

        <div className="preferences-page__radio-group">
          <LabeledRadio
            label="Never"
            checked={preferences.cloudMixdownMode === 'never'}
            onChange={() => updatePreference('cloudMixdownMode', 'never')}
            name="cloudMixdownMode"
            value="never"
          />

          <LabeledRadio
            label="Always"
            checked={preferences.cloudMixdownMode === 'always'}
            onChange={() => updatePreference('cloudMixdownMode', 'always')}
            name="cloudMixdownMode"
            value="always"
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LabeledRadio
              label="Every"
              checked={preferences.cloudMixdownMode === 'every'}
              onChange={() => updatePreference('cloudMixdownMode', 'every')}
              name="cloudMixdownMode"
              value="every"
            />
            <Dropdown
              options={mixdownIntervalOptions}
              value={preferences.cloudMixdownInterval}
              onChange={(val) => updatePreference('cloudMixdownInterval', val)}
              width="120px"
            />
          </div>
        </div>
      </div>

      <div className="preferences-page__section">
        <LabeledCheckbox
          label="Show 'How would you like to save?' dialog"
          checked={preferences.showSaveDialog}
          onChange={(checked) => updatePreference('showSaveDialog', checked)}
        />
      </div>

      <Separator />

      <div className="preferences-page__section">
        <div className="preferences-page__field preferences-page__field--large">
          <label className="preferences-page__label">Temporary local save location</label>
          <div className="preferences-page__input-group">
            <LabeledInput
              label=""
              value={preferences.cloudTempLocation}
              onChange={(val) => updatePreference('cloudTempLocation', val)}
            />
            <Button variant="secondary">
              Browse
            </Button>
          </div>
        </div>

        <div className="preferences-page__field preferences-page__field--small">
          <label className="preferences-page__label">Remove temporary files after</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NumberStepper
              value={preferences.cloudTempRetentionDays}
              onChange={(val) => updatePreference('cloudTempRetentionDays', val)}
              min={1}
              max={365}
              width="80px"
            />
            <span className="preferences-page__label" style={{ fontWeight: 400 }}>days</span>
          </div>
        </div>

        <div className="preferences-page__info-box">
          Audacity creates a local copy of cloud projects while you work on them,
          improving performance and enabling you to work on unstable connections.
        </div>
      </div>
    </div>
  );
}

export default PreferencesModal;
