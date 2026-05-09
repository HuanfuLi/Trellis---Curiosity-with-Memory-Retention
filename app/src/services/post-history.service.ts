// Post history service — 7-day rolling post history with day grouping (Phase 31, D-12/D-13).
// Stores all displayed posts with dedup, supports configurable retention purge.

import type { DailyPost } from '../types/index.ts';
import { settingsService } from './settings.service.ts';
import { engagementService } from './engagement.service.ts';

const STORAGE_KEY = 'trellis_post_history';

function loadPosts(): DailyPost[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p: Record<string, unknown>) =>
      p && typeof p.id === 'string' && typeof p.generatedAt === 'number' && typeof p.title === 'string'
    );
  } catch {
    return [];
  }
}

function savePosts(posts: DailyPost[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch {
    // localStorage quota exceeded — silently drop
  }
}

export const postHistoryService = {
  /** Add a post to history (deduplicates by id). */
  addPost(post: DailyPost): void {
    const posts = loadPosts();
    if (posts.some(p => p.id === post.id)) return; // dedup
    posts.push(post);
    savePosts(posts);
  },

  /** Get all posts, sorted by generatedAt descending. */
  getPosts(): DailyPost[] {
    return loadPosts().sort((a, b) => b.generatedAt - a.generatedAt);
  },

  /** Group posts by date string, each group sorted by generatedAt desc. */
  getPostsByDay(): Map<string, DailyPost[]> {
    const posts = this.getPosts();
    const grouped = new Map<string, DailyPost[]>();
    for (const post of posts) {
      const day = post.date || new Date(post.generatedAt || Date.now()).toISOString().slice(0, 10);
      const arr = grouped.get(day) || [];
      arr.push(post);
      grouped.set(day, arr);
    }
    return grouped;
  },

  /** Purge posts older than the configured retention window. Respects keepAll (null). */
  purgeExpired(): void {
    const settings = settingsService.getSync();
    const retentionDays = settings.feed?.postRetentionDays;
    if (retentionDays == null || retentionDays <= 0) return; // keep all
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    // Phase 39 D-04: pin saved/liked posts against retention purge so a post
    // saved >retentionDays ago is not silently dropped from the snapshot store.
    // engagementService.getPinnedIds() returns saved ∪ liked (NOT dismissed).
    const pinned = engagementService.getPinnedIds();
    const posts = loadPosts().filter(p => pinned.has(p.id) || p.generatedAt > cutoff);
    savePosts(posts);
  },

  /** Clear all post history. */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
