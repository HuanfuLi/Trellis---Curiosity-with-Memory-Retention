import { motion } from 'framer-motion';
import type { LeafState } from '../../services/trellis-state.service.ts';
import { LEAF_HIT_TARGET_PX } from './types.ts';

export const LEAF_STATE_COLOR: Record<LeafState, string> = {
  bud: '#8BC34A',      // bright lime green — newly planted
  green: '#4CAF50',    // solid green — healthy
  yellow: '#FFC107',   // amber — due soon
  falling: '#FF9800',  // orange — overdue
  fallen: '#E57373',   // muted red — long overdue
  blossom: '#BA68C8',  // rich lavender — mastered
  fruit: '#EF5350',    // vivid red — sustained mastery
};

export const LEAF_STATE_FILTER: Partial<Record<LeafState, string>> = {
  fallen: 'saturate(0.7)',
};

export interface TrellisLeafProps {
  anchorId: string;
  anchorName: string;
  x: number;
  y: number;
  state: LeafState;
  qaCount: number;
  onTap: (anchorId: string, centerClientX: number, centerClientY: number) => void;
  ambientSway?: boolean;
  animationDelay?: number;
}

// Leaf visual: rounded ellipse shape (~24x16) with subtle stem. Pure SVG, no filters on mobile.
export function TrellisLeaf(props: TrellisLeafProps) {
  const { anchorId, anchorName, x, y, state, qaCount, onTap, ambientSway, animationDelay = 0 } = props;
  const color = LEAF_STATE_COLOR[state];
  const filter = LEAF_STATE_FILTER[state];
  const half = LEAF_HIT_TARGET_PX / 2;

  const handleTap = (e: React.MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onTap(anchorId, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  // Blossom = 5-petal shape; Fruit = circle; Bud = small circle; others = leaf ellipse.
  let shape: React.ReactNode;
  if (state === 'blossom') {
    shape = (
      <g>
        {[0, 72, 144, 216, 288].map((angle) => (
          <ellipse key={angle} cx={0} cy={-10} rx={6} ry={10} fill={color} transform={`rotate(${angle})`} opacity={0.85} />
        ))}
        <circle cx={0} cy={0} r={4} fill="var(--primary-40)" />
      </g>
    );
  } else if (state === 'fruit') {
    shape = <circle cx={0} cy={0} r={10} fill={color} />;
  } else if (state === 'bud') {
    shape = <circle cx={0} cy={0} r={7} fill={color} />;
  } else {
    // leaf ellipse with stem
    shape = (
      <g>
        <ellipse cx={0} cy={0} rx={14} ry={9} fill={color} style={filter ? { filter } : undefined} />
        <line x1={0} y1={0} x2={-6} y2={8} stroke="#6B8E5A" strokeWidth={1.2} opacity={0.5} />
      </g>
    );
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${anchorName} — ${state} health, ${qaCount} Q&A${qaCount === 1 ? '' : 's'}`}
      transform={`translate(${x}, ${y})`}
      onClick={handleTap}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTap(e as unknown as React.MouseEvent<SVGGElement>); }}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      {/* 44x44 invisible hit target centered on leaf (WCAG 2.5.5) */}
      <rect x={-half} y={-half} width={LEAF_HIT_TARGET_PX} height={LEAF_HIT_TARGET_PX} fill="transparent" style={{ pointerEvents: 'all' }} />
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, rotate: ambientSway ? [0, 2, -2, 0] : 0 }}
        transition={ambientSway
          ? { scale: { type: 'spring', stiffness: 260, damping: 18, delay: animationDelay }, opacity: { duration: 0.3, delay: animationDelay }, rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }
          : { type: 'spring', stiffness: 260, damping: 18, delay: animationDelay }}
        style={{ transformOrigin: '0 0', transformBox: 'fill-box' }}
      >
        {shape}
      </motion.g>
    </g>
  );
}
