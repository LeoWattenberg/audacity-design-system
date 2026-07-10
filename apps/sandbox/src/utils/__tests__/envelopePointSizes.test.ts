import { describe, it, expect } from 'vitest';
import { ENVELOPE_POINT_STYLES, type EnvelopePointStyleKey } from '@audacity-ui/core';
import { deriveEnvelopePointSizes } from '../envelopePointSizes';

describe('deriveEnvelopePointSizes', () => {
  const styleKeys = Object.keys(ENVELOPE_POINT_STYLES) as EnvelopePointStyleKey[];

  it.each(styleKeys)('projects the expected size fields for style "%s"', (styleKey) => {
    const profile = ENVELOPE_POINT_STYLES[styleKey];
    const result = deriveEnvelopePointSizes(styleKey);

    expect(result).toEqual({
      outerRadius: profile.outerRadius,
      innerRadius: profile.innerRadius,
      outerRadiusHover: profile.outerRadiusHover,
      innerRadiusHover: profile.innerRadiusHover,
      lineWidth: profile.lineWidth,
      dualRingHover: profile.dualRingHover,
      solidCircle: profile.solidCircle,
      hoverRingColor: profile.hoverRingColor,
      hoverRingStrokeColor: profile.hoverRingStrokeColor,
      showWhiteOutlineOnHover: profile.showWhiteOutlineOnHover ?? false,
      showBlackOutlineOnHover: profile.showBlackOutlineOnHover ?? false,
      showBlackCenterOnHover: profile.showBlackCenterOnHover ?? false,
      showGreenCenterFillOnHover: profile.showGreenCenterFillOnHover,
      whiteCenterOnHover: profile.whiteCenterOnHover,
      whiteCenter: profile.whiteCenter,
      dualStrokeLine: profile.dualStrokeLine,
      lineColor: profile.lineColor,
    });
  });

  it('defaults showWhiteOutlineOnHover, showBlackOutlineOnHover, showBlackCenterOnHover to false when the profile omits them', () => {
    // Select by property, not position: any style whose raw profile leaves
    // these hover flags unset. Fails loudly (not silently on an empty
    // array) if every profile ever starts setting them explicitly.
    const styleKey = styleKeys.find((key) => {
      const profile = ENVELOPE_POINT_STYLES[key];
      return (
        profile.showWhiteOutlineOnHover === undefined &&
        profile.showBlackOutlineOnHover === undefined &&
        profile.showBlackCenterOnHover === undefined
      );
    });
    expect(styleKey).toBeDefined();

    const result = deriveEnvelopePointSizes(styleKey!);

    expect(result.showWhiteOutlineOnHover).toBe(false);
    expect(result.showBlackOutlineOnHover).toBe(false);
    expect(result.showBlackCenterOnHover).toBe(false);
  });

  it('projects the literal solidGreenSimple profile fields (locks the real style values, not just the field list)', () => {
    const result = deriveEnvelopePointSizes('solidGreenSimple');

    expect(result).toEqual({
      outerRadius: 5,
      innerRadius: 0,
      outerRadiusHover: 6,
      innerRadiusHover: 0,
      lineWidth: 2,
      dualRingHover: undefined,
      solidCircle: {
        fillColor: '#b8ff00',
        strokeColor: '#b8ff00',
        strokeWidth: 0,
        radius: 4.5,
        radiusHover: 5.5,
        cursorFollowerRadius: 3.5,
        useDualRingCursorFollower: false,
        breakLineAtCursor: false,
        whiteCenterOnHover: {
          innerRadius: 0,
          outerRadius: 1.5,
          blackRadius: 3.5,
        },
      },
      hoverRingColor: undefined,
      hoverRingStrokeColor: undefined,
      showWhiteOutlineOnHover: false,
      showBlackOutlineOnHover: false,
      showBlackCenterOnHover: false,
      showGreenCenterFillOnHover: undefined,
      whiteCenterOnHover: undefined,
      whiteCenter: undefined,
      dualStrokeLine: undefined,
      lineColor: undefined,
    });
  });
});
