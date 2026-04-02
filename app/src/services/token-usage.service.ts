// ─── Token Usage Service ──────────────────────────────────────────────────────
//
// Pluggable token usage reporter. LocalTokenUsageReporter persists to
// localStorage with FIFO eviction at 500 records.
// Replace `tokenUsageReporter` export with a remote implementation for
// server-side tracking without touching call sites.

const STORAGE_KEY = 'echolearn_token_usage';
const MAX_RECORDS = 500;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Normalized usage metadata across all providers. */
export interface UsageMetadata {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** A single recorded LLM call with usage data. */
export interface TokenUsageRecord {
  id: string;
  serviceName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** 'openai' | 'claude' | 'gemini' | 'local' | 'lmstudio' */
  provider: string;
  timestamp: number;
}

/** Aggregated token usage for a single service. */
export interface ServiceAggregate {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
}

// ─── Interface ────────────────────────────────────────────────────────────────

/** Pluggable reporter — swap LocalTokenUsageReporter for a remote implementation. */
export interface TokenUsageReporter {
  record(entry: Omit<TokenUsageRecord, 'id' | 'timestamp'>): void;
  getAll(): TokenUsageRecord[];
  getByService(): Record<string, ServiceAggregate>;
  clear(): void;
}

// ─── Local Implementation ─────────────────────────────────────────────────────

export class LocalTokenUsageReporter implements TokenUsageReporter {
  private loadAll(): TokenUsageRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as TokenUsageRecord[];
    } catch {
      return [];
    }
  }

  record(entry: Omit<TokenUsageRecord, 'id' | 'timestamp'>): void {
    try {
      const records = this.loadAll();
      const newRecord: TokenUsageRecord = {
        ...entry,
        id: `tu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      };
      // Prepend and evict oldest records beyond MAX_RECORDS
      const updated = [newRecord, ...records].slice(0, MAX_RECORDS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      // QuotaExceededError or other storage errors — fail silently
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        // Storage full — skip recording
        return;
      }
      // Other unexpected errors
      console.warn('[TokenUsageReporter] Failed to record usage:', err);
    }
  }

  getAll(): TokenUsageRecord[] {
    return this.loadAll();
  }

  getByService(): Record<string, ServiceAggregate> {
    return this.getAll().reduce<Record<string, ServiceAggregate>>((acc, record) => {
      const svc = acc[record.serviceName] ?? {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        callCount: 0,
      };
      svc.promptTokens += record.promptTokens;
      svc.completionTokens += record.completionTokens;
      svc.totalTokens += record.totalTokens;
      svc.callCount += 1;
      acc[record.serviceName] = svc;
      return acc;
    }, {});
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const tokenUsageReporter: TokenUsageReporter = new LocalTokenUsageReporter();
