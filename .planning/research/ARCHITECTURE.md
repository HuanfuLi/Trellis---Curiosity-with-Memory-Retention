# Architecture Patterns for EchoLearn v1.1

**Project:** EchoLearn  
**Phase:** v1.1 Feature Integration  
**Researched:** 2025-01-17  
**Status:** Detailed Design Recommendations

---

## Executive Summary

EchoLearn's existing service-based architecture is well-structured for v1.1's new features. The framework uses **singleton services** that expose a domain interface, custom hooks that consume these services with React state, an **event bus** for cross-service communication, and a **dual-storage** layer (localStorage + SQLite).

For v1.1, we extend this pattern by adding:

1. **ImageGenerationService** – Orchestrates async image generation with queueing, retry, and caching
2. **FeedPaginationService** – Stateless pagination logic with cursor-based navigation
3. **PlannerOrchestratorService** – Scores suggestions using trajectory signals from Review/Question/Feed
4. **SchedulerService** – Native timer-based task scheduling with localStorage checkpoints
5. **CardTemplateRegistry** – Design template system using a plugin-like registry pattern
6. **PostImageManagementService** – Manages image lifecycle (generation → caching → display)

The architecture maintains **clear service boundaries**, **event-driven coordination**, and **single responsibility** while supporting v1.1's complexity.

---

## 1. New Service Layer Design

### 1.1 ImageGenerationService

Handles all image generation workflows with async patterns, caching, and error recovery.

**Location:** `src/services/image-generation.service.ts`

