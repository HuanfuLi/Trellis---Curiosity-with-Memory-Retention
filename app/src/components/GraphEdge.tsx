export type RelationshipType = 'extends' | 'contradicts' | 'similar' | 'part_of';
export type ConnectionStrength = 'strong' | 'weak';

interface GraphEdgeProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  relationship: RelationshipType;
  strength?: ConnectionStrength;
}

const relationshipLabels: Record<RelationshipType, string> = {
  extends: 'extends',
  contradicts: 'contradicts',
  similar: 'similar',
  part_of: 'part of',
};

const relationshipColors: Record<RelationshipType, string> = {
  extends: '#558B2F',
  contradicts: '#E53935',
  similar: '#FF8A80',
  part_of: '#CE93D8',
};

export function GraphEdge({ x1, y1, x2, y2, relationship, strength = 'strong' }: GraphEdgeProps) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const strokeColor = relationshipColors[relationship];
  const strokeDasharray = strength === 'weak' ? '4 4' : undefined;

  return (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={strokeColor}
        strokeWidth={2}
        strokeDasharray={strokeDasharray}
        opacity={0.7}
      />
      <g transform={`translate(${midX}, ${midY})`}>
        <rect x={-30} y={-10} width={60} height={20} rx={10} fill="white" stroke={strokeColor} strokeWidth={1.5} />
        <text
          x={0} y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="10"
          fontWeight="500"
          fill={strokeColor}
        >
          {relationshipLabels[relationship]}
        </text>
      </g>
    </g>
  );
}
