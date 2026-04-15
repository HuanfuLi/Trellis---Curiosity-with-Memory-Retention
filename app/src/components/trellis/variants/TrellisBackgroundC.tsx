import { TRELLIS_VIEWBOX_W, TRELLIS_VIEWBOX_H } from '../../../services/trellis-layout.service.ts';

// Pure-SVG trellis lattice. Renders warm gradient sky + wooden lattice.
// All filters static (no animated feTurbulence / feDisplacementMap per Pitfall 3).
export function TrellisBackgroundC() {
  const W = TRELLIS_VIEWBOX_W;
  const H = TRELLIS_VIEWBOX_H;
  const latticeSpacing = 40;
  const groundY = H * 0.88;

  const verticalLines = [];
  for (let x = latticeSpacing; x < W; x += latticeSpacing) {
    verticalLines.push(<line key={`v${x}`} x1={x} y1={H * 0.15} x2={x} y2={groundY} stroke="var(--node-salmon)" strokeWidth={1.5} opacity={0.35} />);
  }
  const horizontalLines = [];
  for (let y = H * 0.2; y < groundY; y += latticeSpacing) {
    horizontalLines.push(<line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke="var(--node-salmon)" strokeWidth={1.5} opacity={0.25} />);
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
          <stop offset="0%" stopColor="var(--node-peach)" stopOpacity="0.6" />
          <stop offset="60%" stopColor="var(--surface)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--surface-variant)" stopOpacity="1" />
        </linearGradient>
        <filter id="trellis-c-blur"><feGaussianBlur stdDeviation="2" /></filter>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="url(#trellis-c-sky)" />
      {/* Ground */}
      <rect x={0} y={groundY} width={W} height={H - groundY} fill="var(--node-mint)" opacity={0.25} />
      {/* Lattice — static blur only on background layer per Pitfall 3 */}
      <g filter="url(#trellis-c-blur)" opacity={0.7}>
        {verticalLines}
        {horizontalLines}
      </g>
    </svg>
  );
}