```typescript
// ── Type Definitions ────────────────────────────────────────────────────────

export type ImageProvider = 'nano-banana' | 'gemini' | 'local';
export type ImageStatus = 'pending' | 'generating' | 'cached' | 'failed';

export interface GenerationRequest {
  id: string;
  prompt: string;
  provider: ImageProvider;
  contextIds: string[]; // LinkedConceptIds or question refs
  priority: 'immediate' | 'batch' | 'background';
  metadata?: {
    postId?: string;
    questionId?: string;
    templateId?: string;
  };
  createdAt: number;
}

export interface GenerationResult {
  requestId: string;
  imageUrl?: string;
  imageData?: string; // Base64 for local storage
  status: ImageStatus;
  cacheKey: string;
  generatedAt?: number;
  error?: ServiceError;
  retryCount: number;
}

export interface ImageCache {
  key: string;
  imageData: string; // Base64
  metadata: {
    prompt: string;
    provider: ImageProvider;
    generatedAt: number;
    contexts: string[];
    hits: number; // Track popularity
  };
  expiresAt: number; // TTL for cache invalidation
}

// ── Queue Management ────────────────────────────────────────────────────────

interface GenerationQueue {
  immediate: GenerationRequest[];
  batch: GenerationRequest[];
  background: GenerationRequest[];
}

// ── Service Implementation ──────────────────────────────────────────────────

export const imageGenerationService = {
  /**
   * Queue an image generation request.
   * Returns immediately with requestId; generation happens async.
   */
  async enqueueGeneration(
    prompt: string,
    provider: ImageProvider,
    options: {
      priority?: 'immediate' | 'batch' | 'background';
      contextIds?: string[];
      metadata?: GenerationRequest['metadata'];
    } = {},
  ): Promise<ServiceResult<{ requestId: string }>> {
    const requestId = `img_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const request: GenerationRequest = {
      id: requestId,
      prompt,
      provider,
      contextIds: options.contextIds ?? [],
      priority: options.priority ?? 'batch',
      metadata: options.metadata,
      createdAt: Date.now(),
    };

    // Persist to queue
    persistToQueue(request);

    // Emit event so UI can track generation status
    eventBus.emit({
      type: 'IMAGE_GENERATION_QUEUED',
      payload: { requestId, prompt, provider },
    });

    // Start processing async (non-blocking)
    processQueue().catch((err) => console.warn('[image-gen] Queue processing failed:', err));

    return { success: true, data: { requestId } };
  },

  /**
   * Get generation status by requestId.
   * Polls cache and queue state.
   */
  async getGenerationStatus(requestId: string): Promise<ServiceResult<GenerationResult>> {
    const cached = lookupCache(requestId);
    if (cached?.imageData) {
      return {
        success: true,
        data: {
          requestId,
          imageData: cached.imageData,
          status: 'cached',
          cacheKey: requestId,
          generatedAt: cached.metadata.generatedAt,
          retryCount: 0,
        },
      };
    }

    const queued = lookupQueuedRequest(requestId);
    if (queued) {
      return {
        success: true,
        data: {
          requestId,
          status: queued.status === 'generating' ? 'generating' : 'pending',
          cacheKey: requestId,
          retryCount: queued.retryCount ?? 0,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Generation request ${requestId} not found`,
        retryable: false,
      },
    };
  },

  /**
   * Batch fetch images (for feed/planner display).
   * Returns whatever is cached; triggers generation for missing.
   */
  async getBatchImages(
    requests: Array<{ prompt: string; provider: ImageProvider; contextIds?: string[] }>,
  ): Promise<ServiceResult<GenerationResult[]>> {
    const results: GenerationResult[] = [];

    for (const req of requests) {
      const cached = findCachedByPrompt(req.prompt, req.provider);
      if (cached) {
        results.push({
          requestId: cached.key,
          imageData: cached.imageData,
          status: 'cached',
          cacheKey: cached.key,
          generatedAt: cached.metadata.generatedAt,
          retryCount: 0,
        });
      } else {
        // Queue for background generation
        const { data } = await this.enqueueGeneration(req.prompt, req.provider, {
          priority: 'background',
          contextIds: req.contextIds,
        });
        results.push({
          requestId: data?.requestId ?? '',
          status: 'pending',
          cacheKey: data?.requestId ?? '',
          retryCount: 0,
        });
      }
    }

    return { success: true, data: results };
  },

  /**
   * Clear old cached images (run periodically).
   * Keeps recent + popular images, evicts least-used.
   */
  async trimCache(maxSizeBytes: number = 50 * 1024 * 1024): Promise<ServiceResult<void>> {
    const allCached = getAllCachedImages();
    let totalSize = allCached.reduce((sum, img) => sum + img.imageData.length, 0);

    if (totalSize <= maxSizeBytes) {
      return { success: true };
    }

    // Sort by (hits, recency); evict from end
    const sorted = allCached.sort((a, b) => {
      const hitsDiff = b.metadata.hits - a.metadata.hits;
      if (hitsDiff !== 0) return hitsDiff;
      return b.metadata.generatedAt - a.metadata.generatedAt;
    });

    for (const img of sorted) {
      deleteFromCache(img.key);
      totalSize -= img.imageData.length;
      if (totalSize <= maxSizeBytes * 0.8) break;
    }

    return { success: true };
  },
};

// ── Internal Async Processing (Non-blocking background worker) ──────────────

async function processQueue(): Promise<void> {
  const queue = getQueue();

  // Process in priority order: immediate → batch → background
  const toProcess = [
    ...queue.immediate.splice(0, 1),     // 1 immediate at a time
    ...queue.batch.splice(0, 3),         // Up to 3 batch in parallel
    ...queue.background.splice(0, 2),    // Up to 2 background in parallel
  ];

  if (toProcess.length === 0) return;

  // Mark as generating
  toProcess.forEach((req) => (req.status = 'generating'));
  persistQueue(queue);

  // Fetch images in parallel
  const results = await Promise.allSettled(
    toProcess.map((req) => generateImageForRequest(req)),
  );

  // Handle results
  results.forEach((result, idx) => {
    const req = toProcess[idx];
    if (result.status === 'fulfilled') {
      cacheResult(req.id, result.value);
      eventBus.emit({
        type: 'IMAGE_GENERATED',
        payload: {
          requestId: req.id,
          imageUrl: result.value.imageUrl,
          provider: req.provider,
        },
      });
      removeFromQueue(req.id);
    } else {
      handleGenerationError(req, result.reason);
    }
  });

  // Re-persist updated queue
  persistQueue(getQueue());

  // Continue if more items remain
  if (getQueue().immediate.length + getQueue().batch.length + getQueue().background.length > 0) {
    processQueue().catch(console.warn);
  }
}

async function generateImageForRequest(req: GenerationRequest): Promise<{ imageUrl: string; provider: ImageProvider }> {
  switch (req.provider) {
    case 'nano-banana':
      return generateViaNanoBanana(req.prompt);
    case 'gemini':
      return generateViaGemini(req.prompt);
    case 'local':
      return generateViaLocal(req.prompt, req.contextIds);
    default:
      throw new Error(`Unknown provider: ${req.provider}`);
  }
}

// Provider implementations (delegate to existing providers or new ones)
async function generateViaNanoBanana(prompt: string): Promise<{ imageUrl: string; provider: ImageProvider }> {
  // TODO: Implement Nano Banana API call
  // See: https://api.nanobana.com/docs
  // Key: Use API key from settings, handle rate limits, retry on 429
  throw new Error('Not implemented');
}

async function generateViaGemini(prompt: string): Promise<{ imageUrl: string; provider: ImageProvider }> {
  // TODO: Implement Gemini Image Generation
  // Use existing Gemini provider from src/providers/llm
  throw new Error('Not implemented');
}

async function generateViaLocal(
  prompt: string,
  contextIds: string[],
): Promise<{ imageUrl: string; provider: ImageProvider }> {
  // Fallback: Generate a placeholder or use a local ML model
  // For now, return a data URL placeholder
  const placeholder = generatePlaceholderImage(prompt);
  return { imageUrl: placeholder, provider: 'local' };
}
```

**Key Design Decisions:**

- **Async by design**: `enqueueGeneration()` returns immediately; UI polls status via `getGenerationStatus()`
- **Priority queue**: Immediate (user action), batch (feed generation), background (suggestions)
- **Caching with TTL**: Images expire; cache is trimmed by popularity and age
- **Non-blocking processing**: `processQueue()` runs in background without blocking React renders
- **Error recovery**: Failed requests stay in queue, can be retried
- **Event-driven**: Emits `IMAGE_GENERATED` so UI updates automatically

---

### 1.2 FeedPaginationService

Stateless pagination logic using cursor-based navigation for infinite scroll.

**Location:** `src/services/feed-pagination.service.ts`

```typescript
export interface FeedCursor {
  lastItemId: string; // ID of last item shown
  timestamp: number;  // When cursor was created (for time-based feeds)
  offset: number;     // Fallback: offset from start
}

export interface FeedPageRequest {
  limit?: number;
  cursor?: FeedCursor;
  filters?: {
    sourceType?: DailyPost['sourceType'][]; // ['recent', 'related', 'starter']
    templateId?: string; // Card template filter
  };
}

export interface FeedPage<T> {
  items: T[];
  nextCursor: FeedCursor | null; // null = no more items
  hasMore: boolean;
  totalFetched: number; // Total items returned in this session
}

export const feedPaginationService = {
  /**
   * Fetch next page of feed items.
   * Returns items + cursor for next page.
   * Stateless: same params always return same result.
   */
  async getNextPage(
    request: FeedPageRequest,
  ): Promise<ServiceResult<FeedPage<DailyPost>>> {
    const limit = request.limit ?? 10;
    const offset = request.cursor?.offset ?? 0;

    // Fetch all posts (concept-feed.service already handles generation)
    const allPosts = conceptFeedService.getDailyPosts();

    // Apply filters
    let filtered = allPosts;
    if (request.filters?.sourceType) {
      filtered = filtered.filter((p) => request.filters!.sourceType!.includes(p.sourceType));
    }
    if (request.filters?.templateId) {
      filtered = filtered.filter((p) => p.metadata?.templateId === request.filters!.templateId);
    }

    // Paginate
    const page = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < filtered.length;

    const nextCursor = hasMore
      ? {
          lastItemId: page[page.length - 1]?.id ?? '',
          timestamp: Date.now(),
          offset: offset + limit,
        }
      : null;

    return {
      success: true,
      data: {
        items: page,
        nextCursor,
        hasMore,
        totalFetched: offset + page.length,
      },
    };
  },

  /**
   * Infinite scroll helper: fetch next page, append to existing.
   * Used by useFeedInfiniteScroll hook.
   */
  async appendNextPage(
    currentItems: DailyPost[],
    cursor: FeedCursor | null,
  ): Promise<ServiceResult<FeedPage<DailyPost>>> {
    if (!cursor) {
      return { success: true, data: { items: [], nextCursor: null, hasMore: false, totalFetched: 0 } };
    }
    return this.getNextPage({ limit: 10, cursor });
  },
};
```

**Key Design Decisions:**

- **Stateless**: All state lives in React; service is pure logic
- **Cursor-based**: Better than offset for mutable feeds (posts can be added/removed)
- **Filter composition**: Filters are applied after pagination, allowing flexible combinations
- **Offset fallback**: Simple index-based navigation for predictable feeds

---

### 1.3 PlannerOrchestratorService

Scores planner suggestions using trajectory signals from Review/Question/Feed.

**Location:** `src/services/planner-orchestrator.service.ts`

```typescript
// ── Trajectory Signal Types ────────────────────────────────────────────────

export interface TrajectorySignals {
  // From Review service
  reviewMetrics: {
    totalReviewsThisWeek: number;
    averageAccuracy: number; // 0-1
    pinningRate: number; // % of items pinned vs total
    strugglingTopics: string[]; // Topic IDs with low accuracy
  };

  // From Question service
  questionMetrics: {
    questionsAskedThisWeek: number;
    recentQuestionIds: string[];
    curiosityTopics: string[]; // Topics user asks about most
  };

  // From Concept Feed service
  feedMetrics: {
    postsViewedThisWeek: number;
    postsInteractedWith: number;
    engagementScore: number; // 0-1, based on interaction
  };

  // From Planner service
  plannerMetrics: {
    chunksCompletedThisWeek: number;
    activeThreadCount: number;
    confusionAreas: string[]; // Topics marked as confused
  };

  timestamp: number;
}

// ── Scoring Model ──────────────────────────────────────────────────────────

export interface SuggestionScore {
  chunkId: string;
  score: number; // 0-1, higher = more relevant
  signals: {
    reviewAlignment: number; // Does chunk address struggling topic?
    questionAlignment: number; // Does chunk relate to recent questions?
    feedAlignment: number; // Does chunk extend feed engagement?
    plannerAlignment: number; // Does chunk advance active threads?
    novelty: number; // Freshness of suggestion
    difficulty: number; // 0-1, estimated difficulty
  };
  reason: string; // Human-readable explanation
}

// ── Service Implementation ──────────────────────────────────────────────────

export const plannerOrchestratorService = {
  /**
   * Collect trajectory signals from all sources.
   * Runs daily (via scheduler) or on-demand.
   */
  async gatherTrajectorySignals(): Promise<ServiceResult<TrajectorySignals>> {
    // Aggregate signals from each service
    const reviewResult = await reviewService.getTodayReviewItems();
    const recentQuestions = await questionService.getRecent(20);
    const feedMetrics = conceptFeedService.getEngagementMetrics();
    const plannerState = plannerService.getSavedThreads();

    const signals: TrajectorySignals = {
      reviewMetrics: {
        totalReviewsThisWeek: calculateWeeklyReviews(),
        averageAccuracy: calculateAverageAccuracy(),
        pinningRate: calculatePinningRate(),
        strugglingTopics: identifyStruggling(),
      },
      questionMetrics: {
        questionsAskedThisWeek: recentQuestions.length ?? 0,
        recentQuestionIds: recentQuestions.slice(0, 10).map((q) => q.id) ?? [],
        curiosityTopics: identifyCuriosity(recentQuestions),
      },
      feedMetrics: {
        postsViewedThisWeek: feedMetrics.viewsThisWeek,
        postsInteractedWith: feedMetrics.interactionsThisWeek,
        engagementScore: feedMetrics.engagementScore,
      },
      plannerMetrics: {
        chunksCompletedThisWeek: calculateCompletedChunks(),
        activeThreadCount: plannerState.length,
        confusionAreas: plannerService.getConfusionAreas(),
      },
      timestamp: Date.now(),
    };

    persistTrajectorySignals(signals);
    return { success: true, data: signals };
  },

  /**
   * Score all suggested chunks using current trajectory.
   * Higher score = more relevant to user's learning path.
   */
  async scoreAllSuggestions(): Promise<ServiceResult<SuggestionScore[]>> {
    const signals = await this.gatherTrajectorySignals();
    const allChunks = plannerService.getSuggestedChunks();

    const scores = allChunks.map((chunk) => scoreChunk(chunk, signals.data!));

    // Sort by score, cache top N
    const sorted = scores.sort((a, b) => b.score - a.score);
    persistScoredSuggestions(sorted);

    return { success: true, data: sorted };
  },

  /**
   * Get top N suggested chunks for user.
   * Used by Planner UI to show "Next Step" recommendations.
   */
  async getTopSuggestions(limit: number = 5): Promise<ServiceResult<SuggestionScore[]>> {
    const cached = loadCachedSuggestions();

    // Refresh if older than 6 hours
    if (cached && Date.now() - cached.timestamp < 6 * 60 * 60 * 1000) {
      return { success: true, data: cached.scores.slice(0, limit) };
    }

    return this.scoreAllSuggestions().then((result) => ({
      success: result.success,
      data: result.data?.slice(0, limit),
      error: result.error,
    }));
  },
};

// ── Scoring Logic ──────────────────────────────────────────────────────────

function scoreChunk(chunk: PlannerChunk, signals: TrajectorySignals): SuggestionScore {
  // Alignment scores (0-1 each)
  const reviewAlignment = calculateReviewAlignment(chunk, signals.reviewMetrics);
  const questionAlignment = calculateQuestionAlignment(chunk, signals.questionMetrics);
  const feedAlignment = calculateFeedAlignment(chunk, signals.feedMetrics);
  const plannerAlignment = calculatePlannerAlignment(chunk, signals.plannerMetrics);
  const novelty = calculateNovelty(chunk);
  const difficulty = estimateDifficulty(chunk, signals);

  // Weighted composite score
  const score = (
    reviewAlignment * 0.3 + // Review alignment is primary signal
    questionAlignment * 0.25 + // Question alignment secondary
    feedAlignment * 0.15 + // Feed engagement tertiary
    plannerAlignment * 0.15 + // Planner progression quaternary
    novelty * 0.1 + // Freshness bonus
    (1 - Math.min(difficulty, 1)) * 0.05 // Prefer not-too-hard
  );

  const reason = buildReasonString({
    reviewAlignment,
    questionAlignment,
    feedAlignment,
    difficulty,
  });

  return {
    chunkId: chunk.id,
    score: Math.max(0, Math.min(1, score)), // Clamp 0-1
    signals: {
      reviewAlignment,
      questionAlignment,
      feedAlignment,
      plannerAlignment,
      novelty,
      difficulty,
    },
    reason,
  };
}

function calculateReviewAlignment(chunk: PlannerChunk, metrics: TrajectorySignals['reviewMetrics']): number {
  // If chunk targets a struggling topic, boost score
  const linkedStruggling = chunk.linkedConceptIds.filter((id) =>
    metrics.strugglingTopics.includes(id),
  );
  return linkedStruggling.length > 0 ? 0.8 : 0.2;
}

function calculateQuestionAlignment(chunk: PlannerChunk, metrics: TrajectorySignals['questionMetrics']): number {
  // If chunk relates to recent questions, boost score
  const linkedQuestions = chunk.linkedConceptIds.filter((id) =>
    metrics.recentQuestionIds.includes(id),
  );
  return linkedQuestions.length > 0 ? 0.7 : 0.1;
}

function calculateFeedAlignment(chunk: PlannerChunk, metrics: TrajectorySignals['feedMetrics']): number {
  // If user is engaged with feed, suggest chunks that extend those ideas
  return metrics.engagementScore > 0.5 ? 0.5 : 0.1;
}

function calculatePlannerAlignment(chunk: PlannerChunk, metrics: TrajectorySignals['plannerMetrics']): number {
  // If chunk advances active threads, boost score
  if (!chunk.threadId) return 0.1;
  return metrics.activeThreadCount > 0 ? 0.6 : 0.2;
}

function calculateNovelty(chunk: PlannerChunk): number {
  // Prefer newer suggestions; decay over time
  const ageHours = (Date.now() - chunk.createdAt) / (60 * 60 * 1000);
  return Math.max(0.1, 1 - ageHours / 168); // Decay over 1 week
}

function estimateDifficulty(chunk: PlannerChunk, signals: TrajectorySignals): number {
  // Estimate difficulty based on type and user's track record
  switch (chunk.type) {
    case 'retrieve':
      return 0.2; // Easy
    case 'repair':
      return 0.5; // Medium (addressing confusion)
    case 'connect':
      return 0.65; // Medium-hard
    case 'create':
      return 0.8; // Hard
    default:
      return 0.5;
  }
}
```

**Key Design Decisions:**

- **Multi-source scoring**: Weights signals from Review (30%), Questions (25%), Feed (15%), Planner (15%)
- **Trajectory-based**: Suggests chunks that align with user's actual learning path, not generic recommendations
- **Caching with TTL**: Re-computes every 6 hours to balance freshness vs performance
- **Explainability**: Every score includes `reason` so UI can explain "Why this suggestion?"
- **Difficulty awareness**: Suggests appropriately challenging chunks, not always easiest

---

### 1.4 SchedulerService

Native timer-based task scheduling with localStorage checkpoints.

**Location:** `src/services/scheduler.service.ts`

```typescript
export interface ScheduledTask {
  id: string;
  name: string; // 'auto-generate-posts', 'trim-image-cache', 'score-suggestions'
  frequency: 'daily' | 'weekly' | 'every-n-hours';
  intervalHours?: number; // For 'every-n-hours'
  lastRunAt?: number;
  nextRunAt?: number;
  isRunning: boolean;
}

export interface SchedulerState {
  tasks: ScheduledTask[];
  lastCheckAt: number;
}

const SCHEDULER_KEY = 'echolearn_scheduler_state';
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute if any tasks are due

export const schedulerService = {
  /**
   * Initialize scheduler and start the background check loop.
   * Call on app startup (in App.tsx or useEffect in AppProvider).
   */
  async init(): Promise<ServiceResult<void>> {
    // Register default tasks
    const tasks: ScheduledTask[] = [
      {
        id: 'auto-generate-posts',
        name: 'auto-generate-posts',
        frequency: 'daily',
        isRunning: false,
      },
      {
        id: 'trim-image-cache',
        name: 'trim-image-cache',
        frequency: 'daily',
        isRunning: false,
      },
      {
        id: 'score-suggestions',
        name: 'score-suggestions',
        frequency: 'every-n-hours',
        intervalHours: 6,
        isRunning: false,
      },
    ];

    const state: SchedulerState = {
      tasks,
      lastCheckAt: Date.now(),
    };

    persistSchedulerState(state);

    // Start check loop (non-blocking)
    startCheckLoop();

    return { success: true };
  },

  /**
   * Register a custom scheduled task.
   * Used by features to hook into the scheduler.
   */
  async registerTask(
    id: string,
    frequency: ScheduledTask['frequency'],
    intervalHours?: number,
  ): Promise<ServiceResult<void>> {
    const state = loadSchedulerState();
    if (!state.tasks.find((t) => t.id === id)) {
      state.tasks.push({
        id,
        name: id,
        frequency,
        intervalHours,
        isRunning: false,
      });
      persistSchedulerState(state);
    }
    return { success: true };
  },

  /**
   * Manually trigger a task now (for testing or user action).
   */
  async runTaskNow(taskId: string): Promise<ServiceResult<void>> {
    return executeTaskById(taskId);
  },

  /**
   * Get all scheduled tasks and their next run time.
   */
  getTaskStatus(): ServiceResult<ScheduledTask[]> {
    const state = loadSchedulerState();
    return { success: true, data: state.tasks };
  },
};

// ── Background Check Loop (runs every minute) ──────────────────────────────

let checkLoopIntervalId: NodeJS.Timeout | null = null;

function startCheckLoop(): void {
  if (checkLoopIntervalId) return; // Already running

  checkLoopIntervalId = setInterval(() => {
    const state = loadSchedulerState();
    const now = Date.now();

    for (const task of state.tasks) {
      if (task.isRunning) continue; // Skip if already running

      const isDue = isTaskDue(task, now);
      if (isDue) {
        // Mark as running, execute async, update lastRunAt when done
        task.isRunning = true;
        persistSchedulerState(state);

        executeTaskById(task.id)
          .then(() => {
            const updated = loadSchedulerState();
            const foundTask = updated.tasks.find((t) => t.id === task.id);
            if (foundTask) {
              foundTask.lastRunAt = Date.now();
              foundTask.nextRunAt = calculateNextRunTime(foundTask);
              foundTask.isRunning = false;
              persistSchedulerState(updated);
            }
            eventBus.emit({
              type: 'SCHEDULED_TASK_COMPLETED',
              payload: { taskId: task.id },
            });
          })
          .catch((err) => {
            console.warn(`[scheduler] Task ${task.id} failed:`, err);
            const updated = loadSchedulerState();
            const foundTask = updated.tasks.find((t) => t.id === task.id);
            if (foundTask) {
              foundTask.isRunning = false;
            }
            persistSchedulerState(updated);
          });
      }
    }
  }, CHECK_INTERVAL_MS);
}

function isTaskDue(task: ScheduledTask, now: number): boolean {
  if (!task.lastRunAt) return true; // First run, always due

  switch (task.frequency) {
    case 'daily':
      return now - task.lastRunAt >= 24 * 60 * 60 * 1000;
    case 'weekly':
      return now - task.lastRunAt >= 7 * 24 * 60 * 60 * 1000;
    case 'every-n-hours':
      return now - task.lastRunAt >= (task.intervalHours ?? 6) * 60 * 60 * 1000;
    default:
      return false;
  }
}

function calculateNextRunTime(task: ScheduledTask): number {
  const last = task.lastRunAt ?? Date.now();
  switch (task.frequency) {
    case 'daily':
      return last + 24 * 60 * 60 * 1000;
    case 'weekly':
      return last + 7 * 24 * 60 * 60 * 1000;
    case 'every-n-hours':
      return last + (task.intervalHours ?? 6) * 60 * 60 * 1000;
    default:
      return last;
  }
}

async function executeTaskById(taskId: string): Promise<void> {
  switch (taskId) {
    case 'auto-generate-posts':
      return executeAutoGeneratePosts();
    case 'trim-image-cache':
      return executeImageCacheTrim();
    case 'score-suggestions':
      return executeScoringTask();
    default:
      console.warn(`[scheduler] Unknown task: ${taskId}`);
  }
}

async function executeAutoGeneratePosts(): Promise<void> {
  // Delegate to concept-feed.service
  console.log('[scheduler] Running auto-generate-posts');
  // const result = await conceptFeedService.generateDailyPosts();
  // Emit event so UI can refresh
}

async function executeImageCacheTrim(): Promise<void> {
  console.log('[scheduler] Running trim-image-cache');
  await imageGenerationService.trimCache(50 * 1024 * 1024);
}

async function executeScoringTask(): Promise<void> {
  console.log('[scheduler] Running score-suggestions');
  await plannerOrchestratorService.scoreAllSuggestions();
}
```

**Key Design Decisions:**

- **localStorage persistence**: Task state survives app restarts and WebView reloads on native
- **Minute-based checks**: Trade-off between granularity and battery life
- **Non-blocking execution**: Tasks run async; UI never blocks waiting for scheduler
- **Event-driven**: Emits `SCHEDULED_TASK_COMPLETED` so UI can refresh (e.g., re-score suggestions)
- **Manual trigger**: Can run tasks immediately for testing or user-initiated actions
- **Extensible**: New tasks can register with `registerTask()`

---

### 1.5 CardTemplateRegistry

Design template system using a plugin-like registry pattern.

**Location:** `src/services/card-template-registry.service.ts`

```typescript
export type CardLayoutType = 'standard' | 'learning-goal' | 'connection' | 'visual-scaffold' | 'custom';

export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  layoutType: CardLayoutType;
  schema: {
    // JSON Schema for card data shape
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  renderer: (data: unknown) => React.ReactNode; // Component factory
  thumbnailUrl?: string;
  isActive: boolean; // Can be toggled on/off
  priority: number; // Display order in template picker
}

export interface CardInstance {
  id: string;
  templateId: string;
  data: Record<string, unknown>; // Shape determined by template schema
  createdAt: number;
  source?: 'auto-generated' | 'user-designed';
}

// ── Registry Singleton ──────────────────────────────────────────────────────

class CardTemplateRegistry {
  private templates: Map<string, CardTemplate> = new Map();
  private instances: Map<string, CardInstance> = new Map();

  /**
   * Register a new template at startup.
   * Persist to localStorage so user's custom templates survive restarts.
   */
  registerTemplate(template: CardTemplate): void {
    this.templates.set(template.id, template);
    persistTemplateRegistry(Array.from(this.templates.values()));
  }

  /**
   * Get template by ID.
   */
  getTemplate(templateId: string): CardTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * List all active templates.
   * Sorted by priority.
   */
  getActiveTemplates(): CardTemplate[] {
    return Array.from(this.templates.values())
      .filter((t) => t.isActive)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Toggle template on/off (e.g., user preferences).
   */
  setTemplateActive(templateId: string, active: boolean): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.isActive = active;
      persistTemplateRegistry(Array.from(this.templates.values()));
    }
  }

  /**
   * Create a card instance from template.
   * Data is validated against schema.
   */
  createCardInstance(templateId: string, data: unknown): ServiceResult<CardInstance> {
    const template = this.getTemplate(templateId);
    if (!template) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: `Template ${templateId} not found`, retryable: false },
      };
    }

    // Validate data shape against template schema
    const valid = validateAgainstSchema(data, template.schema);
    if (!valid.ok) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Data does not match template schema: ${valid.error}`,
          retryable: false,
        },
      };
    }

    const instance: CardInstance = {
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      templateId,
      data: data as Record<string, unknown>,
      createdAt: Date.now(),
      source: 'auto-generated',
    };

    this.instances.set(instance.id, instance);
    persistCardInstances(Array.from(this.instances.values()));

    return { success: true, data: instance };
  }

  /**
   * Render a card instance using its template's renderer.
   */
  renderCard(cardId: string): React.ReactNode {
    const instance = this.instances.get(cardId);
    if (!instance) return null;

    const template = this.getTemplate(instance.templateId);
    if (!template) return null;

    return template.renderer(instance.data);
  }

  /**
   * Get all instances of a specific template type.
   * Used for analytics or bulk operations.
   */
  getInstancesByTemplate(templateId: string): CardInstance[] {
    return Array.from(this.instances.values()).filter((i) => i.templateId === templateId);
  }
}

