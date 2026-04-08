/**
 * SwipeTabContext — React context for sharing swipe progress between
 * SwipeTabContainer and BottomNavigation.
 *
 * Phase 22, Plan 01 — Core swipe infrastructure
 *
 * swipeProgress: a MotionValue<number> representing fractional screen index
 *   (0=Home, 1=Planner, 2=Ask, 3=Graph, 4=Settings).
 *   Used by BottomNavigation for real-time color interpolation without re-renders.
 *
 * navigateToTab: a function (targetIndex: number) => void that triggers
 *   slide animation to a specific tab (D-04: same animation as swipe).
 */

import { createContext, useContext } from 'react';
import type { MotionValue } from 'framer-motion';

export interface SwipeTabContextValue {
  swipeProgress: MotionValue<number>;
  navigateToTab: (targetIndex: number) => void;
}

export const SwipeTabContext = createContext<SwipeTabContextValue | null>(null);

/**
 * Hook to consume swipe tab context.
 * Must be used inside a SwipeTabContainer (which provides SwipeTabContext).
 */
export function useSwipeTab(): SwipeTabContextValue {
  const ctx = useContext(SwipeTabContext);
  if (!ctx) throw new Error('useSwipeTab must be used within SwipeTabContainer');
  return ctx;
}
