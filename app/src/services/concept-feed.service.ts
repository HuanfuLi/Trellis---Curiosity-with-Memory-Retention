import { chatCompletion } from '../providers/llm/index.ts';
import type { DailyPost, PostNarrativeMode, PostOriginContext, PostSnapshot, Question } from '../types';
import { today } from '../lib/date.ts';
import { mockSettingsService } from './mock/settings.mock.ts';
import { plannerService } from './planner.service.ts';

const STORAGE_KEY = 'echolearn_daily_posts';
const MAX_POSTS = 4;
const CONTEXT_LIMIT = 10;

interface PlannerSignals {
  activeThreads: string[];
  confusionAreas: string[];
  curiosityTopics: string[];
}

interface DailyKnowledgeContext {
  recent: Question[];
  resurfaced: Question[];
  related: Array<{ source: Question; target: Question }>;
  plannerSignals: PlannerSignals;
}

interface CachedDailyPosts {
  date: string;
  fingerprint: string;
  posts: DailyPost[];
}

function computePlannerFingerprint(): string {
  const savedThreads = plannerService.getSavedThreads().map((thread) => `${thread.id}:${thread.lastActivityAt}`);
  const recentSignals = plannerService.getRecentSignals();
  return JSON.stringify({
    threads: savedThreads,
    confusion: recentSignals.confusion,
    curiosity: recentSignals.curiosity,
    connections: recentSignals.connections,
    revisitIntent: recentSignals.revisitIntent,
  });
}

const VALID_SOURCE_TYPES = new Set<DailyPost['sourceType']>(['recent', 'related', 'resurfaced', 'starter', 'mixed']);

export const STARTER_POSTS: DailyPost[] = [
  makeStarterPost(
    'starter-memory-speed',
    'Why do you forget things that fast?',
    'Your brain treats first exposure as a draft, not a commitment.',
    'A first encounter creates a weak memory trace. If nothing asks you to retrieve it, compare it, or use it again, the brain assumes the detail was temporary and lets it fade.\n\nThat is why an article you liked yesterday can feel strangely distant today, while an old lyric survives for years. The lyric kept returning with emotion, repetition, and context. The article probably did not.\n\nLearning starts to feel easier when you stop reading for familiarity and start revisiting for evidence. The brain keeps what looks reusable.',
    'If you want something to stay, you have to signal that it matters more than once.',
    'Memory improves when retrieval, repetition, and relevance appear together.',
    ['Why does retrieval matter more than rereading?', 'Does sleep help memory lock in?', 'What makes one memory feel important?'],
  ),
  makeStarterPost(
    'starter-rereading-trap',
    'Why does rereading feel productive but fail later?',
    'Recognition is comfortable, but comfort is not proof of recall.',
    'Rereading creates a smooth sensation: you see the same words, they feel familiar, and your brain quietly says, "yes, I know this." That feeling is real, but it mostly measures recognition, not retrieval.\n\nRetrieval is harsher. It asks whether you can rebuild the idea without the page in front of you. That effort feels less fluent, which is exactly why it teaches you more.\n\nThe trap is emotional as much as cognitive: rereading feels like progress because it removes friction. But in learning, a little friction is often the sign that the memory is actually getting stronger.',
    'If learning feels too smooth, you may be recognizing, not remembering.',
    'The uncomfortable version of practice is often the one that lasts.',
    ['Can struggle actually improve memory?', 'What is the difference between recognition and recall?', 'How do I test myself without overdoing it?'],
  ),
  makeStarterPost(
    'starter-connections',
    'Why do connected ideas last longer than isolated facts?',
    'A fact survives better when it has more than one road back into it.',
    'An isolated fact has to be retrieved through a single narrow path. If that path is weak, the memory disappears under pressure. A connected idea behaves differently. It can be reached through an example, a contrast, a story, a prior question, or even a joke you attached to it.\n\nThat is why understanding often feels more durable than memorization. Understanding automatically creates structure around the idea. It gives the brain multiple handles instead of one.\n\nWhen learning begins to compound, it is usually because you stopped collecting fragments and started building routes between them.',
    'Connections do not just enrich knowledge; they stabilize it.',
    'The more paths you build into an idea, the easier it is to recover later.',
    ['How do I build better connections between topics?', 'Why does understanding feel faster after a while?', 'Can examples act like memory hooks?'],
  ),
];

