import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, RefreshCw, Sparkles, Loader2, X,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { usePlanner } from '../state/usePlanner';
import { usePlannerAutoGen } from '../state/usePlannerAutoGen';
import { useDailyRefresh } from '../state/useDailyRefresh';
import { useQuestions } from '../state/useQuestions';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { TrellisHero } from '../components/trellis/TrellisHero';
import { PortalCard, buildPortalData } from '../components/PortalCard';
import { conceptFeedService } from '../services/concept-feed.service';
import { plannerService } from '../services/planner.service';
import type { PlannerChunk } from '../types';

// ── Signal dot colors (mastery / weak-point indicators) ───────────────────

const SIGNAL_DOT_COLOR: Record<string, string> = {
  confusion: '#E53935',  // red   — struggling / weak area
  revisit:   '#F57C00',  // amber — overdue / stale
  curiosity: '#0288D1',  // blue  — healthy curiosity
  connection: '#00897B', // teal  — building connections / strong
};
const DEFAULT_DOT_COLOR = '#9E9E9E'; // grey — no signal

function EmptySectionHint({ text }: { text: string }) {
  return (
    <Card style={{ padding: '14px 16px', marginBottom: '10px', backgroundColor: 'var(--surface-variant)' }}>
      <p style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>{text}</p>
    </Card>
  );
}

// ── Chunk card ─────────────────────────────────────────────────────────────

