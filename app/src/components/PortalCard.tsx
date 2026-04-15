/**
 * PortalCard component
 *
 * Displays a topic portal row with:
 *  - Signal dot (weak area / score-based urgency)
 *  - Title and description
 *  - Icon-only CTA button using moveNavigator
 *  - Dismiss (X) action
 *
 * Phase 20: Orchestration Strategy & Diagnostic Dialogue
 */

import { BookOpen, HelpCircle, Headphones, Layers, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PlannedMove, PlannedMoveType } from '../types';
import { navigateToMove } from '../lib/moveNavigator';

// ── Move type CTA config (icon-only) ────────────────────────────────────────

const MOVE_TYPE_CONFIG: Record<PlannedMoveType, {
  ctaIcon: React.ReactNode;
  label: string;
}> = {
  review: { ctaIcon: <Layers size={14} />, label: 'Review' },
  read: { ctaIcon: <BookOpen size={14} />, label: 'Read' },
  compare: { ctaIcon: <HelpCircle size={14} />, label: 'Compare' },
  podcast: { ctaIcon: <Headphones size={14} />, label: 'Podcast' },
};

/** Returns a dot color reflecting mastery signal for a planned move. */
function moveDotColor(move: PlannedMove): string {
  if (move.isWeakArea)           return '#E53935'; // red   — confirmed weak area
  if (move.relevanceScore >= 50) return '#F57C00'; // amber — moderate urgency
  if (move.relevanceScore >= 30) return '#00897B'; // teal  — healthy curiosity
  return '#0288D1';                                // blue  — open exploration
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PortalCardData {
  conceptId: string;
  title: string;
  description: string;
  primaryAction: PlannedMoveType;
  move: PlannedMove;
}

interface PortalCardProps {
  data: PortalCardData;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigate: (move: PlannedMove) => void;
}

// ── buildPortalData helper ───────────────────────────────────────────────────

export function buildPortalData(
  conceptId: string,
  title: string,
  reason: string,
): Omit<PortalCardData, 'move' | 'primaryAction'> {
  return {
    conceptId,
    title,
    description: reason,
  };
}

// ── PortalCard component ─────────────────────────────────────────────────────

export function PortalCard({ data, onAccept, onDismiss, onNavigate }: PortalCardProps) {
  const navigate = useNavigate();
  const config = MOVE_TYPE_CONFIG[data.primaryAction] ?? MOVE_TYPE_CONFIG.review;

  const handlePrimaryCTA = () => {
    void navigateToMove(data.move, navigate, {
      fromScreen: 'planner',
      replace: false,
    }).then((success) => {
      onNavigate(data.move);
      if (!success) {
        // Fallback: accept the move into planner
        onAccept(data.move.id);
      }
    });
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '11px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Signal dot */}
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        backgroundColor: moveDotColor(data.move), flexShrink: 0,
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.4 }}>
          {data.title}
        </p>
        {data.description && (
          <p style={{
            fontSize: '0.78rem', color: 'var(--muted-foreground)',
            marginTop: '1px', lineHeight: 1.35,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>
            {data.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        <button
          onClick={handlePrimaryCTA}
          title={config.label}
          className="active-squish"
          style={{
            width: '30px', height: '30px', borderRadius: '8px',
            backgroundColor: 'var(--primary-40)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {config.ctaIcon}
        </button>
        <button
          onClick={() => onDismiss(data.move.id)}
          title="Dismiss"
          className="active-squish"
          style={{
            width: '30px', height: '30px', borderRadius: '8px',
            backgroundColor: 'var(--surface-variant)',
            color: 'var(--muted-foreground)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
