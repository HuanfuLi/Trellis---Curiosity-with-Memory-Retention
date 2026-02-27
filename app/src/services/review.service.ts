import type { Question, ReviewSchedule, ServiceResult } from '../types';
import { today, addDays } from '../lib/date';
import { questionService } from './question.service';
import { eventBus } from '../lib/event-bus';

const SM2_INTERVALS = [1, 2, 4, 7, 15, 30];

function calcNextInterval(
  reviewCount: number,
  rating: number,
  easeFactor: number,
): { days: number; newEaseFactor: number } {
  const newEF = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02),
  );
  if (rating < 3) {
    return { days: 1, newEaseFactor: newEF };
  }
  const intervalIndex = Math.min(reviewCount, SM2_INTERVALS.length - 1);
  return { days: SM2_INTERVALS[intervalIndex], newEaseFactor: newEF };
}

export const reviewService = {
  async getTodayReviewItems(): Promise<ServiceResult<Question[]>> {
    const t = today();
    const all = questionService.getAll();
    const due = all.filter((q) => q.reviewSchedule.nextReviewDate <= t);
    return { success: true, data: due.slice(0, 10) };
  },

  async getTodayReviewCount(): Promise<ServiceResult<number>> {
    const result = await this.getTodayReviewItems();
    return { success: true, data: result.data?.length ?? 0 };
  },

  async submitReview(
    questionId: string,
    rating: 1 | 2 | 3 | 4 | 5,
  ): Promise<ServiceResult<ReviewSchedule>> {
    const all = questionService.getAll();
    const q = all.find((q) => q.id === questionId);
    if (!q) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Question not found', retryable: false },
      };
    }

    const { days, newEaseFactor } = calcNextInterval(
      q.reviewSchedule.reviewCount,
      rating,
      q.reviewSchedule.easeFactor,
    );
    const newSchedule: ReviewSchedule = {
      nextReviewDate: addDays(today(), days),
      reviewCount: q.reviewSchedule.reviewCount + 1,
      easeFactor: newEaseFactor,
    };

    questionService.updateReviewSchedule(questionId, newSchedule);
    eventBus.emit({ type: 'REVIEW_SUBMITTED', payload: { questionId, rating } });
    return { success: true, data: newSchedule };
  },

  async skipReview(questionId: string): Promise<ServiceResult<void>> {
    const all = questionService.getAll();
    const q = all.find((q) => q.id === questionId);
    if (!q) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Question not found', retryable: false },
      };
    }

    questionService.updateReviewSchedule(questionId, {
      ...q.reviewSchedule,
      nextReviewDate: addDays(today(), 1),
    });
    return { success: true };
  },
};
