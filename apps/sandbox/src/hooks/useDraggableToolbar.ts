import { useState, useRef, useCallback } from 'react';

// Tools toolbar position — gripper-drag detaches it and the user can drop
// anywhere. Releasing near the top / bottom edge snaps to a dock; anywhere
// else commits a floating position. Snap thresholds are intentionally
// generous (1.5× toolbar height) so the user gets a free dock without
// having to land precisely on the edge.
export type ToolbarPosition =
  | { kind: 'top' }
  | { kind: 'bottom' }
  | { kind: 'floating'; x: number; y: number };

export interface UseDraggableToolbarReturn {
  toolbarPosition: ToolbarPosition;
  setToolbarPosition: React.Dispatch<React.SetStateAction<ToolbarPosition>>;
  handleToolbarGripperMouseDown: (e: React.MouseEvent, rect: DOMRect) => void;
}

/**
 * Hook for managing the draggable transport toolbar's position.
 * Handles gripper-drag detach/reattach: dragging the gripper flips the
 * toolbar to floating and tracks the cursor via document-level listeners
 * (attached on mousedown, removed on mouseup — a self-cleaning pattern,
 * not a bind-once effect). Releasing near the top/bottom edge snaps the
 * toolbar back into a dock.
 */
export function useDraggableToolbar(): UseDraggableToolbarReturn {
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition>({ kind: 'top' });
  const dragStateRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  const handleToolbarGripperMouseDown = useCallback(
    (e: React.MouseEvent, rect: DOMRect) => {
      dragStateRef.current = {
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };
      // Immediately flip to floating at the toolbar's current rect so the
      // first mousemove doesn't jump — the toolbar stays under the cursor.
      setToolbarPosition({ kind: 'floating', x: rect.left, y: rect.top });

      const SNAP_PX = 72;
      const onMove = (ev: MouseEvent) => {
        const state = dragStateRef.current;
        if (!state) return;
        setToolbarPosition({
          kind: 'floating',
          x: ev.clientX - state.offsetX,
          y: ev.clientY - state.offsetY,
        });
      };
      const onUp = (ev: MouseEvent) => {
        dragStateRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (ev.clientY < SNAP_PX) {
          setToolbarPosition({ kind: 'top' });
        } else if (ev.clientY > window.innerHeight - SNAP_PX) {
          setToolbarPosition({ kind: 'bottom' });
        }
        // else: leave it floating at the last position
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [],
  );

  return {
    toolbarPosition,
    setToolbarPosition,
    handleToolbarGripperMouseDown,
  };
}