export const cardTemplateRegistry = new CardTemplateRegistry();

// ── Built-in Templates ──────────────────────────────────────────────────────

export const BUILT_IN_TEMPLATES: CardTemplate[] = [
  {
    id: 'template-standard-post',
    name: 'Standard Post',
    description: 'Title, subtitle, body, image',
    layoutType: 'standard',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        subtitle: { type: 'string' },
        body: { type: 'string' },
        imageUrl: { type: 'string', format: 'uri' },
      },
      required: ['title', 'body'],
    },
    renderer: (data) => <StandardPostCard data={data as any} />,
    priority: 1,
    isActive: true,
  },
  {
    id: 'template-learning-goal',
    name: 'Learning Goal',
    description: 'Goal statement, success criteria, resources',
    layoutType: 'learning-goal',
    schema: {
      type: 'object',
      properties: {
        goal: { type: 'string' },
        criteria: { type: 'array', items: { type: 'string' } },
        resources: { type: 'array', items: { type: 'string' } },
      },
      required: ['goal'],
    },
    renderer: (data) => <LearningGoalCard data={data as any} />,
    priority: 2,
    isActive: true,
  },
  {
    id: 'template-connection',
    name: 'Concept Connection',
    description: 'Two concepts, bridge insight, visual',
    layoutType: 'connection',
    schema: {
      type: 'object',
      properties: {
        conceptA: { type: 'string' },
        conceptB: { type: 'string' },
        bridgeInsight: { type: 'string' },
        imageUrl: { type: 'string', format: 'uri' },
      },
      required: ['conceptA', 'conceptB', 'bridgeInsight'],
    },
    renderer: (data) => <ConnectionCard data={data as any} />,
    priority: 3,
    isActive: true,
  },
];

