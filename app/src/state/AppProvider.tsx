import type { ReactNode } from 'react';

// AppProvider is a pass-through — each screen uses hooks directly.
// This file exists as the composition point if we add Context providers later.
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  return <>{children}</>;
}
