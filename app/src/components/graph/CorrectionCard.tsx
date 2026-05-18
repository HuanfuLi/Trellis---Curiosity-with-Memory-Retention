import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pencil,
  Move,
  GitMerge,
  Scissors,
  Trash2,
  ArrowLeftRight,
  ChevronRight,
  X,
  Loader2,
} from 'lucide-react';
import type { Question } from '../../types/index.ts';
import { graphCommandService } from '../../services/graph-command.service.ts';
import { toast } from '../../lib/toast.ts';
import { getActionsForNode, type CorrectionAction } from './correction-actions.ts';

// Re-export the matrix surface so app code can single-import from this component.
export { getActionsForNode } from './correction-actions.ts';
export type { CorrectionAction } from './correction-actions.ts';

/**
 * CorrectionCard — Phase 49-02
 *
 * iOS-style vertical action list anchored to the long-press release position.
 * Per-node-type action matrix (D-15) gated by `getActionsForNode`. Inline
 * Rename sub-flow swaps the body content (RESEARCH R14). Reorg-in-progress
 * (D-16) suppresses the entire action list with a single paused-message row.
 *
 * The card coexists with GraphScreen's inspector card (D-03) — GraphScreen
 * dismisses the inspector on long-press release before mounting this card.
 *
 * Service boundary (Phase 48 D-12):
 *   - Rename submits via `graphCommandService.rename(id, newTitle)`.
 *   - Other actions are dispatched UP to GraphScreen via `onActionSelected`
 *     (move/merge → pickMode in Plan 49-04; prune → snackbar in 49-04;
 *     delete → ConfirmDialog in 49-03; detach → toast in 49-04).
 *
 * Validation (Phase 48 D-16): rename input is operator-trust — bypasses
 * `normalizeAnchorName`. Hard validation only (non-empty trim + ≤100 chars);
 * service-side VALIDATION_ERROR is the canonical source of truth, this is the
 * UI fast-path mirror.
 */

// ─── Public types ────────────────────────────────────────────────────────────