function makeStarterPost(
  id: string,
  hook: string,
  preview: string,
  bodyMarkdown: string,
  whyCare: string,
  takeaway: string,
  quickAskPrompts: string[],
): DailyPost {
  return {
    id,
    date: today(),
    title: hook,
    teaser: { hook, preview },
    bodyMarkdown,
    whyCare,
    takeaway,
    quickAskPrompts,
    narrativeMode: 'starter',
    contextLabel: 'Starter post',
    sourceType: 'starter',
    sourceQuestionIds: [],
    sourceQuestionTitles: [],
    keywords: ['learning', 'memory'],
    generatedAt: Date.now(),
    origin: 'fallback',
  };
}

function isValidDailyPost(value: unknown): value is DailyPost {
  if (!value || typeof value !== 'object') return false;
  const post = value as Partial<DailyPost>;
  return (
    typeof post.id === 'string' &&
    typeof post.date === 'string' &&
    typeof post.title === 'string' &&
    typeof post.bodyMarkdown === 'string' &&
    typeof post.whyCare === 'string' &&
    typeof post.takeaway === 'string' &&
    Boolean(post.teaser) &&
    typeof post.teaser?.hook === 'string' &&
    typeof post.teaser?.preview === 'string' &&
    typeof post.contextLabel === 'string' &&
    typeof post.narrativeMode === 'string' &&
    typeof post.sourceType === 'string' &&
    VALID_SOURCE_TYPES.has(post.sourceType as DailyPost['sourceType']) &&
    Array.isArray(post.sourceQuestionIds) &&
    Array.isArray(post.sourceQuestionTitles) &&
    Array.isArray(post.quickAskPrompts) &&
    Array.isArray(post.keywords) &&
    typeof post.generatedAt === 'number' &&
    (post.origin === 'ai' || post.origin === 'fallback')
  );
}

function loadCache(): CachedDailyPosts | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedDailyPosts>;
    if (
      typeof parsed?.date !== 'string' ||
      typeof parsed?.fingerprint !== 'string' ||
      !Array.isArray(parsed?.posts)
    ) {
      return null;
    }

    const posts = parsed.posts.filter(isValidDailyPost);
    if (posts.length === 0) return null;

    return {
      date: parsed.date,
      fingerprint: parsed.fingerprint,
      posts,
    };
  } catch {
    return null;
  }
}

function saveCache(cache: CachedDailyPosts): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore cache persistence failures
  }
}

function truncate(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return normalized.slice(0, max - 1).trimEnd() + '…';
}

function firstSentence(text: string, max = 220): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const dot = normalized.indexOf('.');
  if (dot > 0 && dot + 1 <= max) return normalized.slice(0, dot + 1);
  return truncate(normalized, max);
}

function titleFor(question: Question): string {
  return question.title?.trim() || truncate(question.content, 72);
}

function computeFingerprint(questions: Question[]): string {
  const questionFingerprint = questions
    .slice(0, CONTEXT_LIMIT)
    .map((question) => `${question.id}:${question.createdAt}`)
    .join('|');
  return `${questionFingerprint}::planner:${computePlannerFingerprint()}`;
}

