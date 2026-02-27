import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Flashcard } from '../components/Flashcard';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { useReview } from '../state/useReview';

export function ReviewScreen() {
  const navigate = useNavigate();
  const { items, isLoading, submitReview, skipReview } = useReview();

  const [reviewed, setReviewed] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [done, setDone] = useState(false);

  const total = items.length + reviewed;
  const progress = total > 0 ? (reviewed / total) * 100 : 0;

  const currentItem = items[0];

  const handleRate = async (rating: number) => {
    if (!currentItem) return;
    await submitReview(currentItem.id, rating as 1 | 2 | 3 | 4 | 5);
    setTotalRatings((prev) => prev + rating);
    const nextReviewed = reviewed + 1;
    setReviewed(nextReviewed);

    if (nextReviewed >= total || items.length <= 1) {
      setDone(true);
    }
  };

  const handleSkip = async () => {
    if (!currentItem) return;
    await skipReview(currentItem.id);
    if (items.length <= 1) {
      setDone(true);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '448px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--muted-foreground)' }}>Loading review items...</p>
      </div>
    );
  }

  if (done || items.length === 0) {
    const avgRating = reviewed > 0 ? (totalRatings / reviewed).toFixed(1) : '—';
    return (
      <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ color: 'var(--primary-40)', background: 'none', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', padding: 0 }}
        >
          <ArrowLeft size={20} /> Back
        </button>

        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            backgroundColor: 'var(--card)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          <p style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</p>
          <h2 style={{ marginBottom: '8px' }}>All Done!</h2>
          <p style={{ color: 'var(--muted-foreground)', marginBottom: '24px' }}>
            {reviewed > 0 ? `Great work! You reviewed ${reviewed} card${reviewed !== 1 ? 's' : ''} today.` : 'No cards due today — come back tomorrow!'}
          </p>

          {reviewed > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '32px' }}>
              <div>
                <p style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--primary-40)' }}>{reviewed}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Reviewed</p>
              </div>
              <div>
                <p style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--primary-40)' }}>{avgRating}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Avg rating</p>
              </div>
            </div>
          )}

          <Button onClick={() => navigate(-1)} fullWidth>Back to Calendar</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 0 96px', maxWidth: '448px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ color: 'var(--primary-40)', background: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: 0 }}
          >
            <ArrowLeft size={20} /> Back
          </button>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            {reviewed} / {total} reviewed
          </span>
        </div>
        <ProgressBar value={progress} />
      </div>

      {/* Flashcard */}
      <Flashcard
        front={currentItem.front}
        back={currentItem.back}
        onRate={handleRate}
      />

      {/* Skip */}
      <div style={{ textAlign: 'center', marginTop: '16px', padding: '0 16px' }}>
        <button
          onClick={handleSkip}
          style={{ color: 'var(--muted-foreground)', background: 'none', fontSize: '0.875rem' }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
