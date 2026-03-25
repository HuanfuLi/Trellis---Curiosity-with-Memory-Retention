import type { ChatSession, DailyPost, SessionOrigin } from '../types';
import { eventBus } from '../lib/event-bus';
import { toast } from '../lib/toast';
import { conceptFeedService } from './concept-feed.service';

const SESSIONS_KEY = 'echolearn_sessions';
const ACTIVE_ID_KEY = 'echolearn_active_session';

let idCounter = Date.now();
function newId(): string {
  return `sess-${++idCounter}`;
}

function loadAll(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatSession[];
  } catch (e) {
    toast('Failed to load chat history — data may be corrupted.', 'error');
    console.error('sessionService.loadAll:', e);
    return [];
  }
}

function saveAll(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      toast('Storage full — chat history may not be saved. Clear old data in Settings.', 'error');
    }
  }
}

export const sessionService = {
  getAll(): ChatSession[] {
    return loadAll().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  getById(id: string): ChatSession | null {
    return loadAll().find((s) => s.id === id) ?? null;
  },

  getActive(): ChatSession {
    const activeId = this.getActiveId();
    if (activeId) {
      const session = this.getById(activeId);
      if (session) return session;
    }
    return this.createNew();
  },

  save(session: ChatSession): void {
    const all = loadAll();
    const idx = all.findIndex((s) => s.id === session.id);
    const updated = { ...session, updatedAt: Date.now() };
    if (idx !== -1) {
      all[idx] = updated;
    } else {
      all.unshift(updated);
    }
    saveAll(all);
    eventBus.emit({ type: 'SESSION_UPDATED', payload: { id: session.id } });
  },

  setActiveId(id: string): void {
    try {
      localStorage.setItem(ACTIVE_ID_KEY, id);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        toast('Storage full — unable to track active session.', 'error');
      }
    }
  },

  getActiveId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_ID_KEY);
    } catch {
      return null;
    }
  },

  createNew(origin?: SessionOrigin): ChatSession {
    const now = Date.now();
    const session: ChatSession = {
      id: newId(),
      title: '',
      createdAt: now,
      updatedAt: now,
      messages: [],
      processed: false,
      ...(origin ? { origin } : {}),
    };
    // Do NOT persist until first message — prevents empty sessions in history
    this.setActiveId(session.id);
    eventBus.emit({ type: 'SESSION_CREATED', payload: session });
    return session;
  },

  getOrCreatePostSession(post: DailyPost, allQuestions: Parameters<typeof conceptFeedService.buildPostOriginContext>[1]): ChatSession {
    const existing = this.getAll().find((session) => session.origin?.type === 'post' && session.origin.postId === post.id);
    if (existing) {
      this.setActiveId(existing.id);
      return existing;
    }

    const origin: SessionOrigin = {
      type: 'post',
      postId: post.id,
      postTitle: post.title,
      context: conceptFeedService.buildPostOriginContext(post, allQuestions),
    };
    const session = this.createNew(origin);
    session.title = `Post: ${post.title}`;
    return session;
  },

  delete(id: string): void {
    saveAll(loadAll().filter((s) => s.id !== id));
    if (this.getActiveId() === id) {
      try {
        localStorage.removeItem(ACTIVE_ID_KEY);
      } catch {
        // ignore
      }
    }
  },
};
