import { useState, useEffect, useCallback } from 'react';
import type { Question, ServiceError } from '../types';
import { mockQuestionService } from '../services/mock/question.mock';
import { today } from '../lib/date';

interface UseQuestionsReturn {
  questions: Question[];
  isAsking: boolean;
  isLoading: boolean;
  error: ServiceError | null;
  ask: (content: string) => Promise<Question | null>;
  getByDate: (date: string) => Question[];
  getRecent: (n: number) => Question[];
  getById: (id: string) => Question | undefined;
}

export function useQuestions(): UseQuestionsReturn {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);

  useEffect(() => {
    const load = async () => {
      const result = await mockQuestionService.getRecent(50);
      if (result.success && result.data) {
        setQuestions(result.data);
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const ask = useCallback(async (content: string): Promise<Question | null> => {
    setIsAsking(true);
    setError(null);
    const result = await mockQuestionService.ask(content);
    if (result.success && result.data) {
      setQuestions((prev) => [result.data!.question, ...prev]);
      setIsAsking(false);
      return result.data.question;
    } else {
      setError(result.error ?? null);
      setIsAsking(false);
      return null;
    }
  }, []);

  const getByDate = useCallback((date: string): Question[] => {
    return questions.filter((q) => q.date === date);
  }, [questions]);

  const getRecent = useCallback((n: number): Question[] => {
    return questions.slice(0, n);
  }, [questions]);

  const getById = useCallback((id: string): Question | undefined => {
    return questions.find((q) => q.id === id);
  }, [questions]);

  return { questions, isAsking, isLoading, error, ask, getByDate, getRecent, getById };
}

export function useTodayQuestions() {
  const { getByDate } = useQuestions();
  return getByDate(today());
}