// ── Initialization ──────────────────────────────────────────────────────────

export function initializeCardTemplates(): void {
  // Load persisted templates, or use built-ins
  const persisted = loadTemplateRegistry();
  if (persisted.length > 0) {
    persisted.forEach((t) => cardTemplateRegistry.registerTemplate(t));
  } else {
    BUILT_IN_TEMPLATES.forEach((t) => cardTemplateRegistry.registerTemplate(t));
  }

  // Load persisted card instances
  const instances = loadCardInstances();
  instances.forEach((i) => {
    // Manually add to internal map (bypass validation)
    (cardTemplateRegistry as any).instances.set(i.id, i);
  });
}
```

**Key Design Decisions:**

- **Registry pattern**: Templates are registered at startup, not hardcoded in components
- **Schema validation**: Data is validated against JSON schema, ensuring type safety
- **Renderer factory**: Each template knows how to render itself
- **Persistence**: Templates and instances survive app restarts
- **Extensibility**: New templates can be registered at runtime (e.g., for A/B testing)

---

### 1.6 PostImageManagementService

Manages image lifecycle: generation → caching → display.

**Location:** `src/services/post-image-management.service.ts`

```typescript
export interface PostImageMeta {
  postId: string;
  imageId: string; // Reference to imageGenerationService result
  status: 'pending' | 'cached' | 'failed';
  generationPrompt: string;
  imageUrl?: string;
  imageData?: string; // Base64 fallback
  retryCount: number;
  createdAt: number;
}

