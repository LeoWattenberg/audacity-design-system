import type { MarqueeRect as MarqueeRectValue } from '../../hooks/useMarqueeSelection';

export interface MarqueeRectProps {
  /** Caller is responsible for the null check — this component
   *  always renders. */
  marqueeRect: MarqueeRectValue;
  focusColor: string;
}

/** Right-drag marquee rectangle. Rendered above tracks but below any
 *  UI chrome. Caller skips rendering when null so the DOM stays clean
 *  for normal interactions. */
export function MarqueeRect({ marqueeRect, focusColor }: MarqueeRectProps) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: `${marqueeRect.left}px`,
        top: `${marqueeRect.top}px`,
        width: `${marqueeRect.width}px`,
        height: `${marqueeRect.height}px`,
        border: `1px solid ${focusColor}`,
        background: 'rgba(132, 181, 255, 0.12)',
        pointerEvents: 'none',
        zIndex: 200,
      }}
    />
  );
}