export function buildDailyKnowledgeContext(questions: Question[]): DailyKnowledgeContext {
  const recent = questions.slice(0, 4);
  const resurfaced = questions
    .slice(4)
    .filter((question) => question.relatedQuestionIds.length > 0 || question.keywords.length > 0)
    .slice(0, 4);

  const byId = new Map(questions.map((question) => [question.id, question]));
  const related: Array<{ source: Question; target: Question }> = [];
  const seenPairs = new Set<string>();

  for (const source of questions.slice(0, 8)) {
    for (const targetId of source.relatedQuestionIds.slice(0, 2)) {
      const target = byId.get(targetId);
      if (!target) continue;
      const key = source.id < target.id ? `${source.id}:${target.id}` : `${target.id}:${source.id}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      related.push({ source, target });
      if (related.length >= 4) break;
    }
    if (related.length >= 4) break;
  }

  // Gather planner signals for feed ranking
  const savedThreads = plannerService.getSavedThreads();
  const recentSignals = plannerService.getRecentSignals();
  const plannerSignals: PlannerSignals = {
    activeThreads: savedThreads.slice(0, 6).map((t) => t.title),
    confusionAreas: recentSignals.confusion.slice(0, 4),
    curiosityTopics: recentSignals.curiosity.slice(0, 4),
  };

  return { recent, resurfaced, related, plannerSignals };
}

export function buildFallbackPosts(questions: Question[], date: string): DailyPost[] {
  if (questions.length === 0) return [];

  const context = buildDailyKnowledgeContext(questions);
  const posts: DailyPost[] = [];

  for (const question of context.recent.slice(0, 2)) {
    posts.push({
      id: `fallback-recent-${question.id}`,
      date,
      title: titleFor(question),
      teaser: {
        hook: question.storyHook?.trim() || `Why does ${titleFor(question).toLowerCase()} matter?`,
        preview: firstSentence(question.summary || question.answer, 120),
      },
      bodyMarkdown: [
        `## The Core Idea`,
        firstSentence(question.answer, 520),
        '',
        `## Why You Should Care`,
        `This matters because ${firstSentence(question.summary || question.answer, 220).toLowerCase()}`,
        '',
        `## A Useful Way To Remember It`,
        `Link **${titleFor(question)}** to ${question.keywords.slice(0, 2).join(' and ') || 'the questions you have been exploring lately'}. That extra association makes it easier to retrieve later.`,
      ].join('\n'),
      whyCare: `This idea strengthens the rest of today's learning because it connects directly to what you have been asking.`,
      takeaway: firstSentence(question.answer, 140),
      quickAskPrompts: [
        `Give me an example of ${titleFor(question)}`,
        `Why does ${titleFor(question).toLowerCase()} matter in practice?`,
        `How does this connect to what I asked before?`,
      ],
      narrativeMode: 'mechanism-breakdown',
      contextLabel: 'Fresh from your recent questions',
      sourceType: 'recent',
      sourceQuestionIds: [question.id],
      sourceQuestionTitles: [titleFor(question)],
      keywords: question.keywords.slice(0, 5),
      generatedAt: Date.now(),
      origin: 'fallback',
    });
  }

  for (const pair of context.related.slice(0, 1)) {
    posts.push({
      id: `fallback-related-${pair.source.id}-${pair.target.id}`,
      date,
      title: `What links ${titleFor(pair.source)} and ${titleFor(pair.target)}?`,
      teaser: {
        hook: `What links ${titleFor(pair.source)} and ${titleFor(pair.target)}?`,
        preview: 'Sometimes two ideas become easier to remember together than apart.',
      },
      bodyMarkdown: [
        `## The Hidden Bridge`,
        `${titleFor(pair.source)} and ${titleFor(pair.target)} look different on the surface, but they overlap in the way they organize the problem. Once you notice the bridge, each idea becomes easier to retrieve because the other one can call it back.`,
        '',
        `## Why This Helps`,
        `Learning compounds when concepts stop competing for attention and start reinforcing each other. That is often the moment when the subject begins to feel lighter instead of heavier.`,
        '',
        `## Memory Hook`,
        `If you can explain how **${titleFor(pair.source)}** opens into **${titleFor(pair.target)}**, you are no longer memorizing fragments. You are building structure.`,
      ].join('\n'),
      whyCare: 'Connections turn isolated answers into a system you can return to later.',
      takeaway: 'A bridge between concepts often becomes the memory handle that survives longest.',
      quickAskPrompts: [
        `Explain the connection in simpler words`,
        `Give me a concrete example of this bridge`,
        `What should I learn next after these two ideas?`,
      ],
      narrativeMode: 'analogy',
      contextLabel: 'Connected to what you already asked',
      sourceType: 'related',
      sourceQuestionIds: [pair.source.id, pair.target.id],
      sourceQuestionTitles: [titleFor(pair.source), titleFor(pair.target)],
      keywords: Array.from(new Set([...pair.source.keywords, ...pair.target.keywords])).slice(0, 6),
      generatedAt: Date.now(),
      origin: 'fallback',
    });
  }

  return posts.slice(0, MAX_POSTS);
}

