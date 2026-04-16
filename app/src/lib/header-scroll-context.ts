/**
 * HeaderScrollContext — Phase 28 D-07
 *
 * Broadcasts sub-screen Outlet scrollTop state to the Header component so
 * Header can render a subtle `var(--shadow-1)` once the content scrolls
 * past 4px, giving visual separation between the fixed header and the
 * scrolled content beneath it.
 *
 * App.tsx's RootLayout computes headerScrolled from the sub-screen Outlet
 * wrapper's onScroll handler and publishes via this context. Header.tsx
 * reads via `useContext` and applies the shadow with a 150ms ease-out
 * transition.
 *
 * Exposed as a tiny standalone module (not App.tsx) so that Header.tsx
 * can consume without a circular `Header -> App -> Header` import chain.
 */

import { createContext } from 'react';

export interface HeaderScrollContextValue {
  scrolled: boolean;
}

export const HeaderScrollContext = createContext<HeaderScrollContextValue>({ scrolled: false });