function ChunkCard({
  chunk,
  onDelete,
  onRegenerate,
}: {
  chunk: PlannerChunk;
  onDelete: (id: string) => void;
  onRegenerate?: (chunkId: string) => Promise<void>;
}) {
  const dotColor = SIGNAL_DOT_COLOR[chunk.sourceSignal ?? ''] ?? DEFAULT_DOT_COLOR;
  const navigate = useNavigate();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const needsPost = (chunk.type === 'compare') && !chunk.linkedPostId;

  const handleCardClick = () => {
    if (chunk.type === 'review') {
      navigate('/review');
    } else if (chunk.type === 'compare' && chunk.linkedPostId) {
      navigate(`/posts/${chunk.linkedPostId}`);
    } else if (chunk.type === 'discover') {
      navigate(`/posts/discover-${chunk.id}`, {
        state: {
          discoverMeta: {
            concept: chunk.linkedConceptIds[0] ?? chunk.goal,
            title: chunk.goal,
          },
        },
      });
    }
  };

  const handleRegenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRegenerate || isRegenerating) return;
    setIsRegenerating(true);
    try {
      await onRegenerate(chunk.id);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '11px 0',
        borderBottom: '1px solid var(--border)',
        cursor: needsPost ? 'default' : 'pointer',
      }}
    >
      {/* Signal dot */}
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        backgroundColor: dotColor, flexShrink: 0,
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.4 }}>
          {chunk.goal}
        </p>
        {chunk.description && (
          <p style={{
            fontSize: '0.78rem', color: 'var(--muted-foreground)',
            marginTop: '1px', lineHeight: 1.35,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>
            {chunk.description}
          </p>
        )}
        {needsPost && (
          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>No post found</span>
            {onRegenerate && (
              <button
                onClick={(e) => { void handleRegenerate(e); }}
                disabled={isRegenerating}
                className="active-squish"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  padding: '2px 7px', borderRadius: '6px', fontSize: '0.7rem',
                  fontWeight: 600, backgroundColor: 'var(--surface-variant)',
                  color: 'var(--muted-foreground)', border: '1px solid var(--border)',
                }}
              >
                <RefreshCw size={10} />
                {isRegenerating ? 'Generating…' : 'Regenerate'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {!needsPost && (
          <button
            onClick={(e) => { e.stopPropagation(); handleCardClick(); onDelete(chunk.id); }}
            title="Go"
            className="active-squish"
            style={{
              width: '30px', height: '30px', borderRadius: '8px',
              backgroundColor: 'var(--primary-40)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Play size={12} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(chunk.id); }}
          title="Dismiss"
          className="active-squish"
          style={{
            width: '30px', height: '30px', borderRadius: '8px',
            backgroundColor: 'var(--surface-variant)', color: 'var(--muted-foreground)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export function PlannerScreen() {
  const navigate = useNavigate();
  const {
    suggestedChunks,
    isLoading,
    deleteChunk,
  } = usePlanner();
  const { moves: autoMoves, isRefreshing, accept: acceptMove, dismiss: dismissMove, skipAll, refresh: refreshMoves } = usePlannerAutoGen();
  useDailyRefresh(); // Mount to activate PODCAST_GENERATION_COMPLETED → refresh subscription
  const { questions } = useQuestions();
  const [showAutoMoves, setShowAutoMoves] = useState(true);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const totalSuggestions = autoMoves.length + suggestedChunks.length;
  const TOP_N = 5;
  const visibleAutoMoves = showAllSuggestions ? autoMoves : autoMoves.slice(0, TOP_N);
  const remainingAfterSlice = totalSuggestions - visibleAutoMoves.length - suggestedChunks.length;

  // refresh() is now auto-called by usePlanner on mount + PLANNER_UPDATED events

  const handleSkipAll = () => {
    skipAll();
    suggestedChunks.forEach(chunk => deleteChunk(chunk.id));
    toast('Suggestions cleared');
  };

  const handleRegenerateChunk = async (chunkId: string) => {
    const chunk = suggestedChunks.find((c) => c.id === chunkId);
    if (!chunk) return;
    await conceptFeedService.generateMorePosts(questions);
    const postId = chunk.linkedConceptIds.length > 0
      ? (conceptFeedService.findClosestPost(chunk.linkedConceptIds, chunk.type === 'compare') ?? null)?.id
      : null;
    if (postId) {
      plannerService.updateChunkLinkedPost(chunkId, postId);
    } else {
      toast('No post found after regeneration', 'info');
    }
  };



  return (
    <div style={{ padding: `${HEADER_HEIGHT + 8}px 16px 96px`, maxWidth: '448px', margin: '0 auto' }}>
      <Header title="Planner" />

      <TrellisHero />

      {/* ── Suggested Moves (unified) ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Suggested Moves</h2>
          {totalSuggestions > 0 && <Badge color="gray">{totalSuggestions}</Badge>}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => void refreshMoves()}
            disabled={isRefreshing}
            title="Refresh suggestions"
            className="active-squish"
            style={{
              width: '28px', height: '28px', borderRadius: '50%',
              backgroundColor: 'var(--surface-variant)',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: isRefreshing ? 0.5 : 1,
            }}
          >
            {isRefreshing
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <RefreshCw size={13} />}
          </button>
          <button
            onClick={() => setShowAutoMoves(!showAutoMoves)}
            style={{
              background: 'none', display: 'flex', alignItems: 'center',
              gap: '3px', color: 'var(--muted-foreground)', fontSize: '0.78rem',
              padding: '4px',
            }}
          >
            {showAutoMoves ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {showAutoMoves && (
        totalSuggestions === 0 ? (
          <EmptySectionHint text="No suggestions right now — tap refresh to check for new moves." />
        ) : (
          <>
            {visibleAutoMoves.map((move) => {
              const partial = buildPortalData(move.conceptId, move.title, move.reason);
              const portalData = { ...partial, primaryAction: move.moveType, move };
              return (
                <PortalCard
                  key={move.id}
                  data={portalData}
                  onAccept={acceptMove}
                  onDismiss={dismissMove}
                  onNavigate={() => {
                    // Navigation handled internally by PortalCard
                  }}
                />
              );
            })}
            {suggestedChunks.map((chunk) => (
              <ChunkCard key={chunk.id} chunk={chunk} onDelete={deleteChunk} onRegenerate={handleRegenerateChunk} />
            ))}
            {!showAllSuggestions && remainingAfterSlice > 0 && (
              <button
                onClick={() => setShowAllSuggestions(true)}
                style={{
                  width: '100%', padding: '10px 16px', borderRadius: '12px',
                  backgroundColor: 'var(--surface-variant)', color: 'var(--primary-40)',
                  border: '1px solid var(--border)', fontSize: '0.82rem', fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '4px', marginBottom: '8px',
                }}
              >
                <ChevronDown size={14} />
                Show all {totalSuggestions} suggestions
              </button>
            )}
            {showAllSuggestions && totalSuggestions > TOP_N && (
              <button
                onClick={() => setShowAllSuggestions(false)}
                style={{
                  width: '100%', padding: '10px 16px', borderRadius: '12px',
                  backgroundColor: 'var(--surface-variant)', color: 'var(--muted-foreground)',
                  border: '1px solid var(--border)', fontSize: '0.82rem', fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '4px', marginBottom: '8px',
                }}
              >
                <ChevronUp size={14} />
                Show less
              </button>
            )}
            {autoMoves.length > 0 && (
              <button
                onClick={handleSkipAll}
                style={{
                  background: 'none', padding: '6px 0 4px', display: 'flex',
                  alignItems: 'center', gap: '4px', color: 'var(--muted-foreground)',
                  fontSize: '0.78rem', marginBottom: '4px',
                }}
              >
                Skip all suggestions
              </button>
            )}
          </>
        )
      )}

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '32px 0', color: 'var(--muted-foreground)' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Processing...
        </div>
      )}
    </div>
  );
}
