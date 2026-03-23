import { useState, useCallback } from 'react';
import type { PlannerChunk, PlannerThread, LearningCheckIn, ChunkStatus } from '../types';
import { plannerService } from '../services/planner.service';

interface UsePlannerReturn {
  // Data
  continueChunks: PlannerChunk[];
  suggestedChunks: PlannerChunk[];
  savedChunks: PlannerChunk[];
  savedThreads: PlannerThread[];
  recentCheckIns: LearningCheckIn[];
  isLoading: boolean;

  // Actions
  refresh: () => void;
  updateChunkStatus: (chunkId: string, status: ChunkStatus) => void;
  deleteChunk: (chunkId: string) => void;
  toggleThreadSaved: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
  submitCheckIn: (content: string) => Promise<LearningCheckIn>;
}

export function usePlanner(): UsePlannerReturn {
  const [continueChunks, setContinueChunks] = useState<PlannerChunk[]>([]);
  const [suggestedChunks, setSuggestedChunks] = useState<PlannerChunk[]>([]);
  const [savedChunks, setSavedChunks] = useState<PlannerChunk[]>([]);
  const [savedThreads, setSavedThreads] = useState<PlannerThread[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<LearningCheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(() => {
    const cont = plannerService.getContinueChunks();
    // Split continue chunks: in_progress go to continue, suggested go to suggestions
    setContinueChunks(cont.filter((c) => c.status === 'in_progress'));
    setSuggestedChunks(cont.filter((c) => c.status === 'suggested'));
    setSavedChunks(plannerService.getSavedChunks());
    setSavedThreads(plannerService.getSavedThreads());
    setRecentCheckIns(plannerService.getCheckIns().slice(-10).reverse());
  }, []);

  const updateChunkStatus = useCallback((chunkId: string, status: ChunkStatus) => {
    plannerService.updateChunkStatus(chunkId, status);
    refresh();
  }, [refresh]);

  const deleteChunk = useCallback((chunkId: string) => {
    plannerService.deleteChunk(chunkId);
    refresh();
  }, [refresh]);

  const toggleThreadSaved = useCallback((threadId: string) => {
    plannerService.toggleThreadSaved(threadId);
    refresh();
  }, [refresh]);

  const deleteThread = useCallback((threadId: string) => {
    plannerService.deleteThread(threadId);
    refresh();
  }, [refresh]);

  const submitCheckIn = useCallback(async (content: string): Promise<LearningCheckIn> => {
    setIsLoading(true);
    try {
      const checkIn = await plannerService.submitCheckIn(content);
      refresh();
      return checkIn;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  return {
    continueChunks, suggestedChunks, savedChunks, savedThreads, recentCheckIns,
    isLoading,
    refresh, updateChunkStatus, deleteChunk, toggleThreadSaved, deleteThread, submitCheckIn,
  };
}
