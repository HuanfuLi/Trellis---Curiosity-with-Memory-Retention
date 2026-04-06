/**
 * Post Store Service — Persistent localStorage store for all generated posts.
 *
 * Posts persist across sessions and app restarts. No daily cache invalidation.
 * Similar pattern to flashcard.service.ts.
 */

import type { DailyPost } from '../types';

const STORE_KEY = 'echolearn_posts_store';

function loadStore(): DailyPost[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyPost[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistStore(posts: DailyPost[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(posts));
  } catch {
    console.warn('[post-store] localStorage write failed');
  }
}

export const postStoreService = {
  getAll(): DailyPost[] {
    return loadStore();
  },

  getById(id: string): DailyPost | null {
    return loadStore().find(p => p.id === id) ?? null;
  },

  save(post: DailyPost): void {
    const store = loadStore();
    const idx = store.findIndex(p => p.id === post.id);
    if (idx >= 0) {
      store[idx] = post;
    } else {
      store.unshift(post); // newest first
    }
    persistStore(store);
  },

  saveBatch(posts: DailyPost[]): void {
    if (posts.length === 0) return;
    const store = loadStore();
    const existingIds = new Set(store.map(p => p.id));
    const newPosts = posts.filter(p => !existingIds.has(p.id));
    const updated = [...newPosts, ...store]; // newest first
    persistStore(updated);
  },

  /** Update a post in-place (e.g., patch essay content after streaming). */
  patch(id: string, fields: Partial<DailyPost>): void {
    const store = loadStore();
    const idx = store.findIndex(p => p.id === id);
    if (idx >= 0) {
      store[idx] = { ...store[idx], ...fields };
      persistStore(store);
    }
  },

  deleteById(id: string): void {
    const store = loadStore();
    persistStore(store.filter(p => p.id !== id));
  },
};
