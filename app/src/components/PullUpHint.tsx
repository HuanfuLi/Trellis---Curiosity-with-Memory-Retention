/**
 * PullUpHint.tsx
 * Bottom-of-feed affordance for pull-up to load more posts.
 * Phase 8: Post Detail & Infinite Scroll
 *
 * - Always reserves 80px height to prevent scroll jank
 * - Shows hint text when at bottom (not loading)
 * - Shows spinner during load
 * - Uses Lucide React icons
 */

import { ArrowUp, Loader2 } from 'lucide-react';

interface PullUpHintProps {
  isLoading?: boolean;
  isAtBottom?: boolean;
}

export function PullUpHint({ isLoading = false, isAtBottom = false }: PullUpHintProps) {
  return (
    <div
      style={{
        minHeight: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: 'var(--muted-foreground)',
        fontSize: '0.875rem',
        gap: '8px',
      }}
      aria-live="polite"
      aria-label={isLoading ? 'Loading more posts' : 'Scroll up to load more posts'}
    >
      {isLoading ? (
        <>
          <Loader2
            size={16}
            style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
          />
          <span>Loading more posts...</span>
        </>
      ) : isAtBottom ? (
        <>
          <ArrowUp size={16} style={{ flexShrink: 0 }} />
          <span>Pull up to load more</span>
        </>
      ) : null}
    </div>
  );
}
