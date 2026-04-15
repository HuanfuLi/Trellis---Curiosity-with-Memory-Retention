import { TRELLIS_VIEWBOX_W, TRELLIS_VIEWBOX_H } from '../../../services/trellis-layout.service.ts';

// Pure-SVG trellis background: soft garden sky gradient with organic diamond-lattice woodwork.
// All filters static (no animated feTurbulence / feDisplacementMap per Pitfall 3).
export function TrellisBackgroundC() {
  const W = TRELLIS_VIEWBOX_W;
  const H = TRELLIS_VIEWBOX_H;
  const groundY = H * 0.88;

  // Diamond lattice: diagonal cross-hatching like a real garden trellis
  const spacing = 36;
  const topY = H * 0.08;
  const diagonals: React.ReactNode[] = [];
  // Forward diagonals (\)
  for (let offset = -H; offset < W + H; offset += spacing) {
    diagonals.push(
      <line key={`f${offset}`} x1={offset} y1={topY} x2={offset + groundY - topY} y2={groundY}
        stroke="#C4A882" strokeWidth={1.8} opacity={0.32} strokeLinecap="round" />,
    );
  }
  // Back diagonals (/)
  for (let offset = -H; offset < W + H; offset += spacing) {
    diagonals.push(
      <line key={`b${offset}`} x1={offset + groundY - topY} y1={topY} x2={offset} y2={groundY}
        stroke="#C4A882" strokeWidth={1.8} opacity={0.28} strokeLinecap="round" />,
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, zIndex: 0, display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="trellis-c-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8F5E9" stopOpacity="0.7" />
          <stop offset="50%" stopColor="var(--surface)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--surface-variant)" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="trellis-c-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A5D6A7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#81C784" stopOpacity="0.2" />
        </linearGradient>
        <clipPath id="trellis-c-clip">
          <rect x={0} y={topY} width={W} height={groundY - topY} />
        </clipPath>
      </defs>
      {/* Sky */}
      <rect x={0} y={0} width={W} height={H} fill="url(#trellis-c-sky)" />
      {/* Ground strip */}
      <rect x={0} y={groundY} width={W} height={H - groundY} fill="url(#trellis-c-ground)" />
      {/* Diamond lattice woodwork — clipped to garden area */}
      <g clipPath="url(#trellis-c-clip)" opacity={0.65}>
        {diagonals}
      </g>
      {/* Top rail */}
      <line x1={0} y1={topY} x2={W} y2={topY} stroke="#B89B71" strokeWidth={2.5} opacity={0.4} />
      {/* Bottom rail */}
      <line x1={0} y1={groundY} x2={W} y2={groundY} stroke="#B89B71" strokeWidth={2.5} opacity={0.35} />
    </svg>
  );
}
