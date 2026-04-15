import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, RefreshCw, Sparkles,
  Mic, Loader2, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { usePlanner } from '../state/usePlanner';
import { usePlannerAutoGen } from '../state/usePlannerAutoGen';
import { useDailyRefresh } from '../state/useDailyRefresh';
import { useQuestions } from '../state/useQuestions';
import { toast } from '../lib/toast';
import { transcribeAudio } from '../providers/stt';
import { startVoiceRecording, stopVoiceRecording } from '../lib/voice-recorder';
import { settingsService } from '../services/settings.service';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { TrellisHero } from '../components/trellis/TrellisHero';
import { PortalCard, buildPortalData } from '../components/PortalCard';
import { DiagnosticChat } from '../components/DiagnosticChat';
import { diagnosticDialogueService } from '../services/diagnostic-dialogue.service';
import type { DiagnosticSession } from '../services/diagnostic-dialogue.service';
import { Capacitor } from '@capacitor/core';
import { conceptFeedService } from '../services/concept-feed.service';
import { plannerService } from '../services/planner.service';
import type { PlannerChunk, LearningCheckIn } from '../types';

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

// ── Check-in outcome display ───────────────────────────────────────────────

function CheckInOutcome({ checkIn }: { checkIn: LearningCheckIn }) {
  const { signals, generatedChunkIds } = checkIn;
  const hasOutcome = generatedChunkIds.length > 0;

  return (
    <div style={{
      padding: '12px 14px', borderRadius: '14px',
      backgroundColor: 'var(--surface-variant)', border: '1px solid var(--border)',
      marginBottom: '8px',
    }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.5, marginBottom: hasOutcome ? '8px' : 0 }}>
        {checkIn.content}
      </p>
      {hasOutcome && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {generatedChunkIds.length > 0 && (
            <span style={{
              fontSize: '0.72rem', padding: '3px 8px', borderRadius: '999px',
              backgroundColor: 'color-mix(in srgb, var(--node-mint) 25%, transparent)',
              color: 'var(--foreground)',
            }}>
              {generatedChunkIds.length} suggestion{generatedChunkIds.length > 1 ? 's' : ''} added
            </span>
          )}
          {signals.confidence.length > 0 && (
            <span style={{
              fontSize: '0.72rem', padding: '3px 8px', borderRadius: '999px',
              backgroundColor: 'color-mix(in srgb, var(--node-mint) 25%, transparent)',
              color: 'var(--foreground)',
            }}>
              Confidence noted
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export function PlannerScreen() {
  const navigate = useNavigate();
  const {
    suggestedChunks, recentCheckIns,
    isLoading,
    deleteChunk, submitCheckIn,
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

  const [checkInInput, setCheckInInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [diagnosticSession, setDiagnosticSession] = useState<DiagnosticSession | null>(null);
  const [lastCheckInContent, setLastCheckInContent] = useState<string | null>(null);
  const [isDialogueProcessing, setIsDialogueProcessing] = useState(false);
  const [showCheckInHistory, setShowCheckInHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Optional: speech-to-text support
  const [isRecording, setIsRecording] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  // Web-only fallback refs (not used on native)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // refresh() is now auto-called by usePlanner on mount + PLANNER_UPDATED events

  // Restore active diagnostic session on mount
  useEffect(() => {
    const active = diagnosticDialogueService.getActiveSession();
    if (active && active.status === 'active') setDiagnosticSession(active);
  }, []);

  const handleSubmitCheckIn = async () => {
    const content = checkInInput.trim();
    if (!content || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Single-shot check-in by default (D-02 revised: optional multi-turn)
      const result = await submitCheckIn(content);
      setCheckInInput('');
      const msg = result.generatedChunkIds.length > 0
        ? `Check-in processed: ${result.generatedChunkIds.length} suggestion(s) added`
        : 'Check-in saved';
      toast(msg, 'success');
      // Store the content for optional "Tell me more" follow-up
      setLastCheckInContent(content);
    } catch {
      toast('Failed to process check-in', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTellMeMore = async () => {
    if (!lastCheckInContent) return;
    setIsSubmitting(true);
    try {
      const session = await diagnosticDialogueService.startSession(lastCheckInContent);
      await diagnosticDialogueService.generateFollowUp(session);
      setDiagnosticSession({ ...session });
      setLastCheckInContent(null);
    } catch {
      toast('Failed to start dialogue', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogueReply = async (text: string) => {
    if (!diagnosticSession) return;
    setIsDialogueProcessing(true);
    try {
      const updated = await diagnosticDialogueService.processReply(diagnosticSession, text);
      if (updated.status === 'completed') {
        await handleDialogueDone();
      } else {
        await diagnosticDialogueService.generateFollowUp(updated);
        // generateFollowUp already pushes the assistant turn and persists
        setDiagnosticSession({ ...updated });
      }
    } finally {
      setIsDialogueProcessing(false);
    }
  };

  const handleDialogueDone = async () => {
    if (!diagnosticSession) return;
    const finalized = diagnosticDialogueService.finalize(diagnosticSession);
    const allText = finalized.turns.filter((t) => t.role === 'user').map((t) => t.content).join('\n');
    try {
      await submitCheckIn(allText);
      toast('Check-in complete', 'success');
    } catch {
      toast('Failed to finalize check-in', 'error');
    }
    setDiagnosticSession(null);
  };

  const handleStartRecording = async () => {
    try {
      if (isNative) {
        // Native: use Capacitor voice recorder (produces correct MIME type)
        await startVoiceRecording();
      } else {
        // Web: use MediaRecorder API
        if (!navigator.mediaDevices) return;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          if (audioChunksRef.current.length > 0) {
            try {
              const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
              const text = await transcribeAudio(blob, settingsService.getSync().tts);
              setCheckInInput((prev) => (prev ? prev + ' ' : '') + text);
            } catch {
              toast('Transcription failed', 'error');
            }
          }
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      }
      setIsRecording(true);
    } catch {
      toast('Microphone access denied', 'error');
    }
  };

  const handleStopRecording = async () => {
    try {
      if (isNative) {
        const blob = await stopVoiceRecording();
        const text = await transcribeAudio(blob, settingsService.getSync().tts);
        setCheckInInput((prev) => (prev ? prev + ' ' : '') + text);
      } else {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      }
    } catch {
      toast('Transcription failed', 'error');
    }
    setIsRecording(false);
  };

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

      {/* ── Learning Check-In ─────────────────────────────────────────── */}
      <Card style={{ padding: '16px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Sparkles size={16} color="var(--primary-40)" />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--foreground)' }}>Learning Check-In</span>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: '10px' }}>
          What felt clear, fuzzy, or interesting? The system will turn your thoughts into actionable learning suggestions.
        </p>
        {diagnosticSession ? (
          <DiagnosticChat
            session={diagnosticSession}
            onReply={(text) => { void handleDialogueReply(text); }}
            onDone={() => { void handleDialogueDone(); }}
            isProcessing={isDialogueProcessing}
          />
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={checkInInput}
              onChange={(e) => setCheckInInput(e.target.value)}
              rows={3}
              placeholder="e.g. I finally get how closures work, but I'm still fuzzy on how they interact with async/await..."
              disabled={isSubmitting}
              style={{
                width: '100%', resize: 'vertical', minHeight: '72px',
                borderRadius: '12px', border: '1.5px solid var(--border)',
                backgroundColor: 'var(--surface-variant)', color: 'var(--foreground)',
                padding: '10px 12px', fontSize: '0.88rem', lineHeight: 1.45,
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={() => isRecording ? handleStopRecording() : void handleStartRecording()}
                title={isRecording ? 'Stop recording' : 'Voice input'}
                className="active-squish"
                style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  backgroundColor: isRecording ? 'var(--danger)' : 'var(--surface-variant)',
                  color: isRecording ? 'white' : 'var(--muted-foreground)',
                  border: isRecording ? 'none' : '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {isRecording ? <X size={16} /> : <Mic size={16} />}
              </button>
              <button
                onClick={() => void handleSubmitCheckIn()}
                disabled={!checkInInput.trim() || isSubmitting}
                className="active-squish"
                style={{
                  flex: 1, padding: '9px 16px', borderRadius: '12px',
                  border: 'none', backgroundColor: 'var(--primary-40)', color: 'white',
                  fontSize: '0.88rem', fontWeight: 500,
                  cursor: !checkInInput.trim() || isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: !checkInInput.trim() || isSubmitting ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                {isSubmitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {isSubmitting ? 'Processing...' : 'Check In'}
              </button>
            </div>
            {/* Optional "Tell me more" button after successful check-in */}
            {lastCheckInContent && !isSubmitting && (
              <button
                onClick={() => void handleTellMeMore()}
                className="active-squish"
                style={{
                  width: '100%', padding: '9px 16px', marginTop: '8px',
                  borderRadius: '12px', backgroundColor: 'var(--surface-variant)',
                  color: 'var(--primary-40)', border: '1px solid var(--border)',
                  fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                }}
              >
                Tell me more...
              </button>
            )}
          </>
        )}
      </Card>

      {/* Recent check-in history */}
      {recentCheckIns.length > 0 && (
        <button
          onClick={() => setShowCheckInHistory(!showCheckInHistory)}
          style={{
            background: 'none', padding: '6px 0', display: 'flex', alignItems: 'center',
            gap: '4px', color: 'var(--muted-foreground)', fontSize: '0.78rem', marginBottom: '4px',
          }}
        >
          Recent check-ins ({recentCheckIns.length})
          {showCheckInHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      )}
      {showCheckInHistory && recentCheckIns.map((ci) => (
        <CheckInOutcome key={ci.id} checkIn={ci} />
      ))}

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
