import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Touch coordinates for the active drag
interface DragState {
  startX: number;
  startY: number;
  startTime: number;
  tracking: boolean;
}

const EDGE_PX = 24; // Only start a back-gesture from the leftmost 24px edge
const MIN_DX = 60; // Must drag right at least 60px before committing
const MIN_VX = 0.3; // px/ms — iOS-like flick velocity

/**
 * Wires up an iOS-style left-edge swipe-to-go-back gesture.
 *
 * - Only the leftmost `EDGE_PX` of the screen can start a drag.
 * - Skips when there is no history to pop (window.history.length <= 1).
 * - Skips on horizontal scrollable areas (touches that scroll horizontally).
 * - Calls `navigate(-1)` once the threshold is crossed.
 */
export function useSwipeBack(enabled: boolean = true) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    // Skip if there's no history to pop back to
    if (window.history.length <= 1) return;

    let state: DragState | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0]!;
      // Only start from the left edge
      if (t.clientX > EDGE_PX) return;
      state = {
        startX: t.clientX,
        startY: t.clientY,
        startTime: Date.now(),
        tracking: true,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!state || !state.tracking) return;
      const t = e.touches[0]!;
      const dx = t.clientX - state.startX;
      const dy = t.clientY - state.startY;
      // If the user is scrolling vertically, abandon the back gesture
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
        state.tracking = false;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!state || !state.tracking) {
        state = null;
        return;
      }
      const t = e.changedTouches[0]!;
      const dx = t.clientX - state.startX;
      const dt = Math.max(1, Date.now() - state.startTime);
      const vx = dx / dt;
      state = null;

      if (dx >= MIN_DX && vx >= MIN_VX) {
        // Try to go back; if nothing to go back to, bail
        navigate(-1);
      }
    };

    const onTouchCancel = () => {
      state = null;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [enabled, navigate]);
}
