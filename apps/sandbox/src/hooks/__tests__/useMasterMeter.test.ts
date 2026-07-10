// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import type { AudioPlaybackManager } from '@audacity-ui/audio';
import { useMasterMeter } from '../useMasterMeter';

afterEach(cleanup);

function makeAudioManagerStub() {
  return {
    setMasterVolume: vi.fn(),
  };
}

function makeAudioManagerRef(stub: ReturnType<typeof makeAudioManagerStub>) {
  // justified: shape-only test stub — useMasterMeter only calls setMasterVolume on the ref
  return { current: stub as unknown as AudioPlaybackManager };
}

describe('useMasterMeter', () => {
  it('starts with masterVolume at 1', () => {
    const stub = makeAudioManagerStub();
    const audioManagerRef = makeAudioManagerRef(stub);
    const { result } = renderHook(() =>
      useMasterMeter({ masterMeterLevel: 0, audioManagerRef })
    );

    expect(result.current.masterVolume).toBe(1);
  });

  it('handleMasterVolumeChange updates masterVolume and calls audioManagerRef.current.setMasterVolume', () => {
    const stub = makeAudioManagerStub();
    const audioManagerRef = makeAudioManagerRef(stub);
    const { result } = renderHook(() =>
      useMasterMeter({ masterMeterLevel: 0, audioManagerRef })
    );

    act(() => {
      result.current.handleMasterVolumeChange(0.5);
    });

    expect(result.current.masterVolume).toBe(0.5);
    expect(stub.setMasterVolume).toHaveBeenCalledWith(0.5);
  });

  it('masterLevelLeft is -60 when masterMeterLevel is 0', () => {
    const stub = makeAudioManagerStub();
    const audioManagerRef = makeAudioManagerRef(stub);
    const { result } = renderHook(() =>
      useMasterMeter({ masterMeterLevel: 0, audioManagerRef })
    );

    expect(result.current.masterLevelLeft).toBe(-60);
  });

  it('masterLevelLeft is -60 for negative masterMeterLevel', () => {
    const stub = makeAudioManagerStub();
    const audioManagerRef = makeAudioManagerRef(stub);
    const { result } = renderHook(() =>
      useMasterMeter({ masterMeterLevel: -5, audioManagerRef })
    );

    expect(result.current.masterLevelLeft).toBe(-60);
  });

  it('masterLevelLeft derives dB from masterMeterLevel on a -60..0 scale', () => {
    const stub = makeAudioManagerStub();
    const audioManagerRef = makeAudioManagerRef(stub);
    const { result, rerender } = renderHook(
      ({ masterMeterLevel }) => useMasterMeter({ masterMeterLevel, audioManagerRef }),
      { initialProps: { masterMeterLevel: 50 } }
    );

    // (50 / 100) * 60 - 60 = -30
    expect(result.current.masterLevelLeft).toBeCloseTo(-30);

    rerender({ masterMeterLevel: 100 });
    // (100 / 100) * 60 - 60 = 0
    expect(result.current.masterLevelLeft).toBeCloseTo(0);
  });

  it('masterLevelLeft clamps to 0 when masterMeterLevel exceeds 100', () => {
    const stub = makeAudioManagerStub();
    const audioManagerRef = makeAudioManagerRef(stub);
    const { result } = renderHook(() =>
      useMasterMeter({ masterMeterLevel: 150, audioManagerRef })
    );

    expect(result.current.masterLevelLeft).toBe(0);
  });

  it('masterLevelRight trails masterLevelLeft by 0.5dB, clamped at -60', () => {
    const stub = makeAudioManagerStub();
    const audioManagerRef = makeAudioManagerRef(stub);
    const { result } = renderHook(() =>
      useMasterMeter({ masterMeterLevel: 100, audioManagerRef })
    );

    // masterLevelLeft = 0 -> masterLevelRight = -0.5
    expect(result.current.masterLevelRight).toBeCloseTo(-0.5);
  });

  it('masterLevelRight clamps at -60 when masterLevelLeft is already -60', () => {
    const stub = makeAudioManagerStub();
    const audioManagerRef = makeAudioManagerRef(stub);
    const { result } = renderHook(() =>
      useMasterMeter({ masterMeterLevel: 0, audioManagerRef })
    );

    expect(result.current.masterLevelRight).toBe(-60);
  });
});
