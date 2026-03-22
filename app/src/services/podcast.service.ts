import type { DailyPodcast, ServiceResult } from '../types';
import { eventBus } from '../lib/event-bus';
import { toast } from '../lib/toast';
import { mockSettingsService } from './mock/settings.mock';
import { questionService } from './question.service';
import { chatCompletion } from '../providers/llm';
import { synthesize } from '../providers/tts';

const STORAGE_KEY = 'echolearn_podcasts';
const audioBlobUrls = new Map<string, string>();

let podcastIdCounter = Date.now();
function newPodcastId(): string {
  return `pod-${++podcastIdCounter}`;
}

// Convert a blob URL to a base64 data URI for persistent storage.
async function blobUrlToDataUri(blobUrl: string): Promise<string> {
  const resp = await fetch(blobUrl);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Reconstruct a blob URL from a base64 data URI.
function dataUriToBlobUrl(dataUri: string): string {
  const [header, base64] = dataUri.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] ?? 'audio/mpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

function loadStore(): DailyPodcast[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const podcasts = JSON.parse(raw) as DailyPodcast[];
    // Restore in-memory blob URLs from persisted data URIs so audio works after reload
    for (const p of podcasts) {
      if (p.audioDataUri && !audioBlobUrls.has(p.id)) {
        try {
          audioBlobUrls.set(p.id, dataUriToBlobUrl(p.audioDataUri));
        } catch {
          // Corrupt data URI — ignore; audio will regenerate on next play
        }
      }
    }
    return podcasts;
  } catch {
    return [];
  }
}