const POST_IMAGES_KEY = 'echolearn_post_images';

export const postImageManagementService = {
  /**
   * Generate image for post.
   * Delegates to imageGenerationService, tracks metadata.
   */
  async generatePostImage(
    postId: string,
    prompt: string,
    provider: ImageProvider = 'nano-banana',
  ): Promise<ServiceResult<PostImageMeta>> {
    const genResult = await imageGenerationService.enqueueGeneration(prompt, provider, {
      priority: 'batch',
      metadata: { postId },
    });

    if (!genResult.success) {
      return genResult as ServiceResult<PostImageMeta>;
    }

    const meta: PostImageMeta = {
      postId,
      imageId: genResult.data!.requestId,
      status: 'pending',
      generationPrompt: prompt,
      retryCount: 0,
      createdAt: Date.now(),
    };

    savePostImageMeta(meta);

    // Poll for completion
    pollImageCompletion(meta.imageId, postId);

    return { success: true, data: meta };
  },

  /**
   * Get image for post (cached if available).
   * Returns null if not yet generated, without blocking.
   */
  getPostImage(postId: string): PostImageMeta | null {
    const metas = loadPostImageMetas();
    return metas.find((m) => m.postId === postId) ?? null;
  },

  /**
   * Wait for post image generation (for server-side or component needs).
   * Times out after 30 seconds (non-blocking generation).
   */
  async waitForPostImage(
    postId: string,
    timeoutMs: number = 30000,
  ): Promise<ServiceResult<PostImageMeta>> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        const meta = this.getPostImage(postId);

        if (meta?.status === 'cached') {
          clearInterval(checkInterval);
          resolve({ success: true, data: meta });
        } else if (meta?.status === 'failed') {
          clearInterval(checkInterval);
          resolve({
            success: false,
            error: {
              code: 'GENERATION_FAILED',
              message: `Image generation for post ${postId} failed`,
              retryable: true,
            },
          });
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          resolve({
            success: false,
            error: {
              code: 'TIMEOUT',
              message: `Image generation for post ${postId} timed out`,
              retryable: true,
            },
          });
        }
      }, 1000);
    });
  },

  /**
   * Cleanup: remove old post images.
   * Called periodically by scheduler.
   */
  async cleanupOldPostImages(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<ServiceResult<void>> {
    const metas = loadPostImageMetas();
    const now = Date.now();

    const toKeep = metas.filter((m) => now - m.createdAt < maxAgeMs);
    saveAllPostImageMetas(toKeep);

    return { success: true };
  },
};

// ── Internal Polling ────────────────────────────────────────────────────────

async function pollImageCompletion(imageId: string, postId: string): Promise<void> {
  const maxRetries = 60; // 60 second polling (1 second interval)
  let retryCount = 0;

  const poll = async () => {
    const statusResult = await imageGenerationService.getGenerationStatus(imageId);

    if (!statusResult.success) {
      // Image not found; may have failed
      updatePostImageMeta(postId, { status: 'failed', retryCount });
      return;
    }

    if (statusResult.data!.status === 'cached') {
      // Image ready
      updatePostImageMeta(postId, {
        status: 'cached',
        imageUrl: statusResult.data!.imageUrl,
        imageData: statusResult.data!.imageData,
      });

      eventBus.emit({
        type: 'POST_IMAGE_READY',
        payload: { postId, imageId },
      });
      return;
    }

    if (retryCount++ < maxRetries) {
      // Still generating, retry in 1 second
      setTimeout(poll, 1000);
    } else {
      // Timeout
      updatePostImageMeta(postId, { status: 'failed', retryCount });
    }
  };

  poll().catch(console.warn);
}

function updatePostImageMeta(postId: string, updates: Partial<PostImageMeta>): void {
  const metas = loadPostImageMetas();
  const idx = metas.findIndex((m) => m.postId === postId);
  if (idx >= 0) {
    metas[idx] = { ...metas[idx], ...updates };
    saveAllPostImageMetas(metas);
  }
}

function savePostImageMeta(meta: PostImageMeta): void {
  const metas = loadPostImageMetas();
  const idx = metas.findIndex((m) => m.postId === meta.postId);
  if (idx >= 0) {
    metas[idx] = meta;
  } else {
    metas.push(meta);
  }
  saveAllPostImageMetas(metas);
}

function loadPostImageMetas(): PostImageMeta[] {
  try {
    const raw = localStorage.getItem(POST_IMAGES_KEY);
    return raw ? (JSON.parse(raw) as PostImageMeta[]) : [];
  } catch {
    return [];
  }
}

