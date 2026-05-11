import type { ReactNode, MouseEvent } from 'react';
import { createPortal } from 'react-dom';

// Per CONTEXT D-09: reusable slide-up bottom sheet. Overlay zIndex 500 clears the
// app Header (zIndex 190) per RESEARCH Pitfall 5. Inline styles only — project
// convention is CSS variables, not Tailwind utility classes.
//
// Phase 43 Plan 43-09 (UAT Test 2 gap closure): the outer overlay is wrapped in
// createPortal(overlay, document.body) so the sheet escapes any ancestor
// containing block (specifically SwipeTabContainer's per-slot translateZ(0)).
// Without this, position:fixed anchors to the slot bottom rather than the viewport,
// and the BottomNavigation (~80px row + safe-area-bottom) physically eclipses the
// bottom row(s) of the sheet. Matches the Phase 32.1 Header portal-vs-in-tree
// pattern documented in CLAUDE.md. Defense-in-depth: even with the portal escape,
// the inner sheet's bottom is offset by calc(80px + var(--safe-area-bottom)) so
// the sheet clears the BottomNavigation footprint geometrically too.

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  compact?: boolean;  // when true, overrides minHeight to 'auto' and maxHeight to '50vh' (per Phase 43 LP-01 — 3-row engagement menu should not show 45vh empty space)
}

export function BottomSheet({ open, onClose, title, children, compact }: BottomSheetProps) {
  const stop = (e: MouseEvent) => e.stopPropagation();

  // SSR / non-browser guard — document is undefined in pre-hydration contexts.
  // Skipping the portal in that branch means the sheet simply doesn't render
  // (matches the previous in-tree behavior on the server: zero output).
  if (typeof document === 'undefined') return null;

  const overlay = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        backgroundColor: open ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0)',
        pointerEvents: open ? 'auto' : 'none',
        transition: 'background-color 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      <div
        onClick={stop}
        style={{
          position: 'absolute',
          // Phase 43 gap-closure (UAT Test 2): anchor sheet ABOVE the fixed
          // BottomNavigation (~80px row + safe-area-bottom). Combined with the
          // createPortal escape to document.body, this guarantees the bottom
          // row (Dismiss) is never clipped by the nav. See
          // .planning/debug/dismiss-row-clipped-by-bottom-nav.md.
          bottom: 'calc(80px + var(--safe-area-bottom))',
          left: 0,
          right: 0,
          backgroundColor: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 16px 24px',
          boxShadow: 'var(--shadow-3)',
          minHeight: compact ? 'auto' : '45vh',
          maxHeight: compact ? '50vh' : '75vh',
          overflowY: 'auto',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {title !== undefined && (
          <>
            <div
              style={{
                width: 40,
                height: 4,
                backgroundColor: 'var(--border)',
                borderRadius: 2,
                margin: '0 auto 16px',
              }}
            />
            <h3
              style={{
                margin: 0,
                marginBottom: 16,
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--foreground)',
              }}
            >
              {title}
            </h3>
          </>
        )}
        {children}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
