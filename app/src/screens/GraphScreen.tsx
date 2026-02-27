import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { GraphNode } from '../components/GraphNode';
import { GraphEdge } from '../components/GraphEdge';
import type { NodeCategory, NodeSize } from '../components/GraphNode';
import type { RelationshipType } from '../components/GraphEdge';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useQuestions } from '../state/useQuestions';

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  size: NodeSize;
  category: NodeCategory;
  label: string;
}

interface LayoutEdge {
  from: string;
  to: string;
  relationship: RelationshipType;
}

const CATEGORIES: NodeCategory[] = ['mint', 'salmon', 'lilac', 'peach', 'sky'];

function buildLayout(questionIds: string[], relatedMap: Map<string, string[]>): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const cx = 200;
  const cy = 220;
  const radius = 130;
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];

  questionIds.forEach((id, i) => {
    const angle = (i / Math.max(questionIds.length, 1)) * 2 * Math.PI - Math.PI / 2;
    const x = questionIds.length === 1 ? cx : cx + radius * Math.cos(angle);
    const y = questionIds.length === 1 ? cy : cy + radius * Math.sin(angle);
    nodes.push({
      id,
      x,
      y,
      size: i === 0 ? 'concept' : 'question',
      category: CATEGORIES[i % CATEGORIES.length],
      label: '',
    });

    const related = relatedMap.get(id) ?? [];
    related.forEach((relId) => {
      if (questionIds.includes(relId) && !edges.find((e) => (e.from === id && e.to === relId) || (e.from === relId && e.to === id))) {
        edges.push({ from: id, to: relId, relationship: 'similar' });
      }
    });
  });

  return { nodes, edges };
}

const ALL_CATEGORIES = ['All', 'Physics', 'ML', 'Philosophy', 'General'];

export function GraphScreen() {
  const navigate = useNavigate();
  const { questions } = useQuestions();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState('All');

  const filteredQuestions = filterCat === 'All'
    ? questions
    : questions.filter((q) => q.categoryIds.some((c) => c.toLowerCase().includes(filterCat.toLowerCase())));

  const questionIds = filteredQuestions.map((q) => q.id);
  const relatedMap = new Map(questions.map((q) => [q.id, q.relatedQuestionIds]));
  const { nodes, edges } = buildLayout(questionIds.slice(0, 8), relatedMap);

  const getNodePos = (id: string) => {
    const n = nodes.find((n) => n.id === id);
    return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
  };

  const selectedQuestion = selectedNodeId ? questions.find((q) => q.id === selectedNodeId) : null;

  return (
    <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ color: 'var(--primary-40)', background: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ marginBottom: '2px' }}>Knowledge Graph</h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
            {questions.length} concepts connected
          </p>
        </div>
      </div>

      {/* Category Filters */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            style={{
              flexShrink: 0,
              padding: '6px 16px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: filterCat === cat ? 'var(--primary-40)' : 'var(--surface-variant)',
              color: filterCat === cat ? 'white' : 'var(--foreground)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Graph Canvas */}
      <div
        style={{
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-2)',
          height: '420px',
          overflow: 'hidden',
          marginBottom: '16px',
        }}
      >
        {filteredQuestions.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)', textAlign: 'center', padding: '24px' }}>
            <p>No questions yet. Ask something to build your knowledge graph!</p>
          </div>
        ) : (
          <>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}>
              {edges.map((edge, i) => {
                const from = getNodePos(edge.from);
                const to = getNodePos(edge.to);
                return (
                  <GraphEdge
                    key={i}
                    x1={from.x} y1={from.y}
                    x2={to.x} y2={to.y}
                    relationship={edge.relationship}
                    strength="weak"
                  />
                );
              })}
            </svg>

            {nodes.map((node) => {
              const q = questions.find((q) => q.id === node.id);
              return (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    transform: 'translate(-50%, -50%)',
                    zIndex: selectedNodeId === node.id ? 10 : 5,
                  }}
                >
                  <GraphNode
                    size={node.size}
                    category={node.category}
                    state={selectedNodeId === node.id ? 'selected' : 'default'}
                    label={q?.summary?.slice(0, 20) ?? ''}
                    onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
                  />
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Bottom Sheet for selected node */}
      {selectedQuestion && (
        <Card style={{ border: '2px solid var(--primary-90)', position: 'relative' }}>
          <button
            onClick={() => setSelectedNodeId(null)}
            style={{ position: 'absolute', top: '12px', right: '12px', color: 'var(--muted-foreground)', background: 'none', padding: 0 }}
          >
            <X size={20} />
          </button>
          <h4 style={{ marginBottom: '8px', paddingRight: '32px' }}>{selectedQuestion.content}</h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '12px' }}>
            {selectedQuestion.summary}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {selectedQuestion.keywords.slice(0, 3).map((kw) => (
              <Badge key={kw} color="green">{kw}</Badge>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/ask/${selectedQuestion.id}`)}
          >
            View full Q&A
          </Button>
        </Card>
      )}
    </div>
  );
}