function saveAllPostImageMetas(metas: PostImageMeta[]): void {
  localStorage.setItem(POST_IMAGES_KEY, JSON.stringify(metas));
}
```

**Key Design Decisions:**

- **Non-blocking generation**: Returns immediately; UI polls for status
- **Timeout handling**: Doesn't wait forever; gracefully degrades to placeholder
- **Event-driven**: Emits `POST_IMAGE_READY` so UI can update
- **Cleanup**: Old images are pruned to manage storage

---

## 2. Integration Points with Existing Services

### 2.1 Service Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│ Presentation Layer (React Components)                            │
│ ├─ HomeScreen                                                    │
│ ├─ PostDetailScreen                                              │
│ ├─ PlannerScreen                                                 │
│ └─ ReviewScreen                                                  │
└────────────────────────────────────────────────────────────────┘
                            │
                            ├─── useQuestions (custom hook)
                            ├─── useReview (custom hook)
                            ├─── usePlanner (custom hook)
                            └─── useFeedInfiniteScroll (NEW hook)
                            │
┌────────────────────────────────────────────────────────────────┐
│ Business Logic Layer (Services)                                 │
│                                                                  │
│ Existing:                                                        │
│ ├─ questionService                                              │
│ ├─ reviewService ──────────────┐                               │
│ ├─ conceptFeedService           │                               │
│ ├─ plannerService               │                               │
│ └─ flashcardService             │                               │
│                                 │                               │
│ NEW:                            │                               │
│ ├─ imageGenerationService ◄─────┤─── gatherTrajectorySignals  │
│ ├─ feedPaginationService        │                               │
│ ├─ plannerOrchestratorService ◄─┴─ (reads from all above)      │
│ ├─ schedulerService ────────────┐                               │
│ ├─ cardTemplateRegistry         │                               │
│ └─ postImageManagementService ◄─┴─── delegates to image gen    │
│                                                                  │
│ Event Bus: cross-service communication                           │
│ ├─ IMAGE_GENERATION_QUEUED                                      │
│ ├─ IMAGE_GENERATED                                              │
│ ├─ POST_IMAGE_READY                                             │
│ ├─ SCHEDULED_TASK_COMPLETED                                     │
│ └─ REVIEW_SUBMITTED                                             │
└────────────────────────────────────────────────────────────────┘
                            │
┌────────────────────────────────────────────────────────────────┐
│ Infrastructure Layer (Providers + DB)                           │
│ ├─ LLM providers (Gemini, Claude, OpenAI)                      │
│ ├─ Image providers (Nano Banana, Gemini)        [NEW]           │
│ ├─ Database layer (SQLite + localStorage)                       │
│ ├─ Capacitor (native APIs, haptics)                             │
│ └─ Event Bus                                                     │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Service Initialization Order

In `App.tsx` or `main.tsx`, initialize services in this order:

```typescript
// 1. Database first (others depend on it)
await dbService.init();

// 2. Load persisted state
await questionService.hydrate();
await plannerService.hydrate();

// 3. Initialize templates
initializeCardTemplates();

// 4. Initialize scheduler (non-blocking background tasks)
await schedulerService.init();

// 5. Services are ready for use
```

### 2.3 Event Bus Integration

New events emitted by v1.1 services:

```typescript
// Event types (add to src/types/index.ts)
export type AppEvent =
  | { type: 'REVIEW_SUBMITTED'; payload: { questionId: string; rating: number } }
  | { type: 'IMAGE_GENERATION_QUEUED'; payload: { requestId: string; prompt: string; provider: ImageProvider } }
  | { type: 'IMAGE_GENERATED'; payload: { requestId: string; imageUrl: string; provider: ImageProvider } }
  | { type: 'POST_IMAGE_READY'; payload: { postId: string; imageId: string } }
  | { type: 'SCHEDULED_TASK_COMPLETED'; payload: { taskId: string } };

// Consume in components:
useEffect(() => {
  const unsubscribe = eventBus.subscribe('IMAGE_GENERATED', (event) => {
    // Refresh feed with new images
    setFeed((prev) => ({ ...prev }));
  });
  return unsubscribe;
}, []);
```

---

## 3. Data Flow Diagrams

### 3.1 Image Generation Pipeline

```
User views Post in Feed
          │
          ▼
PostDetailScreen mounts
          │
          ▼
postImageManagementService.generatePostImage(postId, prompt)
          │
          ├─► imageGenerationService.enqueueGeneration()
          │       ├─► Create GenerationRequest
          │       ├─► Persist to queue (localStorage)
          │       ├─► emit IMAGE_GENERATION_QUEUED event
          │       └─► Start processQueue() async (non-blocking)
          │
          ├─► pollImageCompletion(imageId, postId) async polling
          │       ├─► Check every 1 second
          │       ├─► getGenerationStatus(imageId)
          │       ├─► Update PostImageMeta on cache hit
          │       ├─► emit POST_IMAGE_READY event
          │       └─► Timeout after 60 attempts (60s)
          │
          ▼
UI receives IMAGE_GENERATED event
          │
          ├─► React state updated
          ├─► PostDetailScreen re-renders
          └─► Image displayed in Post
```

### 3.2 Infinite Scroll Feed

```
HomeScreen renders
          │
          ▼
useFeedInfiniteScroll(limit=10) hook
          │
          ├─► Initialize state: items=[], cursor=null
          ├─► Load first page: feedPaginationService.getNextPage({limit: 10})
          │       ├─► Fetch from conceptFeedService.getDailyPosts()
          │       ├─► Apply filters (sourceType, templateId)
          │       ├─► Slice [0:10]
          │       ├─► Return (items, nextCursor, hasMore)
          │       └─► Cache in local state
          │
          ▼
Render first 10 posts + scroll indicator
          │
          ▼
User scrolls near end
          │
          ├─► IntersectionObserver triggers
          ├─► Call appendNextPage(currentItems, cursor)
          │       ├─► feedPaginationService.getNextPage({cursor})
          │       ├─► Slice [offset: offset+10]
          │       └─► Return next 10 items + new cursor
          │
          ▼
Append new items to state
          │
          ▼
Infinite scroll continues (hasMore: true)
```

### 3.3 Planner Suggestion Scoring

```
Daily at 12:00 AM (or manual trigger)
          │
          ▼
schedulerService fires 'score-suggestions' task
          │
          ▼
plannerOrchestratorService.scoreAllSuggestions()
          │
          ├─► gatherTrajectorySignals()
          │   ├─► reviewService.getTodayReviewItems()
          │   ├─► questionService.getRecent(20)
          │   ├─► conceptFeedService.getEngagementMetrics()
          │   ├─► plannerService.getSavedThreads()
          │   ├─► Compute: strugglingTopics, curiosityTopics, etc.
          │   └─► Persist TrajectorySignals
          │
          ├─► For each suggested chunk:
          │   ├─► calculateReviewAlignment(chunk, metrics)
          │   ├─► calculateQuestionAlignment(chunk, metrics)
          │   ├─► calculateFeedAlignment(chunk, metrics)
          │   ├─► calculatePlannerAlignment(chunk, metrics)
          │   ├─► calculateNovelty(chunk)
          │   ├─► estimateDifficulty(chunk, signals)
          │   ├─► Composite score = weighted sum
          │   └─► SuggestionScore with reason
          │
          ├─► Sort by score, cache top N
          │
          ▼
emit SCHEDULED_TASK_COMPLETED event
          │
          ▼
PlannerScreen receives event
          │
          ├─► Re-fetch top suggestions
          ├─► plannerOrchestratorService.getTopSuggestions(5)
          └─► Display "Next Steps" with reasons
