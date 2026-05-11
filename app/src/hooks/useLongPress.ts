import { useRef, useEffect, useCallback } from 'react';

/**
 * 480ms long-press hook — codebase-wide convention (see CLAUDE.md "Best practices",
 * RESEARCH.md Section 1, original pattern at ChatMessage.tsx:119-140).
 *
 * Returns:
 * - didLongPress: ref consumers check in their onClick handler to suppress the
 *   short-tap action after a long-press fires. Set to true when the timer
 *   elapses; reset to false on each pointerdown.
 * - bind: pointer event handlers to spread onto the target element.
 *
 * Pointer-event policy (do NOT migrate to touch events or the browser's native
 * long-press menu hook):
 * - The native long-press menu handler is intentionally NOT registered. Android
 *   WebView surfaces the native text-selection menu on long-press if that handler
 *   is unhandled. The timer-only path here avoids surfacing it (verified by the
 *   live ChatMessage.tsx pattern).
 * - onPointerMove cancels the timer so vertical scrolling never accidentally
 *   triggers a long-press.
 */
export function useLongPress(ms: number, onLongPress: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const callbackRef = useRef(onLongPress);

  // Keep latest callback in a ref so the timer always invokes the freshest closure
  useEffect(() => {
    callbackRef.current = onLongPress;
  }, [onLongPress]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    didLongPress.current = false;
    cancel();
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      callbackRef.current();
    }, ms);
  }, [ms, cancel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  const bind = {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerMove: cancel,
  };

  return { didLongPress, bind };
}