export interface CorrectionCardProps {
  node: Question;
  isReorganizing: boolean;
  onClose: () => void;
  onActionSelected: (action: CorrectionAction) => void;
  /** Long-press release viewport coordinates (px); the card clamps placement to stay on-screen. */
  anchorX: number;
  anchorY: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_TITLE_LENGTH = 100;
const CARD_WIDTH = 260;
const CARD_MIN_HEIGHT = 56;
const VIEWPORT_PADDING = 12;

// ─── Action icon mapping ─────────────────────────────────────────────────────

function actionIcon(kind: CorrectionAction['kind']) {
  switch (kind) {
    case 'rename':
      return <Pencil size={18} />;
    case 'move':
      return <Move size={18} />;
    case 'merge':
      return <GitMerge size={18} />;
    case 'detach':
      return <ArrowLeftRight size={18} />;
    case 'prune':
      return <Scissors size={18} />;
    case 'delete':
      return <Trash2 size={18} />;
  }
}

// ─── Card placement helper ───────────────────────────────────────────────────

/**
 * Clamp the card top-left so the card stays inside the viewport. Falls back
 * to `{ left: anchorX, top: anchorY }` outside the browser.
 */
function clampPlacement(anchorX: number, anchorY: number, estimatedHeight: number): CSSProperties {
  if (typeof window === 'undefined') {
    return { left: anchorX, top: anchorY };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const minLeft = VIEWPORT_PADDING;
  const maxLeft = Math.max(minLeft, vw - CARD_WIDTH - VIEWPORT_PADDING);
  const minTop = VIEWPORT_PADDING;
  const maxTop = Math.max(minTop, vh - estimatedHeight - VIEWPORT_PADDING);
  return {
    left: Math.min(Math.max(anchorX, minLeft), maxLeft),
    top: Math.min(Math.max(anchorY, minTop), maxTop),
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface ActionRowProps {
  action: CorrectionAction;
  label: string;
  onClick: () => void;
}

function ActionRow({ action, label, onClick }: ActionRowProps) {
  const isDestructive = action.kind === 'delete';
  return (
    <button
      onClick={onClick}
      className="active-squish"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        width: '100%',
        padding: '14px 16px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        textAlign: 'left',
        color: isDestructive ? 'var(--danger)' : 'var(--foreground)',
      }}
    >
      <div
        style={{
          color: isDestructive ? 'var(--danger)' : 'var(--primary-40)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {actionIcon(action.kind)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 500, fontSize: '0.95rem', margin: 0 }}>{label}</p>
      </div>
      <ChevronRight size={18} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
    </button>
  );
}

interface RenameFormProps {
  initialValue: string;
  onSubmit: (newTitle: string) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
  externalError: string | null;
}

function RenameForm({ initialValue, onSubmit, onCancel, busy, externalError }: RenameFormProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const trimmed = value.trim();
  const isEmpty = trimmed.length === 0;
  const isTooLong = trimmed.length > MAX_TITLE_LENGTH;
  const localError = isEmpty
    ? t('graph.correction.rename.empty')
    : isTooLong
      ? t('graph.correction.rename.tooLong')
      : null;
  const errorToShow = externalError ?? localError;
  const canSubmit = !busy && !isEmpty && !isTooLong;

  const handleSubmit = () => {
    if (!canSubmit) return;
    void onSubmit(trimmed);
  };

  return (
    <div style={{ padding: '16px' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder={t('graph.correction.rename.placeholder')}
        disabled={busy}
        style={{
          width: '100%',
          flex: 1,
          minWidth: 0,
          padding: '10px 12px',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface-variant)',
          color: 'var(--foreground)',
          fontSize: '0.95rem',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {errorToShow && (
        <p
          style={{
            color: 'var(--danger)',
            fontSize: '0.75rem',
            marginTop: '6px',
            marginBottom: 0,
          }}
        >
          {errorToShow}
        </p>
      )}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '100px',
            border: '1px solid var(--border)',
            backgroundColor: 'transparent',
            color: 'var(--muted-foreground)',
            fontSize: '0.875rem',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {t('graph.correction.rename.cancel')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '100px',
            backgroundColor: canSubmit ? 'var(--primary-40)' : 'var(--surface-variant)',
            color: canSubmit ? 'white' : 'var(--muted-foreground)',
            fontWeight: 600,
            fontSize: '0.875rem',
            border: 'none',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {t('graph.correction.rename.save')}
        </button>
      </div>
    </div>
  );
}

function PausedRow() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        backgroundColor: 'var(--surface-variant)',
      }}
    >
      <Loader2
        size={18}
        style={{
          color: 'var(--muted-foreground)',
          flexShrink: 0,
          animation: 'spin 1.5s linear infinite',
        }}
      />
      <p
        style={{
          flex: 1,
          margin: 0,
          fontSize: '0.875rem',
          color: 'var(--muted-foreground)',
        }}
      >
        {t('graph.correction.reorgPaused')}
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CorrectionCard(props: CorrectionCardProps) {
  const { node, isReorganizing, onClose, onActionSelected, anchorX, anchorY } = props;
  const { t } = useTranslation();

  const [flow, setFlow] = useState<'list' | 'rename'>('list');
  const [busy, setBusy] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);

  const actions = getActionsForNode(node);

  const handleRowClick = (action: CorrectionAction) => {
    if (action.kind === 'rename') {
      setFlow('rename');
      return;
    }
    // All other actions are dispatched UP to GraphScreen.
    onActionSelected(action);
  };

  const handleRenameSubmit = async (newTitle: string) => {
    setBusy(true);
    setExternalError(null);
    try {
      const result = await graphCommandService.rename(node.id, newTitle);
      if (result.success) {
        toast(t('graph.correction.toast.renamed', { title: newTitle }), 'success');
        onClose();
        return;
      }
      // ServiceResult error branch.
      const err = result.error;
      if (err?.code === 'VALIDATION_ERROR') {
        // Surface inline; do NOT close the card.
        setExternalError(err.message);
      } else {
        toast(err?.message ?? t('graph.correction.toast.dropInvalid'), 'error');
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const labelFor = (kind: CorrectionAction['kind']): string => {
    switch (kind) {
      case 'rename':
        return t('graph.correction.actions.rename');
      case 'move':
        return t('graph.correction.actions.move');
      case 'merge':
        return t('graph.correction.actions.merge');
      case 'detach':
        return t('graph.correction.actions.detach');
      case 'prune':
        return t('graph.correction.actions.prune');
      case 'delete':
        return t('graph.correction.actions.delete');
    }
  };

  // Estimated height for placement clamp (header ~44 + N rows of 52, or 56 paused).
  const estimatedHeight = isReorganizing
    ? CARD_MIN_HEIGHT + 44
    : flow === 'rename'
      ? 180
      : 44 + Math.max(actions.length, 1) * 52;
  const placement = clampPlacement(anchorX, anchorY, estimatedHeight);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: placement.left,
        top: placement.top,
        width: `${CARD_WIDTH}px`,
        padding: 0,
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-2)',
        overflow: 'hidden',
        animation: 'fade-in 0.2s ease',
        zIndex: 250,
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <p
          style={{
            flex: 1,
            margin: 0,
            fontWeight: 700,
            fontSize: '0.95rem',
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.title ?? node.content}
        </p>
        <button
          aria-label={t('graph.correction.actions.close')}
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--muted-foreground)',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      {isReorganizing ? (
        <PausedRow />
      ) : flow === 'rename' ? (
        <RenameForm
          initialValue={node.title ?? node.content ?? ''}
          onSubmit={handleRenameSubmit}
          onCancel={() => {
            setExternalError(null);
            setFlow('list');
          }}
          busy={busy}
          externalError={externalError}
        />
      ) : (
        <div>
          {actions.map((action) => (
            <ActionRow
              key={action.kind}
              action={action}
              label={labelFor(action.kind)}
              onClick={() => handleRowClick(action)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