function saveStore(podcasts: DailyPodcast[]): void {
  try {
    // Strip in-memory blob URL (audioPath) — it doesn't survive reload.
    // Keep audioDataUri — it's the base64 version that does survive.
    const toSave = podcasts.map((p) => {
      const copy = { ...p };
      delete copy.audioPath;
      return copy;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      toast('Storage full — podcast data may not be saved.', 'error');
    }
  }
}

function patchPodcast(id: string, patch: Partial<DailyPodcast>): DailyPodcast[] {
  const store = loadStore();
  const updated = store.map((p) => (p.id === id ? { ...p, ...patch } : p));
  saveStore(updated);
  return updated;
}

export const podcastService = {
  async getPodcast(date: string): Promise<ServiceResult<DailyPodcast | null>> {
    const pod = loadStore().find((p) => p.date === date);
    return { success: true, data: pod ?? null };
  },

  async getPodcasts(limit = 20): Promise<ServiceResult<DailyPodcast[]>> {
    const sorted = [...loadStore()].sort((a, b) => b.createdAt - a.createdAt);
    return { success: true, data: sorted.slice(0, limit) };
  },

  async generatePodcast(date: string): Promise<ServiceResult<DailyPodcast>> {
    const existing = loadStore().find((p) => p.date === date);

    // Only skip if podcast is ready AND audio blob is available (in-memory or restored from dataUri)
    if (existing?.status === 'ready' && audioBlobUrls.has(existing.id)) {
      return { success: true, data: existing };
    }

    const id = existing?.id ?? newPodcastId();
    const settings = mockSettingsService.getSync();

    // Load questions for date, fall back to 5 most recent
    const byDateResult = await questionService.getByDate(date);
    let questions = byDateResult.data ?? [];
    if (questions.length === 0) {
      const recentResult = await questionService.getRecent(5);
      questions = recentResult.data ?? [];
    }

    const pod: DailyPodcast = {
      id,
      date,
      questionIds: questions.map((q) => q.id),
      script: existing?.script ?? '',
      status: 'generating',
      progress: 0,
      createdAt: existing?.createdAt ?? Date.now(),
    };

    const store = loadStore();
    saveStore([pod, ...store.filter((p) => p.date !== date)]);
    eventBus.emit({ type: 'PODCAST_GENERATION_STARTED', payload: { podcastId: id, date } });

    void (async () => {
      try {
        // Step 1: generate script (30%) — skip LLM if script already exists
        patchPodcast(id, { progress: 30 });
        eventBus.emit({ type: 'PODCAST_GENERATION_PROGRESS', payload: { podcastId: id, progress: 30 } });

        let script: string;
        if (existing?.script) {
          script = existing.script;
        } else if (!settings.llm.isConfigured || questions.length === 0) {
          script = `Welcome to your daily EchoLearn podcast for ${date}! You reviewed ${questions.length} topic(s) today. Keep learning!`;
        } else {
          const questionLines = questions.map((q) => `- ${q.content}: ${q.summary}`).join('\n');
          script = await chatCompletion(
            [
              { role: 'system', content: 'Write a 90-second spoken podcast recap. Conversational radio style. No stage directions, no music cues. Just the words to be spoken.' },
              { role: 'user', content: `Create a daily learning recap for:\n${questionLines}` },
            ],
            settings.llm,
          );
        }

        // Step 2: synthesize audio (80%)
        patchPodcast(id, { progress: 80, script });
        eventBus.emit({ type: 'PODCAST_GENERATION_PROGRESS', payload: { podcastId: id, progress: 80 } });

        // When TTS provider is OpenAI and no dedicated TTS key was entered,
        // fall back to the LLM API key — they share the same OpenAI credentials.
        const effectiveTtsKey =
          settings.tts.apiKey ||
          (settings.tts.provider === 'openai' ? (settings.llm.apiKey ?? '') : '');
        const ttsReady =
          settings.tts.provider === 'openai'
            ? !!effectiveTtsKey
            : settings.tts.isConfigured;
        const ttsConfig = { ...settings.tts, apiKey: effectiveTtsKey };

        let duration: number | undefined;
        let audioDataUri: string | undefined;
        if (ttsReady) {
          try {
            const blobUrl = await synthesize(script, ttsConfig);
            audioBlobUrls.set(id, blobUrl);
            duration = Math.round(script.length / 15);

            // Persist audio as a data URI so it survives page reloads.
            // Skip if too large (> 3 MB as base64) to avoid blowing localStorage quota.
            try {
              const dataUri = await blobUrlToDataUri(blobUrl);
              if (dataUri.length <= 3_000_000) {
                audioDataUri = dataUri;
              }
            } catch {
              // Conversion failed — audio works this session but not after reload
            }
          } catch (ttsErr) {
            // TTS failure is non-fatal — podcast is still ready, but inform the user
            const msg = ttsErr instanceof Error ? ttsErr.message : String(ttsErr);
            toast(
              msg.includes('401') || msg.includes('Unauthorized') || msg.includes('API key')
                ? 'TTS: Invalid API key — check Settings.'
                : `TTS audio failed: ${msg.slice(0, 80)}`,
              'error',
            );
          }
        }

        const completed: DailyPodcast = {
          id,
          date,
          questionIds: questions.map((q) => q.id),
          script,
          status: 'ready',
          progress: 100,
          duration,
          audioDataUri,
          createdAt: pod.createdAt,
        };

        patchPodcast(id, completed);
        eventBus.emit({ type: 'PODCAST_GENERATION_PROGRESS', payload: { podcastId: id, progress: 100 } });
        eventBus.emit({ type: 'PODCAST_GENERATION_COMPLETED', payload: completed });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        patchPodcast(id, { status: 'failed', error });
        eventBus.emit({ type: 'PODCAST_GENERATION_FAILED', payload: { podcastId: id, error } });
      }
    })();

    return { success: true, data: pod };
  },

  async retryGeneration(podcastId: string): Promise<ServiceResult<DailyPodcast>> {
    const pod = loadStore().find((p) => p.id === podcastId);
    if (!pod) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Podcast not found', retryable: false } };
    }
    return this.generatePodcast(pod.date);
  },

  getAudioPath(podcastId: string): ServiceResult<string> {
    const blobUrl = audioBlobUrls.get(podcastId);
    if (!blobUrl) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'No audio available. Regenerate to get audio.', retryable: true },
      };
    }
    return { success: true, data: blobUrl };
  },

  async deletePodcast(podcastId: string): Promise<ServiceResult<void>> {
    const blobUrl = audioBlobUrls.get(podcastId);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      audioBlobUrls.delete(podcastId);
    }
    saveStore(loadStore().filter((p) => p.id !== podcastId));
    return { success: true };
  },

  getAll(): DailyPodcast[] {
    return loadStore();
  },
};
