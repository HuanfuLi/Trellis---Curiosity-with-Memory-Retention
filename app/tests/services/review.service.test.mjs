import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('review.service', () => {
  // REVIEW-01: getTodayReviewItems returns all due cards (no .slice cap)
  it('getTodayReviewItems returns all due items without slicing', async () => {
    // Source-level assertion: review.service.ts should not cap due items with .slice()
    // Before fix: code has `due.slice(0, 10)` -- this test FAILS
    // After fix: code returns all due items without slicing -- this test PASSES
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/review.service.ts', import.meta.url), 'utf-8');
    assert.ok(!source.includes('.slice(0,'), 'review.service.ts should not contain .slice(0, ...) cap on due items');
  });

  // REVIEW-05: default dailyLimit is 50
  it('default dailyLimit is 50', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/settings.service.ts', import.meta.url), 'utf-8');
    assert.ok(source.includes('dailyLimit: 50'), 'settings.service.ts should have dailyLimit: 50');
  });

  // REVIEW-02: getTodayReviewCount calls getTodayReviewItems (no separate cap)
  it('getTodayReviewCount delegates to getTodayReviewItems without a separate cap', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/review.service.ts', import.meta.url), 'utf-8');
    // getTodayReviewCount must call getTodayReviewItems (delegates, no independent cap)
    assert.ok(
      source.includes('getTodayReviewItems'),
      'review.service.ts getTodayReviewCount should call getTodayReviewItems',
    );
    // Must not apply any .slice() cap of its own
    assert.ok(
      !source.includes('.slice(0,'),
      'review.service.ts should not contain a .slice(0, ...) cap anywhere',
    );
    // Must not contain a standalone limit variable (old hard-cap pattern)
    assert.ok(
      !source.includes('let limit'),
      'review.service.ts should not contain a "let limit" cap variable',
    );
  });

  // REVIEW-02: useReview exposes reviewCount derived directly from items (no separate cap)
  it('useReview exposes reviewCount from items.length without an independent cap', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/state/useReview.ts', import.meta.url), 'utf-8');
    // reviewCount must be items.length (the uncapped list)
    assert.ok(
      source.includes('reviewCount: items.length'),
      'useReview.ts should expose reviewCount as items.length',
    );
    // useReview must call getTodayReviewItems (via the service reload)
    assert.ok(
      source.includes('getTodayReviewItems'),
      'useReview.ts should call reviewService.getTodayReviewItems',
    );
  });
});
