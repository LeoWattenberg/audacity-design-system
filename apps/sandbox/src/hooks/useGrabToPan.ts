import { useEffect, useRef, useState } from 'react';

/** Spacebar-hold grab-to-pan, à la Figma / Photoshop.
 *
 *  Holding Space (without focus in a text field) turns the canvas
 *  scroll container into a "grab" surface — left-click and drag
 *  scrolls it horizontally and vertically.
 *
 *  Spacebar in this codebase is also the play/pause shortcut. To keep
 *  both behaviours without colliding, the playback toggle is deferred
 *  to keyup, and is suppressed if the user actually dragged the
 *  canvas while space was held. So:
 *    - tap-and-release Space → fires `onSpaceTap` (play/pause)
 *    - hold Space + drag    → pans, no playback toggle
 *
 *  Returns flags the caller can use to set the cursor style: `grab`
 *  while just holding, `grabbing` while actively panning.
 */
export interface UseGrabToPanArgs {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  /** Fired on Space keyup if no pan drag occurred during the hold. */
  onSpaceTap: () => void;
}

export interface UseGrabToPanResult {
  /** True while Space is held down. Cursor should show `grab`. */
  isModifierHeld: boolean;
  /** True while the user is actively dragging in pan mode.
   *  Cursor should show `grabbing` and other canvas interactions
   *  (clip selection, time selection, etc.) should be suppressed. */
  isPanning: boolean;
}

export function useGrabToPan({
  scrollContainerRef,
  onSpaceTap,
}: UseGrabToPanArgs): UseGrabToPanResult {
  const [isModifierHeld, setIsModifierHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panDidOccurRef = useRef(false);
  const panStartRef = useRef<{
    scrollLeft: number;
    scrollTop: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  // Stable callback ref so the keyup listener doesn't need to be
  // re-bound every time the caller's `onSpaceTap` identity changes.
  const onSpaceTapRef = useRef(onSpaceTap);
  onSpaceTapRef.current = onSpaceTap;

  // Spacebar press/release.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const isTextField =
          target.tagName === 'TEXTAREA' ||
          (target.tagName === 'INPUT' &&
            ['text', 'search', 'url', 'email', 'tel', 'password', 'number'].includes(
              (target as HTMLInputElement).type,
            )) ||
          target.isContentEditable;
        if (isTextField) return;
      }
      // Block the browser's default Space behaviour (page scroll, button activation).
      e.preventDefault();
      if (e.repeat) return;
      setIsModifierHeld(true);
      panDidOccurRef.current = false;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      setIsModifierHeld((wasHeld) => {
        if (wasHeld && !panDidOccurRef.current) {
          // Pure tap — fire the playback toggle.
          onSpaceTapRef.current();
        }
        return false;
      });
      panDidOccurRef.current = false;
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Mouse drag → scroll the container. Only active while the modifier
  // is held; re-binding when it toggles attaches and detaches the
  // capture-phase listener cleanly.
  useEffect(() => {
    if (!isModifierHeld) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      panStartRef.current = {
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
        clientX: e.clientX,
        clientY: e.clientY,
      };
      panDidOccurRef.current = true;
      setIsPanning(true);
      // Beat clip / selection / split handlers that listen on the same
      // mousedown event — pan mode owns this click.
      e.preventDefault();
      e.stopPropagation();
    };

    const onMouseMove = (e: MouseEvent) => {
      const start = panStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.clientX;
      const dy = e.clientY - start.clientY;
      container.scrollLeft = start.scrollLeft - dx;
      container.scrollTop = start.scrollTop - dy;
    };

    const onMouseUp = () => {
      if (panStartRef.current) {
        panStartRef.current = null;
        setIsPanning(false);
      }
    };

    container.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      container.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isModifierHeld, scrollContainerRef]);

  return { isModifierHeld, isPanning };
}
