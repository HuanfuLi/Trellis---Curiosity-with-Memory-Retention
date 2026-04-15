// Per CONTEXT D-07/D-08/D-10: 3-column status panel showing fruit/dying/dead counts
// derived from TrellisAnchorNode.leafState. Fruit column glows when count > 0 (D-05).
// Tapping a column opens a bottom sheet listing affected nodes (D-09). Fruit sheet
// exposes Harvest All which clears blossom dates, accumulates credits, emits
// HARVEST_COMPLETED, flies fruit particles to the header counter, and fires confetti
// (D-02, D-03, D-06). Inline styles only — project convention.

import { useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { Cherry, Leaf, XCircle } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Confetti } from '../Confetti';
import { clearBlossomDate } from '../../services/trellis-blossom-dates.service';
import { trellisCreditsService } from '../../services/trellis-credits.service';
import { eventBus } from '../../lib/event-bus';
import type { TrellisAnchorNode } from '../../services/trellis-state.service';

interface TrellisStatusPanelProps {
  nodes: TrellisAnchorNode[];
  onCreditsChange: (total: number) => void;
  counterRef: RefObject<HTMLSpanElement | null>;
}

type SheetKey = 'fruit' | 'dying' | 'dead' | null;

interface FlyParticle {
  id: number;
  dx: number;
  dy: number;
}

const FRUIT_COLOR = '#E8A838';
const DYING_COLOR = '#D4A017';
const DEAD_COLOR = '#9E9E9E';

function anchorLabel(node: TrellisAnchorNode): string {
  const q = node.anchor;
  return q.title ?? q.content ?? 'anchor';
}

