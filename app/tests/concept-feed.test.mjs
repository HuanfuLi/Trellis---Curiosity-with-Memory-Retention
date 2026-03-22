import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDailyKnowledgeContext, buildFallbackPosts, buildPostOriginContext } from '../src/services/concept-feed.service.ts';

const makeQuestion = (overrides) => ({
  id: `q-${Math.random().toString(16).slice(2)}`,
  timestamp: Date.now(),
  date: '2026-03-22',
  content: 'What is spaced repetition?',
  answer: 'Spaced repetition revisits material over widening intervals to improve retention.',
  summary: 'Spaced repetition revisits material over widening intervals.',
  title: 'Spaced repetition',
  storyHook: 'Why does spacing out reviews make memory stronger?',
  keywords: ['memory', 'review', 'retention'],
  relatedQuestionIds: [],
  categoryIds: ['cat-general'],
  reviewSchedule: { nextReviewDate: '2026-03-23', reviewCount: 0, easeFactor: 2.5 },
  createdAt: Date.now(),
  ...overrides,
});

test('buildDailyKnowledgeContext selects recent, resurfaced, and related knowledge', () => {
  const questions = [
    makeQuestion({ id: 'q-1', title: 'Forgetting curve', relatedQuestionIds: ['q-5'], keywords: ['memory', 'forgetting'] }),
    makeQuestion({ id: 'q-2', title: 'Spaced repetition', keywords: ['memory', 'spacing'] }),
    makeQuestion({ id: 'q-3', title: 'Retrieval practice', keywords: ['retrieval', 'practice'] }),
    makeQuestion({ id: 'q-4', title: 'Sleep and memory', keywords: ['sleep', 'consolidation'] }),
    makeQuestion({ id: 'q-5', title: 'Desirable difficulty', relatedQuestionIds: ['q-1'], keywords: ['learning', 'memory'] }),
    makeQuestion({ id: 'q-6', title: 'Interleaving', keywords: ['learning', 'variation'] }),
  ];

  const context = buildDailyKnowledgeContext(questions);

  assert.equal(context.recent.length, 4);
  assert.ok(context.resurfaced.length >= 1);
  assert.ok(context.related.some((pair) => pair.source.id === 'q-1' && pair.target.id === 'q-5'));
});

test('buildFallbackPosts creates richer posts with teaser, full body, and quick asks', () => {
  const posts = buildFallbackPosts([
    makeQuestion({
      id: 'q-1',
      title: 'Forgetting curve',
      summary: 'The forgetting curve describes how unrehearsed memory fades rapidly.',
      answer: 'The forgetting curve describes how unrehearsed memory fades rapidly unless it is revisited through retrieval, spaced repetition, or meaningful use.',
      keywords: ['memory', 'forgetting', 'retrieval'],
    }),
  ], '2026-03-22');

  assert.ok(posts.length >= 1);
  assert.ok(posts[0].teaser.preview.length > 40);
  assert.ok(posts[0].bodyMarkdown.length > 180);
  assert.equal(posts[0].quickAskPrompts.length, 3);
});

test('buildPostOriginContext carries the full post snapshot and source question summaries', () => {
  const question = makeQuestion({
    id: 'q-1',
    title: 'Retrieval practice',
    content: 'Why does retrieval practice work so well?',
    summary: 'Retrieval practice strengthens memory by reconstructing information from scratch.',
  });
  const [post] = buildFallbackPosts([question], '2026-03-22');
  const context = buildPostOriginContext(post, [question]);

  assert.equal(context.post.id, post.id);
  assert.equal(context.sourceQuestions.length, 1);
  assert.equal(context.sourceQuestions[0].id, 'q-1');
});
