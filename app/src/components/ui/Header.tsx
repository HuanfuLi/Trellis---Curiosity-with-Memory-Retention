import type { CSSProperties, ReactNode } from 'react';
import { useContext } from 'react';
import { HeaderScrollContext } from '../../lib/header-scroll-context';

/** Height of the header bar (excluding safe-area). Use in content padding. */
export const HEADER_HEIGHT = 56;

interface HeaderProps {
  /** Primary title text */
  title: string;
  /** Element rendered on the left side (e.g. hamburger button) */
  left?: ReactNode;
  /** Element rendered on the right side (e.g. action buttons) */
  right?: ReactNode;
  /** When true, title is centered between left/right slots. Default: left-aligned. */
  centered?: boolean;
  /** Extra inline styles on the outer fixed container */
  style?: CSSProperties;
  /**
   * Phase 28 D-07 — when true, Header paints a subtle `var(--shadow-1)` to
   * separate itself from scrolled content beneath. If omitted, the component
   * consumes `HeaderScrollContext` (published by App.tsx's Outlet wrapper).
   */
  scrolled?: boolean;
}

/**
 * Fixed page header that sits directly below the status-bar safe-area shield.
 *
 * Each screen using this component should add `paddingTop: HEADER_HEIGHT` (or more)
 * to its scrollable content so it doesn't sit behind the header.
 */
export function Header({ title, left, right, centered, style, scrolled: scrolledProp }: HeaderProps) {
  const ctx = useContext(HeaderScrollContext);
  const scrolled = scrolledProp ?? ctx?.scrolled ?? false;
  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--safe-area-top)',
        left: 0,
        right: 0,
        height: `${HEADER_HEIGHT}px`,
        backgroundColor: 'var(--surface)',
        // Phase 28 D-07 — scroll-aware shadow. 150ms ease-out so the
        // transition feels subtle; no shadow at rest keeps the flat look.
        boxShadow: scrolled ? 'var(--shadow-1)' : 'none',
        transition: 'box-shadow 150ms ease-out',
        zIndex: 190,
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: '448px',
          margin: '0 auto',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '12px',
        }}
      >
        {centered ? (
          <>
            <div style={{ minWidth: '40px', display: 'flex', alignItems: 'center' }}>
              {left}
            </div>
            <h1
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '1.125rem',
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </h1>
            <div style={{ minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {right}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ flex: 1, fontSize: '1.25rem', fontWeight: 700 }}>{title}</h1>
            {left}
            {right}
          </>
        )}
      </div>
    </div>
  );
}