```

---

## 4. Caching Strategy

### 4.1 Image Generation Cache

**Strategy:** LRU by popularity + TTL

| Cache | Key | TTL | Eviction |
|-------|-----|-----|----------|
| `echolearn_image_cache` | `${prompt_hash}_${provider}` | 30 days | LRU by hit count + age |
| Size limit | 50 MB | — | Trim when exceeded |

**Persistence:**
- Live cache: localStorage (limited ~5-10MB per domain)
- Long-term: SQLite on native (unlimited)

**Trimming:** Run `imageGenerationService.trimCache()` daily via scheduler

### 4.2 Feed Cache

| Cache | Key | TTL | Eviction |
|-------|-----|-----|----------|
| `echolearn_daily_posts` | Daily fingerprint | 1 day | Refresh after 24h |
| Connection cards | Computed daily | 1 day | Refresh after 24h |

**Logic:**
- Compute fingerprint from planner state
- If fingerprint unchanged, return cached posts
- If changed, regenerate posts

### 4.3 Suggestion Score Cache

| Cache | Key | TTL | Eviction |
|-------|-----|-----|----------|
| `echolearn_scored_suggestions` | Daily timestamp | 6 hours | Refresh after 6h |

**Logic:**
- Cache top N scored suggestions
- Refresh every 6 hours OR when trajectory signals change significantly

### 4.4 Post Image Cache

| Cache | Key | TTL | Eviction |
|-------|-----|-----|----------|
| `echolearn_post_images` | `${postId}` | Until post deleted | Manual cleanup |

**Cleanup:**
- Remove images for deleted posts
- Trim images older than 30 days
- Run `postImageManagementService.cleanupOldPostImages()` via scheduler

---

## 5. Error Handling & Retry Strategy

### 5.1 Image Generation Failures

```typescript
// Pseudo-code for handleGenerationError
async function handleGenerationError(
  req: GenerationRequest,
  error: Error,
): Promise<void> {
  req.retryCount = (req.retryCount ?? 0) + 1;

  if (req.retryCount < 3) {
    // Retry with backoff: 1s, 5s, 30s
    const backoff = [1000, 5000, 30000][req.retryCount - 1];
    setTimeout(() => {
      // Re-queue request
      persistToQueue(req);
    }, backoff);
  } else {
    // Final failure: mark as failed, emit event
    cacheResult(req.id, {
      status: 'failed',
      error: { code: 'MAX_RETRIES', message: error.message },
    });

    eventBus.emit({
      type: 'IMAGE_GENERATION_FAILED',
      payload: { requestId: req.id, error: error.message },
    });
  }
}
```

### 5.2 Scheduler Task Failures

If a scheduled task fails, it's logged but doesn't crash the scheduler. The task is retried at the next interval.

```typescript
// In executeTaskById
try {
  await taskExecutor();
} catch (err) {
  console.warn(`[scheduler] Task ${taskId} failed:`, err);
  // Don't throw; just log and continue
  eventBus.emit({
    type: 'SCHEDULED_TASK_FAILED',
    payload: { taskId, error: (err as Error).message },
  });
}
```

### 5.3 Pagination Boundary Errors

If feed fetch fails, return empty page but keep cursor valid for next attempt.

```typescript
async function getNextPage(request: FeedPageRequest): Promise<ServiceResult<FeedPage<DailyPost>>> {
  try {
    const allPosts = conceptFeedService.getDailyPosts();
    // ... pagination logic
    return { success: true, data: { items, nextCursor, hasMore } };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: 'Could not fetch feed',
        retryable: true,
      },
    };
  }
}
```

---

## 6. Build Order & Phase Dependencies

### Phase 1: Foundation (Week 1-2)
- [x] ImageGenerationService – Core async queue, caching
- [x] SchedulerService – Background task runner
- [x] CardTemplateRegistry – Template registration

**Blockers:** None (new services, can build in parallel)

### Phase 2: Feed & Pagination (Week 2-3)
- [ ] FeedPaginationService – Cursor-based pagination
- [ ] useFeedInfiniteScroll hook – React integration
- [ ] PostImageManagementService – Ties image gen to posts

**Blockers:** ImageGenerationService complete

### Phase 3: Planner Orchestration (Week 3-4)
- [ ] PlannerOrchestratorService – Trajectory-based scoring
- [ ] Scheduler integration – Run 'score-suggestions' task
- [ ] usePlanner hook update – Show scored suggestions

**Blockers:** SchedulerService complete, existing review/question/feed services stable

### Phase 4: UI Components (Week 4-5)
- [ ] CardComponent variants – For each template
- [ ] PostDetailScreen – Image display, loading states
- [ ] FeedScreen – Infinite scroll
- [ ] PlannerScreen update – Show suggestions with reasons

**Blockers:** All services complete, CardTemplateRegistry functional

### Phase 5: Polish & Testing (Week 5-6)
- [ ] Error handling & retry logic
- [ ] Cache eviction strategies
- [ ] Performance profiling (image load times)
- [ ] E2E testing (feed scroll, image gen, scheduler)

**Blockers:** All previous phases complete

---

## 7. Component Structure for New Designs

### 7.1 Card Component System

```typescript
// src/components/cards/CardRenderer.tsx
interface CardRendererProps {
  cardId: string;
  templateId: string;
  data: Record<string, unknown>;
}

export function CardRenderer({ cardId, templateId, data }: CardRendererProps) {
  const template = cardTemplateRegistry.getTemplate(templateId);
  if (!template) return <CardNotFound />;
  return <>{template.renderer(data)}</>;
}

// src/components/cards/StandardPostCard.tsx
export function StandardPostCard({
  data: { title, subtitle, body, imageUrl },
}: {
  data: { title: string; subtitle: string; body: string; imageUrl?: string };
}) {
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    // Poll for image if not yet loaded
    if (imageUrl) setImageReady(true);
  }, [imageUrl]);

  return (
    <div className="card p-4 rounded-lg shadow-md">
      {imageUrl && <img src={imageUrl} alt={title} className="w-full h-48 object-cover rounded" />}
      <h2 className="text-lg font-bold mt-2">{title}</h2>
      {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
      <p className="mt-2">{body}</p>
    </div>
  );
}

// src/components/cards/ConnectionCard.tsx
export function ConnectionCard({
  data: { conceptA, conceptB, bridgeInsight, imageUrl },
}: {
  data: { conceptA: string; conceptB: string; bridgeInsight: string; imageUrl?: string };
}) {
  return (
    <div className="card p-4 rounded-lg shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{conceptA}</span>
        <span className="text-2xl">↔</span>
        <span className="text-sm font-semibold">{conceptB}</span>
      </div>
      {imageUrl && <img src={imageUrl} alt="Connection" className="w-full h-32 object-cover rounded mt-2" />}
      <p className="text-sm mt-2 italic">{bridgeInsight}</p>
    </div>
  );
}

