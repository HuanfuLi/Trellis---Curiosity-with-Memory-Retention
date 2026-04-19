import type { CSSProperties, ReactNode } from 'react';
import { useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
  /** When provided, renders a back-arrow left slot that navigates to this path */
  backTo?: string;
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
 *
 * Architecture: Header DOM is portaled to document.body via createPortal. This
 * decouples Header positioning from any ancestor's CSS — scroll containers,
 * transforms, filters, animations, containing-block creators in the React parent
 * tree have ZERO effect on Header. position:fixed always anchors to the viewport.
 *
 * Why portal (and not just position:fixed in-tree): position:fixed elements re-parent
 * to a transformed/filtered/will-change'd/contained/perspective'd ancestor (CSS spec),
 * AND on Android Chromium WebView even an `overflow: auto` ancestor can capture
 * fixed children as scroll-content. This bug class has recurred multiple times
 * (commits 8df7980c, a7203a65, 2dcef5d7, 73d657a0) — every time someone adds a new
 * scrollable wrapper or transform-based animation, Header positioning breaks again.
 * Portaling Header to document.body makes it structurally impossible: there is no
 * ancestor between Header and the viewport that can interfere.
 *
 * React context still propagates through portals — HeaderScrollContext continues
 * to work across the portal boundary.
 */
export function Header({ title, left, right, centered, backTo, style, scrolled: scrolledProp }: HeaderProps) {
  const navigate = useNavigate();
  const ctx = useContext(HeaderScrollContext);
  const scrolled = scrolledProp ?? ctx?.scrolled ?? false;
  const headerRef = useRef<HTMLDivElement | null>(null);

  // Bug 2 diagnostic + defensive fix.
  //
  // Symptom: on Capacitor Android, Header initially renders at "upper middle" of
  // viewport (~hundreds of px below correct position) then snaps to top edge after
  // ~100-300ms. Web browser doesn't reproduce. Removing transform from sub-screen-in
  // keyframes (opacity-only animation) did NOT help — so the cause isn't a transformed
  // ancestor reparenting our containing block.
  //
  // Defensive fix: measure env(safe-area-inset-top) via a probe element AND publish
  // the result as --status-bar-height. This gives Header a guaranteed-resolved fallback
  // chain `env() → var(--status-bar-height) → 0`. If Android Capacitor returns a stale
  // env() value initially then corrects, our JS measurement can detect that and update.
  //
  // Diagnostic: log Header position + safe-area values at multiple timing checkpoints
  // (mount, raf, +100ms, +300ms). Look for [Bug2-Header] in chrome://inspect Console.
  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:env(safe-area-inset-top);left:0;width:1px;height:1px;pointer-events:none;visibility:hidden;z-index:-1';
    document.body.appendChild(probe);

    const snapshot = (label: string) => {
      const el = headerRef.current;
      if (!el) return;
      const cs = getComputedStyle(el);
      const root = getComputedStyle(document.documentElement);
      const probeTop = probe.getBoundingClientRect().top;
      const headerRect = el.getBoundingClientRect();

      // Walk up DOM and find any ancestor with transform/will-change/filter/contain/perspective.
      const offenders: string[] = [];
      let p: HTMLElement | null = el.parentElement;
      while (p && p !== document.body) {
        const ps = getComputedStyle(p);
        const props: string[] = [];
        if (ps.transform !== 'none') props.push(`transform=${ps.transform}`);
        if (ps.willChange !== 'auto') props.push(`will-change=${ps.willChange}`);
        if (ps.filter !== 'none') props.push(`filter=${ps.filter}`);
        if (ps.contain !== 'none') props.push(`contain=${ps.contain}`);
        if (ps.perspective !== 'none') props.push(`perspective=${ps.perspective}`);
        if (props.length > 0) {
          offenders.push(`${p.tagName}.${p.className || '(no-class)'}: ${props.join(', ')}`);
        }
        p = p.parentElement;
      }

      // Promote env() measurement to --status-bar-height so the var() fallback chain
      // has a concrete value even when env() is briefly unresolved.
      if (probeTop > 0 && root.getPropertyValue('--status-bar-height').trim() !== `${probeTop}px`) {
        document.documentElement.style.setProperty('--status-bar-height', `${probeTop}px`);
      }

      // eslint-disable-next-line no-console
      console.log(`[Bug2-Header ${label}]`, {
        headerTop: cs.top,
        headerPosition: cs.position,
        headerRect: { top: headerRect.top, height: headerRect.height },
        safeAreaTopVar: root.getPropertyValue('--safe-area-top').trim(),
        statusBarHeightVar: root.getPropertyValue('--status-bar-height').trim(),
        envProbeTop: probeTop,
        viewport: { innerHeight: window.innerHeight, innerWidth: window.innerWidth },
        ancestorOffenders: offenders.length > 0 ? offenders : 'none',
      });
    };

    snapshot('mount');
    const rafId = requestAnimationFrame(() => snapshot('raf'));
    const t100 = window.setTimeout(() => snapshot('+100ms'), 100);
    const t300 = window.setTimeout(() => snapshot('+300ms'), 300);
    const t1000 = window.setTimeout(() => snapshot('+1000ms'), 1000);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t100);
      clearTimeout(t300);
      clearTimeout(t1000);
      document.body.removeChild(probe);
    };
  }, []);

  const effectiveLeft = left ?? (backTo ? (
    <button onClick={() => navigate(backTo)} style={{ background: 'none', border: 'none', padding: '8px', marginLeft: '-8px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
      <ArrowLeft size={20} />
    </button>
  ) : undefined);
  const effectiveCentered = centered ?? !!backTo;
  const headerNode = (
    <div
      ref={headerRef}
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
        {effectiveCentered ? (
          <>
            {/* Phase 28 D-29 — WCAG 2.5.8 44×44 minimum touch target for the
                 left/right slots. The back button inside inherits from the
                 flex container; we also stretch the slot to the full header
                 height so any nested button has at least 44px tap surface. */}
            <div style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
              {effectiveLeft}
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
            <div style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {right}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ flex: 1, fontSize: '1.25rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
            {/* Phase 28 D-29 — 44×44 enforced at the slot level so consumer
                 back buttons inherit a minimum tap area regardless of their
                 own inline styles. */}
            <div style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
              {effectiveLeft}
            </div>
            <div style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
              {right}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Portal to document.body so position:fixed always anchors to the viewport
  // regardless of any ancestor's transform / overflow / will-change / contain.
  // See class-doc above for the full rationale.
  return createPortal(headerNode, document.body);
}