function NodeListItem({
  node,
  icon,
  color,
}: {
  node: TrellisAnchorNode;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--surface-variant)',
        border: '1px solid var(--border)',
        marginBottom: '8px',
      }}
    >
      <span style={{ color, display: 'flex', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: '0.88rem',
            fontWeight: 500,
            color: 'var(--foreground)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {anchorLabel(node)}
        </p>
        <p
          style={{
            margin: '2px 0 0',
            fontSize: '0.72rem',
            color: 'var(--muted-foreground)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {node.branchLabel}
        </p>
      </div>
    </div>
  );
}

export function TrellisStatusPanel({ nodes, onCreditsChange, counterRef }: TrellisStatusPanelProps) {
  const [activeSheet, setActiveSheet] = useState<SheetKey>(null);
  const [flyParticles, setFlyParticles] = useState<FlyParticle[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fruitNodes = nodes.filter((n) => n.leafState === 'fruit');
  const dyingNodes = nodes.filter((n) => n.leafState === 'yellow' || n.leafState === 'falling');
  const deadNodes = nodes.filter((n) => n.leafState === 'fallen');

  const handleHarvest = () => {
    const count = fruitNodes.length;
    if (count === 0) return;

    // 1. Clear blossom dates so leaf state recomputes away from 'fruit'
    fruitNodes.forEach((n) => clearBlossomDate(n.anchor.id));

    // 2. Persist credits
    const newTotal = trellisCreditsService.add(count);
    onCreditsChange(newTotal);

    // 3. Notify subscribers (useTrellisData will recompute)
    eventBus.emit({ type: 'HARVEST_COMPLETED', payload: { count } });

    // 4. Close sheet
    setActiveSheet(null);

    // 5. Fly-to-counter animation — compute vector from panel center to counter
    const panelEl = panelRef.current;
    const counterEl = counterRef.current;
    if (panelEl && counterEl) {
      const panelRect = panelEl.getBoundingClientRect();
      const panelCenterX = panelRect.left + panelRect.width / 2;
      const panelCenterY = panelRect.top + panelRect.height / 2;
      const counterRect = counterEl.getBoundingClientRect();
      const counterCenterX = counterRect.left + counterRect.width / 2;
      const counterCenterY = counterRect.top + counterRect.height / 2;
      const dx = counterCenterX - panelCenterX;
      const dy = counterCenterY - panelCenterY;
      const particleCount = Math.min(count, 8);
      const particles: FlyParticle[] = Array.from({ length: particleCount }, (_, i) => ({
        id: Date.now() + i,
        dx,
        dy,
      }));
      setFlyParticles(particles);
      // Clear particles after animation
      window.setTimeout(() => setFlyParticles([]), 1100);
    }

    // 6. Confetti after fly-to-counter completes
    window.setTimeout(() => setShowConfetti(true), 1200);
    window.setTimeout(() => setShowConfetti(false), 1200 + 3500);
  };

  const columnBase: CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--surface-variant)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
  };

  const fruitGlow: CSSProperties =
    fruitNodes.length > 0
      ? {
          boxShadow: '0 0 12px rgba(232,168,56,0.35)',
          animation: 'status-glow 3s ease-in-out infinite',
        }
      : {};

  const countTextStyle: CSSProperties = {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--foreground)',
    lineHeight: 1,
  };

  const labelTextStyle: CSSProperties = {
    fontSize: '0.7rem',
    color: 'var(--muted-foreground)',
    marginLeft: '2px',
  };

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes status-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(232,168,56,0.25); }
          50%      { box-shadow: 0 0 16px rgba(232,168,56,0.45); }
        }
        @keyframes fruit-fly {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translate(var(--fly-dx), var(--fly-dy)) scale(0.4); opacity: 0; }
        }
      `}</style>

      <div
        ref={panelRef}
        style={{
          display: 'flex',
          gap: '12px',
          padding: '12px 16px',
        }}
      >
        {/* Fruits */}
        <div
          onClick={() => setActiveSheet('fruit')}
          style={{ ...columnBase, ...fruitGlow }}
        >
          <Cherry size={18} color={FRUIT_COLOR} />
          <span style={countTextStyle}>{fruitNodes.length}</span>
          <span style={labelTextStyle}>Fruits</span>
        </div>

        {/* Dying */}
        <div onClick={() => setActiveSheet('dying')} style={columnBase}>
          <Leaf size={18} color={DYING_COLOR} />
          <span style={countTextStyle}>{dyingNodes.length}</span>
          <span style={labelTextStyle}>Dying</span>
        </div>

        {/* Dead */}
        <div onClick={() => setActiveSheet('dead')} style={columnBase}>
          <XCircle size={18} color={DEAD_COLOR} />
          <span style={countTextStyle}>{deadNodes.length}</span>
          <span style={labelTextStyle}>Dead</span>
        </div>
      </div>

      {/* Fruit bottom sheet */}
      <BottomSheet
        open={activeSheet === 'fruit'}
        onClose={() => setActiveSheet(null)}
        title="Ripe Fruits"
      >
        {fruitNodes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', margin: 0 }}>
            Nothing ripe right now. Keep reviewing your strongest anchors to grow fruit.
          </p>
        ) : (
          <>
            <button
              onClick={handleHarvest}
              className="active-squish"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: FRUIT_COLOR,
                color: 'white',
                border: 'none',
                fontSize: '0.92rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '16px',
              }}
            >
              <Cherry size={16} />
              Harvest All ({fruitNodes.length})
            </button>
            {fruitNodes.map((n) => (
              <NodeListItem
                key={n.anchor.id}
                node={n}
                icon={<Cherry size={16} />}
                color={FRUIT_COLOR}
              />
            ))}
          </>
        )}
      </BottomSheet>

      {/* Dying bottom sheet */}
      <BottomSheet
        open={activeSheet === 'dying'}
        onClose={() => setActiveSheet(null)}
        title="Dying Anchors"
      >
        {dyingNodes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', margin: 0 }}>
            No anchors are dying — your trellis is healthy.
          </p>
        ) : (
          dyingNodes.map((n) => (
            <NodeListItem
              key={n.anchor.id}
              node={n}
              icon={<Leaf size={16} />}
              color={DYING_COLOR}
            />
          ))
        )}
      </BottomSheet>

      {/* Dead bottom sheet */}
      <BottomSheet
        open={activeSheet === 'dead'}
        onClose={() => setActiveSheet(null)}
        title="Dead Anchors"
      >
        {deadNodes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', margin: 0 }}>
            Nothing has died yet. Keep reviewing to keep your trellis alive.
          </p>
        ) : (
          deadNodes.map((n) => (
            <NodeListItem
              key={n.anchor.id}
              node={n}
              icon={<XCircle size={16} />}
              color={DEAD_COLOR}
            />
          ))
        )}
      </BottomSheet>

      {/* Fly-to-counter particles */}
      {flyParticles.length > 0 && panelRef.current && (
        <div
          style={{
            position: 'fixed',
            top: panelRef.current.getBoundingClientRect().top + panelRef.current.getBoundingClientRect().height / 2,
            left: panelRef.current.getBoundingClientRect().left + panelRef.current.getBoundingClientRect().width / 2,
            pointerEvents: 'none',
            zIndex: 8000,
          }}
        >
          {flyParticles.map((p, i) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: FRUIT_COLOR,
                transform: 'translate(-50%, -50%)',
                animation: 'fruit-fly 1s ease-in forwards',
                animationDelay: `${i * 0.06}s`,
                ['--fly-dx' as string]: `${p.dx}px`,
                ['--fly-dy' as string]: `${p.dy}px`,
              } as CSSProperties}
            />
          ))}
        </div>
      )}

      <Confetti active={showConfetti} />
    </div>
  );
}
