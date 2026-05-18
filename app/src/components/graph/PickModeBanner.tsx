import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Question } from '../../types/index.ts';

/**
 * PickModeBanner — Phase 49-04
 *
 * In-tree banner rendered below the Header when the user enters pick-mode via
 * the CorrectionCard's Move or Merge row (D-06). Reads:
 *
 *   "Tap a cluster to move 'X' into it"   (kind: 'move')
 *   "Tap an anchor to merge 'X' into"     (kind: 'merge')
 *
 * Cancel button (right-aligned) returns to the correction card AT THE ORIGINAL
 * COORDS (W-2) — GraphScreen owns that handoff via handlePickModeCancel.
 *
 * Placement rule (R19 + CLAUDE.md §"Header positioning"):
 *   - Renders IN-TREE below the Header. NEVER portaled. Portaling would put it
 *     in document.body, fighting the GraphScreen Header's slot-local
 *     containing-block invariant.
 *   - GraphScreen is always-mounted; do NOT add transform/will-change/filter/
 *     contain ancestors of the Header — keep this banner's wrapper plain.
 *
 * Accessibility:
 *   - role="status" + aria-live="polite" so screen readers announce pick-mode
 *     entry without interrupting active speech.
 *   - Escape key on the document also fires onCancel — useful for keyboard
 *     users + desktop testing.
 */

export interface PickModeBannerProps {
  pickMode: { kind: 'move' | 'merge'; sourceNode: Question };
  onCancel: () => void;
}

export function PickModeBanner({ pickMode, onCancel }: PickModeBannerProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const title = pickMode.sourceNode.title ?? pickMode.sourceNode.content;
  const message =
    pickMode.kind === 'move'
      ? t('graph.correction.pickMode.move', { title })
      : t('graph.correction.pickMode.merge', { title });

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: '12px 16px',
        backgroundColor: 'color-mix(in srgb, var(--primary-40) 15%, transparent)',
        borderRadius: 'var(--radius-xl)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        margin: '0',
        border: '1px solid color-mix(in srgb, var(--primary-40) 30%, transparent)',
      }}
    >
      <p
        style={{
          fontSize: '0.875rem',
          flex: 1,
          minWidth: 0,
          margin: 0,
          color: 'var(--foreground)',
        }}
      >
        {message}
      </p>
      <button
        onClick={onCancel}
        style={{
          color: 'var(--primary-40)',
          background: 'none',
          border: 'none',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
          padding: '4px 8px',
          flexShrink: 0,
        }}
      >
        {t('graph.correction.pickMode.cancel')}
      </button>
    </div>
  );
}
