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
    const styleKey = styleKeys[0];
    const result = deriveEnvelopePointSizes(styleKey);

    expect(result.showWhiteOutlineOnHover).toBe(false);
    expect(result.showBlackOutlineOnHover).toBe(false);
    expect(result.showBlackCenterOnHover).toBe(false);
  });
});
