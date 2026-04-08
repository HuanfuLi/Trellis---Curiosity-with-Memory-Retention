/**
 * SwipeTabContainer.tsx
 * Horizontal strip container with gesture-driven swipe navigation.
 *
 * Phase 22, Plan 01 — Core swipe infrastructure
 *
 * Lays out all screens side by side in a horizontal strip.
 * Handles: axis lock (D-07), rubber-band edges (D-13), commit threshold (D-14),
 * keyboard guard (D-09), nested-drag suppression (D-08/D-10), spring animation (D-16),
 * tab-tap animation (D-04/D-05), URL sync on commit only (Pitfall 2).
 *
 * Children (e.g. BottomNavigation) are rendered outside the strip but inside the
 * SwipeTabContext.Provider, so they can read the swipeProgress MotionValue.
 */

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { SwipeTabContext } from '../lib/swipe-tab-context';
import {
  resolveAxisLock,
  computeDragOffset,
  resolveCommitIndex,
  shouldBlockGesture,
} from '../lib/swipe-tab-logic';

interface SwipeTabContainerProps {
  screens: React.ReactNode[];
  routes: readonly string[];
  children?: React.ReactNode;
}

/** Spring transition used for both swipe commit and tab-tap animations (D-16: ~250ms) */
const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 };

export function SwipeTabContainer({ screens, routes, children }: SwipeTabContainerProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Refs (no re-renders during gesture) ──────────────────────────────────
  const activeIndexRef = useRef(0);
  const screenWidthRef = useRef(typeof window !== 'undefined' ? window.innerWidth : 375);
  const lockAxisRef = useRef<'x' | 'y' | null>(null);
  const gestureBlockedRef = useRef(false);

  // ── Motion values ────────────────────────────────────────────────────────
  const dragOffset = useMotionValue(0);

  // Strip x = -(activeIndex * screenWidth) + dragOffset
  const stripX = useTransform(dragOffset, (raw) => {
    return -(activeIndexRef.current * screenWidthRef.current) + raw;
  });

  // swipeProgress = fractional screen index (0–N) derived from strip position
  const swipeProgress = useTransform(stripX, (x) => {
    const w = screenWidthRef.current;
    return w > 0 ? -x / w : 0;
  });

  // ── Keyboard detection (D-09) ────────────────────────────────────────────
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) {
        setKeyboardOpen(true);
      }
    };
    const onFocusOut = () => setKeyboardOpen(false);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  // ── Route sync (external navigation / initial load / back button) ────────
  useEffect(() => {
    const idx = routes.indexOf(location.pathname);
    if (idx !== -1 && idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      // Snap to new position without animation (external navigation)
      dragOffset.set(0);
    }
  }, [location.pathname, routes, dragOffset]);

  // ── Pan handlers ─────────────────────────────────────────────────────────

  const onPanStart = useCallback((_e: PointerEvent) => {
    lockAxisRef.current = null;
    // Read fresh screen width at gesture start (Pitfall 6)
    screenWidthRef.current = window.innerWidth;
    // Check for nested draggable (D-08, D-10)
    const target = (_e.target as HTMLElement);
    if (target?.closest?.('[data-no-swipe-nav]')) {
      gestureBlockedRef.current = true;
      return;
    }
    gestureBlockedRef.current = false;
  }, []);

  const onPan = useCallback((_e: PointerEvent, info: PanInfo) => {
    if (shouldBlockGesture({ keyboardOpen, gestureBlocked: gestureBlockedRef.current })) return;

    // Axis lock (D-07)
    if (lockAxisRef.current === null) {
      const resolved = resolveAxisLock({ x: info.offset.x, y: info.offset.y });
      if (resolved !== null) {
        lockAxisRef.current = resolved;
      }
    }

    // If not locked to x, let vertical scroll happen
    if (lockAxisRef.current !== 'x') return;

    // Compute drag offset with rubber-band at edges (D-13)
    const offset = computeDragOffset(
      info.offset.x,
      activeIndexRef.current,
      routes.length,
    );
    dragOffset.set(offset);
  }, [keyboardOpen, routes.length, dragOffset]);

  const onPanEnd = useCallback((_e: PointerEvent, info: PanInfo) => {
    // If blocked or not horizontally locked, snap back
    if (gestureBlockedRef.current || lockAxisRef.current !== 'x') {
      animate(dragOffset, 0, SPRING);
      return;
    }

    // Determine commit target (D-14: 20% threshold)
    const newIndex = resolveCommitIndex(
      info.offset.x,
      activeIndexRef.current,
      screenWidthRef.current,
      routes.length,
    );

    if (newIndex !== activeIndexRef.current) {
      activeIndexRef.current = newIndex;
      navigate(routes[newIndex]);
    }

    // Animate dragOffset to 0 — strip will rest at -(newIndex * screenWidth)
    animate(dragOffset, 0, SPRING);
  }, [routes, navigate, dragOffset]);

  // ── navigateToTab (D-04, D-05) ──────────────────────────────────────────
  const navigateToTab = useCallback((targetIndex: number) => {
    if (targetIndex === activeIndexRef.current) return;
    if (targetIndex < 0 || targetIndex >= routes.length) return;

    // Calculate visual jump distance so the spring animates from old position
    const jump = (activeIndexRef.current - targetIndex) * screenWidthRef.current;
    activeIndexRef.current = targetIndex;

    // Set dragOffset to the visual distance (appears at old position)
    dragOffset.set(jump);
    // Animate to 0 → slides to new committed position
    animate(dragOffset, 0, SPRING);

    navigate(routes[targetIndex]);
  }, [routes, navigate, dragOffset]);

  // ── Context value (stable reference) ─────────────────────────────────────
  const contextValue = useMemo(() => ({
    swipeProgress,
    navigateToTab,
  }), [swipeProgress, navigateToTab]);

  return (
    <SwipeTabContext.Provider value={contextValue}>
      <motion.div
        onPanStart={onPanStart}
        onPan={onPan}
        onPanEnd={onPanEnd}
        style={{
          display: 'flex',
          width: `${routes.length * 100}vw`,
          x: stripX,
          touchAction: 'pan-y',
        }}
      >
        {screens.map((screen, i) => (
          <div
            key={routes[i]}
            style={{
              width: '100vw',
              flexShrink: 0,
              minHeight: '100vh',
              overflow: 'hidden',
            }}
          >
            {screen}
          </div>
        ))}
      </motion.div>
      {children}
    </SwipeTabContext.Provider>
  );
}