function buildGenerationPrompt(date: string, context: DailyKnowledgeContext): string {
  const serializeQuestion = (question: Question) => [
    `id: ${question.id}`,
    `title: ${titleFor(question)}`,
    `question: ${truncate(question.content, 160)}`,
    `summary: ${truncate(question.summary || question.answer, 220)}`,
    `keywords: ${question.keywords.join(', ') || 'none'}`,
  ].join('\n');

  const relatedLines = context.related.map(({ source, target }) =>
    [
      `sourceId: ${source.id}`,
      `sourceTitle: ${titleFor(source)}`,
      `targetId: ${target.id}`,
      `targetTitle: ${titleFor(target)}`,
      `sharedKeywords: ${source.keywords.filter((keyword) => target.keywords.includes(keyword)).join(', ') || 'none'}`,
    ].join('\n'),
  );

  return [
    `Create ${Math.min(MAX_POSTS, Math.max(2, context.recent.length + context.related.length))} daily learning posts for ${date}.`,
    'The posts should feel like intriguing short-form educational essays, not flashcards or summaries.',
    'Each post must be substantial: teaser preview 25-55 words; bodyMarkdown 180-340 words.',
    'Vary narrative style across posts using these modes: example-first, historical-story, contrast, analogy, false-intuition, mnemonic, mechanism-breakdown.',
    'At least one post should use an example, and if helpful one may use a gentle joke or mnemonic to improve recall.',
    'Every post must include: title, teaserHook, teaserPreview, bodyMarkdown, whyCare, takeaway, quickAskPrompts (3 strings), narrativeMode, contextLabel, sourceType, sourceQuestionIds, keywords.',
    'Use only sourceQuestionIds that appear in the provided context.',
    'Ground the essay in the supplied knowledge. Do not invent unrelated facts. Keep the writing vivid and readable.',
    'Return ONLY valid JSON array.',
    '',
    'Recent questions:',
    ...context.recent.map(serializeQuestion),
    '',
    'Resurfaced knowledge:',
    ...context.resurfaced.map(serializeQuestion),
    '',
    'Related bridges:',
    ...relatedLines,
    '',
    ...(context.plannerSignals.activeThreads.length > 0 || context.plannerSignals.confusionAreas.length > 0 || context.plannerSignals.curiosityTopics.length > 0
      ? [
          'Active learning signals (boost relevance for these topics):',
          ...(context.plannerSignals.activeThreads.length > 0 ? [`Active threads: ${context.plannerSignals.activeThreads.join(', ')}`] : []),
          ...(context.plannerSignals.confusionAreas.length > 0 ? [`Unresolved areas: ${context.plannerSignals.confusionAreas.join(', ')}`] : []),
          ...(context.plannerSignals.curiosityTopics.length > 0 ? [`Curiosity topics: ${context.plannerSignals.curiosityTopics.join(', ')}`] : []),
        ]
      : []),
  ].join('\n');
}

