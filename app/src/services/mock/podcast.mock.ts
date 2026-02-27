import type { DailyPodcast, ServiceResult } from '../../types';
import { today, addDays } from '../../lib/date';
import { eventBus } from '../../lib/event-bus';

let podcastIdCounter = 400;
function newPodcastId(): string { return `pod-${++podcastIdCounter}`; }

const t = today();

const seedPodcasts: DailyPodcast[] = [
  {
    id: 'pod-1',
    date: addDays(t, -1),
    questionIds: ['q-1', 'q-2'],
    script: `Welcome to your daily EchoLearn podcast! Today we review two fascinating topics you explored recently.\n\nFirst, dialectical materialism — Marx and Engels developed this philosophy by combining Hegelian dialectics with a materialist worldview. The core idea is that reality is fundamentally material, and change happens through the conflict and resolution of opposing forces.\n\nSecond, quantum entanglement — one of the most counterintuitive phenomena in physics. When particles become entangled, measuring one instantaneously affects the other, regardless of distance. Einstein called this "spooky action at a distance."\n\nBoth topics illustrate how deep theoretical frameworks can reshape our understanding of the world. Keep questioning, keep learning!`,
    audioPath: undefined,
    duration: 180,
    status: 'ready',
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'pod-2',
    date: addDays(t, -2),
    questionIds: ['q-3', 'q-4'],
    script: `Today's podcast covers machine learning fundamentals.\n\nBackpropagation is the algorithm that powers neural network learning. By computing gradients of the loss function with respect to each weight and propagating them backward, the network iteratively improves its predictions.\n\nWe also explored the distinction between supervised and unsupervised learning. Supervised learning requires labeled data; unsupervised learning discovers hidden patterns without labels. Understanding when to use each approach is key to building effective ML systems.`,
    audioPath: undefined,
    duration: 150,
    status: 'ready',
    createdAt: Date.now() - 86400000 * 2,
  },
];

let store: DailyPodcast[] = [...seedPodcasts];

export const mockPodcastService = {
  async getPodcast(date: string): Promise<ServiceResult<DailyPodcast | null>> {
    const pod = store.find((p) => p.date === date);
    return { success: true, data: pod ?? null };
  },

  async getPodcasts(limit = 20): Promise<ServiceResult<DailyPodcast[]>> {
    const sorted = [...store].sort((a, b) => b.createdAt - a.createdAt);
    return { success: true, data: sorted.slice(0, limit) };
  },

  async generatePodcast(date: string): Promise<ServiceResult<DailyPodcast>> {
    const existing = store.find((p) => p.date === date);
    if (existing && existing.status === 'ready') {
      return { success: true, data: existing };
    }

    const id = newPodcastId();
    const pod: DailyPodcast = {
      id,
      date,
      questionIds: ['q-1', 'q-2', 'q-3'],
      script: '',
      status: 'generating',
      progress: 0,
      createdAt: Date.now(),
    };

    store = [pod, ...store.filter((p) => p.date !== date)];
    eventBus.emit({ type: 'PODCAST_GENERATION_STARTED', payload: { podcastId: id, date } });

    // Simulate generation with progress
    const steps = [20, 40, 60, 80, 100];
    let stepIdx = 0;
    const interval = setInterval(() => {
      const progress = steps[stepIdx++];
      const podRef = store.find((p) => p.id === id);
      if (podRef) podRef.progress = progress;
      eventBus.emit({ type: 'PODCAST_GENERATION_PROGRESS', payload: { podcastId: id, progress } });

      if (stepIdx >= steps.length) {
        clearInterval(interval);
        if (podRef) {
          podRef.status = 'ready';
          podRef.progress = 100;
          podRef.script = `Welcome to today's EchoLearn podcast for ${date}!\n\nToday we review your recent questions and reinforce key concepts from your learning sessions. The topics covered include quantum physics, machine learning fundamentals, and philosophical frameworks.\n\nRemember: spaced repetition is the key to long-term retention. Keep reviewing, keep growing!`;
          podRef.duration = 120;
          eventBus.emit({ type: 'PODCAST_GENERATION_COMPLETED', payload: { ...podRef } });
        }
      }
    }, 600);

    return { success: true, data: pod };
  },

  async retryGeneration(podcastId: string): Promise<ServiceResult<DailyPodcast>> {
    const pod = store.find((p) => p.id === podcastId);
    if (!pod) return { success: false, error: { code: 'NOT_FOUND', message: 'Podcast not found', retryable: false } };
    return this.generatePodcast(pod.date);
  },

  getAudioPath(podcastId: string): ServiceResult<string> {
    const pod = store.find((p) => p.id === podcastId);
    if (!pod?.audioPath) return { success: false, error: { code: 'NOT_FOUND', message: 'No audio file', retryable: false } };
    return { success: true, data: pod.audioPath };
  },

  async deletePodcast(podcastId: string): Promise<ServiceResult<void>> {
    store = store.filter((p) => p.id !== podcastId);
    return { success: true };
  },

  getAll(): DailyPodcast[] {
    return store;
  },
};
