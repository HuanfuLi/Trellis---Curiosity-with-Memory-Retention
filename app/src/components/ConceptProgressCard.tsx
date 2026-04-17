import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import { ProgressBar } from './ui/ProgressBar';

interface ConceptProgressCardProps {
  explored: number;
  total: number;
  isComplete: boolean;
}

export function ConceptProgressCard({ explored, total, isComplete }: ConceptProgressCardProps) {
  const { t } = useTranslation();

  if (total === 0) return null;

  const progressPercent = total > 0 ? Math.round((explored / total) * 100) : 0;
  const barColor = isComplete ? '#E8A838' : 'var(--primary-40)';
  const cardBg = isComplete
    ? 'color-mix(in srgb, #E8A838 8%, var(--card))'
    : 'var(--card)';

  return (
    <div
      data-concept-progress-card
      style={{
        backgroundColor: cardBg,
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-1)',
        padding: '16px',
        marginTop: '16px',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BookOpen size={20} color={barColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>
          {t('home.feed.title')}
        </span>
      </div>
      <p style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--muted-foreground)', marginTop: '4px' }}>
        {isComplete
          ? t('home.feed.complete')
          : t('home.feed.progress', { explored, total })}
      </p>
      <ProgressBar
        value={progressPercent}
        color={barColor}
        height={8}
        style={{ marginTop: '8px' }}
      />
    </div>
  );
}

interface CompactProgressBarProps {
  explored: number;
  total: number;
  isComplete: boolean;
}

export function CompactProgressBar({ explored, total, isComplete }: CompactProgressBarProps) {
  const { t } = useTranslation();
  const progressPercent = total > 0 ? Math.round((explored / total) * 100) : 0;
  const barColor = isComplete ? '#E8A838' : 'var(--primary-40)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
      <BookOpen size={16} color={barColor} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
        {isComplete
          ? t('home.feed.complete')
          : t('home.feed.progressCompact', { explored, total })}
      </span>
      <ProgressBar
        value={progressPercent}
        color={barColor}
        height={6}
        style={{ flex: 1 }}
      />
    </div>
  );
}