function parseGeneratedPosts(raw: string, questions: Question[], date: string): DailyPost[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]) as Array<Record<string, unknown>>;
  const byId = new Map(questions.map((question) => [question.id, question]));

  return parsed
    .slice(0, MAX_POSTS)
    .map((item, index) => {
      const sourceQuestionIds = Array.isArray(item.sourceQuestionIds)
        ? item.sourceQuestionIds.filter((value): value is string => typeof value === 'string' && byId.has(value)).slice(0, 4)
        : [];
      const sourceQuestionTitles = sourceQuestionIds.map((id) => titleFor(byId.get(id)!));
      const teaserHook = typeof item.teaserHook === 'string' ? truncate(item.teaserHook, 110) : '';
      const teaserPreview = typeof item.teaserPreview === 'string' ? truncate(item.teaserPreview, 220) : '';
      const bodyMarkdown = typeof item.bodyMarkdown === 'string' ? item.bodyMarkdown.trim() : '';
      const title = typeof item.title === 'string' ? truncate(item.title, 110) : teaserHook;
      if (!teaserHook || !teaserPreview || !bodyMarkdown || !title) return null;

      const post: DailyPost = {
        id: `post-${date}-${index}-${sourceQuestionIds.join('-') || 'general'}`,
        date,
        title,
        teaser: { hook: teaserHook, preview: teaserPreview },
        bodyMarkdown,
        whyCare: typeof item.whyCare === 'string' ? truncate(item.whyCare, 220) : teaserPreview,
        takeaway: typeof item.takeaway === 'string' ? truncate(item.takeaway, 180) : teaserPreview,
        quickAskPrompts: Array.isArray(item.quickAskPrompts)
          ? item.quickAskPrompts.filter((value): value is string => typeof value === 'string').slice(0, 3)
          : [],
        narrativeMode: (typeof item.narrativeMode === 'string' ? item.narrativeMode : 'mechanism-breakdown') as PostNarrativeMode,
        contextLabel: typeof item.contextLabel === 'string' ? truncate(item.contextLabel, 90) : 'Daily post',
        sourceType: (typeof item.sourceType === 'string' ? item.sourceType : 'mixed') as DailyPost['sourceType'],
        sourceQuestionIds,
        sourceQuestionTitles,
        keywords: Array.isArray(item.keywords)
          ? item.keywords.filter((value): value is string => typeof value === 'string').slice(0, 6)
          : [],
        generatedAt: Date.now(),
        origin: 'ai',
      };
      return post;
    })
    .filter((post): post is DailyPost => post !== null);
}

async function generateDailyPostsWithLLM(questions: Question[], date: string): Promise<DailyPost[]> {
  const settings = mockSettingsService.getSync();
  if (!settings.preferences.aiConsentGiven || !settings.llm.isConfigured) return [];

  const context = buildDailyKnowledgeContext(questions.slice(0, CONTEXT_LIMIT));
  if (context.recent.length === 0 && context.resurfaced.length === 0 && context.related.length === 0) return [];

  const raw = await chatCompletion(
    [
      {
        role: 'system',
        content: [
          'You are an editorial learning writer.',
          'Write rich, intriguing, accurate educational posts from the supplied user knowledge.',
          'Do not write flashcards, tiny summaries, or listicles without a narrative spine.',
          'Return only valid JSON.',
        ].join('\n'),
      },
      { role: 'user', content: buildGenerationPrompt(date, context) },
    ],
    settings.llm,
  );

  return parseGeneratedPosts(raw, questions, date);
}

function toPostSnapshot(post: DailyPost): PostSnapshot {
  const { generatedAt: _generatedAt, origin: _origin, ...snapshot } = post;
  return snapshot;
}

export function buildPostOriginContext(post: DailyPost, questions: Question[]): PostOriginContext {
  const byId = new Map(questions.map((question) => [question.id, question]));
  return {
    post: toPostSnapshot(post),
    sourceQuestions: post.sourceQuestionIds
      .map((id) => byId.get(id))
      .filter((question): question is Question => Boolean(question))
      .map((question) => ({
        id: question.id,
        title: titleFor(question),
        content: question.content,
        summary: question.summary || firstSentence(question.answer, 220),
      })),
  };
}

