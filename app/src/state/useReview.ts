import { useState, useEffect, useCallback } from 'react';
import type { Question, ReviewSchedule, ServiceError } from '../types';
import { mockReviewService } from '../services/mock/review.mock';

interface UseReviewReturn {
  items: Question[];
  reviewCount: number;
  isLoading: boolean;
  error: ServiceError | null;
  submitReview: (id: string, rating: 1 | 2 | 3 | 4 | 5) => Promise<ReviewSchedule | null>;
  skipReview: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useReview(): UseReviewReturn {
  const [items, setItems] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    const result = await mockReviewService.getTodayReviewItems();
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

  const submitReview = useCallback(async (id: string, rating: 1 | 2 | 3 | 4 | 5): Promise<ReviewSchedule | null> => {
    const result = await mockReviewService.submitReview(id, rating);
    if (result.success) {
      setItems((prev) => prev.filter((q) => q.id !== id));
      return result.data ?? null;
    } else {
      setError(result.error ?? null);
      return null;
    }
  }, []);

  const skipReview = useCallback(async (id: string): Promise<void> => {
    await mockReviewService.skipReview(id);
    setItems((prev) => prev.filter((q) => q.id !== id));
  }, []);

  return { items, reviewCount: items.length, isLoading, error, submitReview, skipReview, reload };
}
