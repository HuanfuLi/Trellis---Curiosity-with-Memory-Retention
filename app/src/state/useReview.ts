import { useState, useEffect, useCallback } from 'react';
import type { FlashCard, ReviewSchedule, ServiceError } from '../types';
import { reviewService } from '../services/review.service';
import { eventBus } from '../lib/event-bus';

interface UseReviewReturn {
  items: FlashCard[];
  reviewCount: number;
  isLoading: boolean;
  error: ServiceError | null;
  submitReview: (id: string, rating: 1 | 2 | 3 | 4 | 5) => Promise<ReviewSchedule | null>;
  skipReview: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useReview(): UseReviewReturn {
  const [items, setItems] = useState<FlashCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    const result = await reviewService.getTodayReviewItems();
    if (result.success && result.data) {
      setItems(result.data);
    } else {
      setError(result.error ?? null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Reload whenever new flashcards are created (processSession fires asynchronously)
  useEffect(() => {
    return eventBus.subscribe('FLASHCARDS_CREATED', () => {
      void reload();
    });
  }, [reload]);

  const submitReview = useCallback(
    async (id: string, rating: 1 | 2 | 3 | 4 | 5): Promise<ReviewSchedule | null> => {
      const result = await reviewService.submitReview(id, rating);
      if (result.success) {
        setItems((prev) => prev.filter((c) => c.id !== id));
        return result.data ?? null;
      } else {
        setError(result.error ?? null);
        return null;
      }
    },
    [],
  );

  const skipReview = useCallback(async (id: string): Promise<void> => {
    await reviewService.skipReview(id);
    setItems((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { items, reviewCount: items.length, isLoading, error, submitReview, skipReview, reload };
}