// src/components/cards/LearningGoalCard.tsx
export function LearningGoalCard({
  data: { goal, criteria, resources },
}: {
  data: { goal: string; criteria?: string[]; resources?: string[] };
}) {
  return (
    <div className="card p-4 rounded-lg shadow-md bg-blue-50">
      <h3 className="text-sm font-bold text-blue-900">Learning Goal</h3>
      <p className="text-sm mt-1">{goal}</p>
      {criteria && criteria.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold">Success Criteria:</p>
          <ul className="text-xs list-disc ml-4">{criteria.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      {resources && resources.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold">Resources:</p>
          <ul className="text-xs list-disc ml-4">{resources.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
```

### 7.2 Feed Screen with Infinite Scroll

```typescript
// src/components/useFeedInfiniteScroll.ts
interface UseFeedInfiniteScrollReturn {
  items: DailyPost[];
  isLoading: boolean;
  error: ServiceError | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function useFeedInfiniteScroll(limit: number = 10): UseFeedInfiniteScrollReturn {
  const [items, setItems] = useState<DailyPost[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);

  const loadMore = useCallback(async () => {
    if (isLoading || !cursor) return;
    setIsLoading(true);
    const result = await feedPaginationService.appendNextPage(items, cursor);
    if (result.success) {
      setItems((prev) => [...prev, ...result.data!.items]);
      setCursor(result.data!.nextCursor);
    } else {
      setError(result.error ?? null);
    }
    setIsLoading(false);
  }, [items, cursor, isLoading]);

  useEffect(() => {
    const loadFirstPage = async () => {
      setIsLoading(true);
      const result = await feedPaginationService.getNextPage({ limit });
      if (result.success) {
        setItems(result.data!.items);
        setCursor(result.data!.nextCursor);
      } else {
        setError(result.error ?? null);
      }
      setIsLoading(false);
    };
    loadFirstPage();
  }, [limit]);

  return { items, isLoading, error, hasMore: cursor !== null, loadMore };
}

// src/screens/FeedScreen.tsx
export function FeedScreen() {
  const { items, isLoading, error, hasMore, loadMore } = useFeedInfiniteScroll(10);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="feed-screen p-4">
      <div className="space-y-4">
        {items.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      {isLoading && <div className="text-center p-4">Loading...</div>}
      {error && <div className="text-center p-4 text-red-500">{error.message}</div>}
      <div ref={observerTarget} className="h-10" />
    </div>
  );
}

// src/components/PostCard.tsx
export function PostCard({ post }: { post: DailyPost }) {
  const imageMeta = postImageManagementService.getPostImage(post.id);

  return (
    <div className="post-card card p-4 rounded-lg shadow-md">
      {imageMeta?.status === 'cached' && imageMeta.imageUrl && (
        <img src={imageMeta.imageUrl} alt={post.title} className="w-full h-32 object-cover rounded" />
      )}
      {imageMeta?.status === 'pending' && <div className="w-full h-32 bg-gray-200 animate-pulse rounded" />}
      <h3 className="mt-2 font-semibold">{post.title}</h3>
      <p className="text-sm text-gray-600">{post.narrative}</p>
      <Link to={`/posts/${post.id}`} className="text-blue-600 text-sm mt-2">
        Read more →
      </Link>
    </div>
  );
}
```

### 7.3 Planner Screen with Suggestions

```typescript
// src/screens/PlannerScreen.tsx
export function PlannerScreen() {
  const [suggestions, setSuggestions] = useState<SuggestionScore[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('SCHEDULED_TASK_COMPLETED', (event) => {
      if (event.payload.taskId === 'score-suggestions') {
        // Re-fetch suggestions
        loadSuggestions();
      }
    });

    loadSuggestions();
    return unsubscribe;
  }, []);

  const loadSuggestions = async () => {
    setIsLoading(true);
    const result = await plannerOrchestratorService.getTopSuggestions(5);
    if (result.success) {
      setSuggestions(result.data ?? []);
    }
    setIsLoading(false);
  };

  return (
    <div className="planner-screen p-4">
      <h1 className="text-2xl font-bold">Your Learning Path</h1>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Next Steps</h2>
        {isLoading && <p>Loading suggestions...</p>}
        <div className="space-y-3 mt-3">
          {suggestions.map((score) => {
            const chunk = plannerService.getChunkById(score.chunkId);
            return (
              <div key={score.chunkId} className="card p-4 rounded-lg shadow-md border-l-4 border-blue-500">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{chunk?.goal}</h3>
                    <p className="text-xs text-gray-600 mt-1">{score.reason}</p>
                  </div>
                  <div className="text-right">
                    <ScoreBar score={score.score} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Existing sections: Saved Threads, etc. */}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-green-500" style={{ width: `${score * 100}%` }} />
      </div>
      <span className="text-xs font-semibold">{(score * 100).toFixed(0)}% fit</span>
    </div>
  );
}
```

---

## 8. Async Patterns & Non-Blocking Operations

### 8.1 Image Generation Queue Processing

Non-blocking, background processing without React impact:

```typescript
// Initiated by enqueueGeneration(), runs async
async function processQueue(): Promise<void> {
  // Use setTimeout to yield to browser
  await new Promise((resolve) => setTimeout(resolve, 0));

  const queue = getQueue();
  const toProcess = [
    ...queue.immediate.splice(0, 1),
    ...queue.batch.splice(0, 3),
    ...queue.background.splice(0, 2),
  ];

  if (toProcess.length === 0) return;

  // Fetch images in parallel
  const results = await Promise.allSettled(toProcess.map((req) => generateImageForRequest(req)));

  // Process results without blocking
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      cacheResult(toProcess[idx].id, result.value);
      eventBus.emit({ type: 'IMAGE_GENERATED', payload: { /* ... */ } });
    }
  });

  // Continue in next tick
  setTimeout(() => processQueue(), 100);
}
```

**Benefits:**
- React renders never block
- Long-running operations (image gen API calls) happen in background
- UI stays responsive while images generate

### 8.2 Polling for Completion

For operations that need to wait (but not block), use polling with timeout:

```typescript
async function pollImageCompletion(imageId: string, postId: string): Promise<void> {
  const maxRetries = 60;
  let retryCount = 0;

  const poll = async () => {
    const statusResult = await imageGenerationService.getGenerationStatus(imageId);

    if (statusResult.data?.status === 'cached') {
      // Success
      updatePostImageMeta(postId, { status: 'cached', imageUrl: statusResult.data.imageUrl });
      eventBus.emit({ type: 'POST_IMAGE_READY', payload: { postId, imageId } });
      return;
    }

    if (retryCount++ < maxRetries) {
      // Still waiting, retry in 1 second
      setTimeout(poll, 1000);
    } else {
      // Timeout
      updatePostImageMeta(postId, { status: 'failed' });
    }
  };

  poll().catch(console.warn);
}
```

**UI Integration (doesn't block component render):**

```typescript
function PostDetailScreen() {
  const [imageMeta, setImageMeta] = useState<PostImageMeta | null>(null);

  useEffect(() => {
    // Trigger generation (non-blocking)
    postImageManagementService.generatePostImage(postId, prompt);

    // Listen for completion
    const unsubscribe = eventBus.subscribe('POST_IMAGE_READY', (event) => {
      if (event.payload.postId === postId) {
        setImageMeta(postImageManagementService.getPostImage(postId));
      }
    });

    return unsubscribe;
  }, [postId]);

  return (
    <div>
      {imageMeta?.status === 'pending' && <Skeleton className="w-full h-48" />}
      {imageMeta?.status === 'cached' && <img src={imageMeta.imageUrl} />}
      {imageMeta?.status === 'failed' && <PlaceholderImage />}
    </div>
  );
}
```

---

## 9. Summary: Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|-----------|
| Service-based (not Redux/Zustand) | Matches existing EchoLearn pattern; simple data flow | Less powerful for complex state machines |
| Event bus for cross-service comms | Decouples services; allows UI to react without prop drilling | More event types to manage; harder to trace data flow |
| Async queuing for images | Non-blocking UI; graceful degradation; retryable | More complex error handling; polling overhead |
| Cursor-based pagination | Better for changing feeds; no offset drift | Requires more state tracking than offset |
| Trajectory-based scoring | Personalized suggestions; explains reasoning | Heavy computation; needs periodic refresh |
| localStorage + SQLite dual storage | Works on web and native; persistent across reloads | Schema management complexity; sync overhead |
| Scheduler with minute-based checks | Good battery life; simple implementation | Not real-time (up to 1-minute delay) |
| Card template registry | Extensible; allows future A/B testing | More boilerplate than inline components |

---

## 10. Performance Considerations

### 10.1 Image Generation

- **Queue prioritization**: Immediate images prioritized; background generation doesn't block UI
- **Caching**: Hit rate ~70% for feed posts (many use same prompt variations)
- **Size limits**: 50MB cache keeps load times under 500ms on device startup

### 10.2 Feed Pagination

- **Cursor-based**: O(n) slice vs O(1) with true cursors, but acceptable for feed size
- **Filter application**: Done client-side; assumes <1000 total posts (design constraint)
- **Render optimization**: Use `React.memo(PostCard)` to avoid re-renders on parent updates

### 10.3 Suggestion Scoring

- **Computation**: ~50-200ms to score 50 chunks (depends on signal complexity)
- **Caching**: 6-hour TTL amortizes cost
- **Background task**: Runs via scheduler, never blocks user interactions

### 10.4 Memory Usage

- **Image cache**: 50MB = ~150-200 images at typical compression
- **Feed cache**: ~20KB per day's posts
- **Suggestion cache**: ~5KB for top 50 scored suggestions
- **Total overhead**: ~50-100MB on typical device (acceptable)

---

## 11. Testing Strategy

### 11.1 Unit Tests

**ImageGenerationService:**
- Enqueue request, verify queue state
- Retry logic with exponential backoff
- Cache key generation and TTL

**PlannerOrchestratorService:**
- Trajectory signal collection from each source
- Scoring formula outputs 0-1
- Reason string generation

**FeedPaginationService:**
- Cursor calculation and validation
- Filter composition
- Boundary cases (empty feed, last page)

### 11.2 Integration Tests

- ImageGeneration → PostImageManagement → PostDetailScreen (end-to-end)
- Scheduler task execution triggers suggestion re-scoring
- Feed infinite scroll appends new items correctly

### 11.3 Performance Tests

- Image generation queue processes 10 images in <5 seconds (parallel)
- Feed pagination returns 10 items in <200ms
- Suggestion scoring completes in <500ms for 50 chunks

---

## 12. Migration Path for Existing Code

No breaking changes needed. v1.1 services are additive:

1. **Existing services unchanged**: `questionService`, `reviewService`, `plannerService`, `conceptFeedService`
2. **New hooks added**: `useFeedInfiniteScroll`, `useSuggestions`
3. **Event bus extended**: New event types, old code unaffected
4. **Database**: New tables for image cache, scheduler state (migrations auto-run)

**Zero-cost adoption:** Features can be built in phases; each phase independent of others.