export const conceptFeedService = {
  async getDailyPosts(questions: Question[]): Promise<DailyPost[]> {
    const date = today();
    const fingerprint = computeFingerprint(questions);
    const cached = loadCache();
    if (cached?.date === date && cached.fingerprint === fingerprint && cached.posts.length > 0) {
      return cached.posts;
    }

    let newPosts: DailyPost[] = [];
    try {
      newPosts = await generateDailyPostsWithLLM(questions, date);
    } catch {
      newPosts = [];
    }

    if (newPosts.length === 0) {
      newPosts = buildFallbackPosts(questions, date);
    }

    // Preserve old posts so their IDs remain valid for PostDetailScreen even
    // after the fingerprint changes (e.g. new question added or new day).
    const oldPosts = cached?.posts ?? [];
    const newIds = new Set(newPosts.map((p) => p.id));
    const preserved = oldPosts.filter((p) => !newIds.has(p.id));
    // New posts first, then any old posts the user may have already opened.
    const allPosts = [...newPosts, ...preserved];

    saveCache({ date, fingerprint, posts: allPosts });
    return allPosts;
  },

  /**
   * Look up a post by ID from the cache only. Never triggers regeneration —
   * this prevents the PostDetailScreen from accidentally invalidating the
   * cache when the `questions` array changes after mount.
   */
  getPostById(id: string): DailyPost | null {
    const cached = loadCache();
    if (!cached) return null;
    return cached.posts.find((post) => post.id === id) ?? null;
  },

  getCachedDailyPosts(): DailyPost[] {
    return loadCache()?.posts ?? [];
  },

  /** Explicitly clear the post cache (e.g. after "Clear All Data"). */
  clearCache(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  },

  /**
   * Generate additional posts that differ from the ones already cached.
   * Appends to the existing cache so old post IDs remain valid.
   */
  async generateMorePosts(questions: Question[], count = 4): Promise<DailyPost[]> {
    const date = today();
    const cached = loadCache();
    const existingPosts = cached?.posts ?? [];
    const existingIds = new Set(existingPosts.map((p) => p.id));
    const existingTitles = existingPosts.map((p) => p.title);

    let newPosts: DailyPost[] = [];

    const settings = mockSettingsService.getSync();
    if (settings.preferences.aiConsentGiven && settings.llm.isConfigured && questions.length > 0) {
      const context = buildDailyKnowledgeContext(questions.slice(0, CONTEXT_LIMIT));
      if (context.recent.length > 0 || context.resurfaced.length > 0 || context.related.length > 0) {
        const avoidClause = existingTitles.length > 0
          ? `\nIMPORTANT: Do NOT repeat topics already covered. Existing post titles to avoid:\n${existingTitles.map((t) => `- ${t}`).join('\n')}\nChoose different angles, examples, or connections.`
          : '';

        try {
          const raw = await chatCompletion(
            [
              {
                role: 'system',
                content: [
                  'You are an editorial learning writer.',
                  'Write rich, intriguing, accurate educational posts from the supplied user knowledge.',
                  'Do not write flashcards, tiny summaries, or listicles without a narrative spine.',
                  'Return only valid JSON.',
                ].join('\n'),
              },
              { role: 'user', content: buildGenerationPrompt(date, context) + avoidClause },
            ],
            settings.llm,
          );
          newPosts = parseGeneratedPosts(raw, questions, date)
            .filter((p) => !existingIds.has(p.id));
        } catch {
          newPosts = [];
        }
      }
    }

    if (newPosts.length === 0) {
      // Generate fallback posts offset from existing ones
      newPosts = buildFallbackPosts(questions, date)
        .filter((p) => !existingIds.has(p.id));
      if (newPosts.length === 0 && questions.length > 0) {
        // Create posts from questions not yet covered
        const coveredIds = new Set(existingPosts.flatMap((p) => p.sourceQuestionIds));
        const uncovered = questions.filter((q) => !coveredIds.has(q.id));
        if (uncovered.length > 0) {
          newPosts = buildFallbackPosts(uncovered, date)
            .filter((p) => !existingIds.has(p.id));
        }
      }
    }

    newPosts = newPosts.slice(0, count);

    // Append to cache so existing post IDs remain valid
    if (newPosts.length > 0) {
      const allPosts = [...existingPosts, ...newPosts];
      const fingerprint = computeFingerprint(questions);
      saveCache({ date, fingerprint, posts: allPosts });
    }

    return newPosts;
  },

  buildPostOriginContext,
};
