import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDailyKnowledgeContext, buildPostOriginContext } from '../src/services/concept-feed.service.ts';

// buildFallbackPosts was removed in 72f4795c (2026-04-03 "Removed fallback posts").
// The two tests that depended on it were stale ever since. The
// buildDailyKnowledgeContext test still exercises live exports; the third
// test below now constructs a minimal DailyPost directly instead of routing
// through the removed builder.

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

const makePost = (overrides) => ({
  id: `p-${Math.random().toString(16).slice(2)}`,
  date: '2026-03-22',
  title: 'Retrieval practice',
  teaser: { hook: 'Why retrieval?', preview: 'Recalling information actively strengthens it.' },
  bodyMarkdown: 'Retrieval practice strengthens memory by reconstructing information from scratch.',
  whyCare: 'It is one of the most-validated learning techniques.',
  takeaway: 'Practice retrieval, not re-reading.',
  quickAskPrompts: ['What is retrieval practice?', 'How does it differ from re-reading?', 'When is it best used?'],
  narrativeMode: 'explanatory',
  contextLabel: 'memory · learning',
  sourceType: 'recent',
  sourceQuestionIds: [],
  sourceQuestionTitles: [],
  keywords: ['memory', 'retrieval'],
  generatedAt: Date.now(),
  origin: 'ai',
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

test('buildPostOriginContext carries the full post snapshot and source question summaries', () => {
  const question = makeQuestion({
    id: 'q-1',
    title: 'Retrieval practice',
    content: 'Why does retrieval practice work so well?',
    summary: 'Retrieval practice strengthens memory by reconstructing information from scratch.',
  });
  const post = makePost({ sourceQuestionIds: ['q-1'], sourceQuestionTitles: ['Retrieval practice'] });
  const context = buildPostOriginContext(post, [question]);

  assert.equal(context.post.id, post.id);
  assert.equal(context.sourceQuestions.length, 1);
  assert.equal(context.sourceQuestions[0].id, 'q-1');
});
