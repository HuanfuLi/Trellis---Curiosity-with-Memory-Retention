import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Radio } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { usePodcast } from '../state/usePodcast';
import { today, formatDateLabel, isToday } from '../lib/date';
import type { DailyPodcast } from '../types';

export function PodcastScreen() {
  const navigate = useNavigate();
  const { podcasts, isLoading, isGenerating, generationProgress, getPodcastForDate, generatePodcast } = usePodcast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const todayPodcast = getPodcastForDate(today());
  const selected: DailyPodcast | null = selectedId
    ? (podcasts.find((p) => p.id === selectedId) ?? null)
    : (todayPodcast ?? podcasts[0] ?? null);

  useEffect(() => {
    if (!isPlaying || !selected?.duration) return;
    const duration = selected.duration;
    const interval = setInterval(() => {
      setPlaybackProgress((prev) => {
        if (prev >= 100) { setIsPlaying(false); return 0; }
        return prev + (100 / duration) * 0.5;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying, selected]);

  const statusColor = (status: DailyPodcast['status']) => {
    if (status === 'ready') return 'green';
    if (status === 'generating') return 'yellow';
    if (status === 'failed') return 'red';
    return 'gray';
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ color: 'var(--primary-40)', background: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ marginBottom: '2px' }}>Podcasts</h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>Your daily learning summaries</p>
        </div>
      </div>

      {/* Selected Podcast Player */}
      {selected && selected.status === 'ready' && (
        <Card style={{ marginBottom: '24px', background: 'linear-gradient(135deg, var(--primary-90), var(--secondary-container))' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                {isToday(selected.date) ? 'Today' : formatDateLabel(selected.date)}
              </p>
              <h3 style={{ marginBottom: '4px' }}>Daily Recap</h3>
              {selected.duration && (
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>{formatDuration(selected.duration)}</p>
              )}
            </div>
            <Radio size={32} color="var(--primary-40)" />
          </div>

          <ProgressBar value={playbackProgress} style={{ marginBottom: '16px' } as React.CSSProperties} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <button
              onClick={() => { setIsPlaying(!isPlaying); if (playbackProgress === 100) setPlaybackProgress(0); }}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-40)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-2)',
              }}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
          </div>

          {selected.script && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '12px' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Script Preview
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--foreground)', lineHeight: 1.6 }}>
                {selected.script.slice(0, 200)}{selected.script.length > 200 ? '...' : ''}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Generate Today's Podcast */}
      {!todayPodcast && (
        <Card style={{ marginBottom: '24px', textAlign: 'center' }}>
          <Radio size={32} color="var(--primary-40)" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ marginBottom: '8px' }}>No podcast for today</h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
            Generate a podcast summarizing your recent learning sessions.
          </p>
          {isGenerating ? (
            <div>
              <ProgressBar value={generationProgress} style={{ marginBottom: '8px' } as React.CSSProperties} />
              <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Generating... {generationProgress}%</p>
            </div>
          ) : (
            <Button onClick={() => generatePodcast(today())} fullWidth>
              Generate Today's Podcast
            </Button>
          )}
        </Card>
      )}

      {todayPodcast?.status === 'generating' && (
        <Card style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '8px' }}>Generating today's podcast...</h4>
          <ProgressBar value={todayPodcast.progress ?? generationProgress} />
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '8px' }}>
            {todayPodcast.progress ?? generationProgress}% complete
          </p>
        </Card>
      )}

      {/* Podcast List */}
      <h4 style={{ marginBottom: '12px' }}>All Podcasts</h4>
      {isLoading ? (
        <p style={{ color: 'var(--muted-foreground)' }}>Loading...</p>
      ) : podcasts.length === 0 ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>No podcasts yet. Generate your first one!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {podcasts.map((pod) => (
            <Card
              key={pod.id}
              onClick={() => pod.status === 'ready' && setSelectedId(pod.id)}
              style={{
                cursor: pod.status === 'ready' ? 'pointer' : 'default',
                border: selected?.id === pod.id ? '2px solid var(--primary-40)' : '2px solid transparent',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => { if (pod.status === 'ready') e.currentTarget.style.transform = 'scale(1.01)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 500, marginBottom: '2px' }}>
                    {isToday(pod.date) ? 'Today' : formatDateLabel(pod.date)}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                    {pod.questionIds.length} questions · {formatDuration(pod.duration)}
                  </p>
                </div>
                <Badge color={statusColor(pod.status)}>{pod.status}</Badge>
              </div>
              {pod.status === 'generating' && (
                <div style={{ marginTop: '8px' }}>
                  <ProgressBar value={pod.progress ?? 0} height={4} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
