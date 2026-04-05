import { useState, useEffect, useCallback } from 'react';
import type { Question, ServiceError, SessionMessage } from '../types';
import { questionService } from '../services/question.service';
import { settingsService } from '../services/settings.service';
import { chatStream } from '../providers/llm';
import { today } from '../lib/date';
import { buildCandidateContextPack, classifyAndAnchor, formatCandidateContextPack } from '../services/canonical-knowledge.service';
import { evaluateQuestion as filterQuestion, type QuestionFilterContext } from '../services/question-filter.service';
import { eventBus } from '../lib/event-bus';
import { webSearch } from '../services/web-search.service';

const WEB_SEARCH_TOOL_PROMPT = `
You have access to a web search tool. When a question requires current/real-time information, recent events, up-to-date facts, or verification of claims, output exactly:
[TOOL:web_search]{"query": "your search query here"}

Rules:
- Only invoke the tool when the question genuinely needs current information
- After receiving search results, synthesize them into your answer
- Include numbered citations [1][2] referencing the sources
- List sources at the end in this format:
  Sources:
  [1] [Title](URL)
  [2] [Title](URL)
- Do NOT invoke the tool for conceptual/theoretical questions you can answer from training
`;

const TOOL_PATTERN = /\[TOOL:web_search\]\s*(\{[^}]+\})/;

interface UseQuestionsReturn {
  questions: Question[];
  isAsking: boolean;
  isLoading: boolean;
  error: ServiceError | null;
  ask: (content: string) => Promise<Question | null>;
  askStreaming: (content: string, onToken: (accumulated: string) => void, sessionContext?: QuestionFilterContext, sessionHistory?: SessionMessage[], webSearchEnabled?: boolean) => Promise<Question | null>;
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
      const result = await questionService.getRecent(50);
      if (result.success && result.data) {
        setQuestions(result.data);
      }
      setIsLoading(false);
    };
    load();

    // Sync with questions created by OTHER hook instances (e.g. AskScreen's
    // useQuestions adds a question, HomeScreen's instance needs to know).
    const unsub = eventBus.subscribe('QUESTION_ASKED', (event) => {
      setQuestions((prev) => [event.payload, ...prev.filter((q) => q.id !== event.payload.id)]);
    });
    return unsub;
  }, []);

  const ask = useCallback(async (content: string): Promise<Question | null> => {
    setIsAsking(true);
    setError(null);
    const result = await questionService.ask(content);
    if (result.success && result.data) {
      setQuestions((prev) => [result.data!.question, ...prev.filter((q) => q.id !== result.data!.question.id)]);
      setIsAsking(false);
      return result.data.question;
    } else {
      setError(result.error ?? null);
      setIsAsking(false);
      return null;
    }
  }, []);

  const askStreaming = useCallback(
    async (content: string, onToken: (accumulated: string) => void, sessionContext?: QuestionFilterContext, sessionHistory?: SessionMessage[], webSearchEnabled?: boolean): Promise<Question | null> => {
      setIsAsking(true);
      setError(null);

      const settings = settingsService.getSync();
      const llmConfig = settings.llm;

      if (!settings.preferences.aiConsentGiven) {
        const msg = 'AI features are disabled. Go to Settings → Privacy & Data and enable "AI Data Transmission" to use AI responses.';
        onToken(msg);
        setError({ code: 'NOT_CONFIGURED', message: msg, retryable: false });
        setIsAsking(false);
        return null;
      }

      if (!llmConfig.isConfigured) {
        const msg = 'Add your API key in Settings to get AI responses.';
        onToken(msg);
        setError({ code: 'NOT_CONFIGURED', message: msg, retryable: false });
        setIsAsking(false);
        return null;
      }

      try {
        const store = questionService.getAll();
        const candidatePack = buildCandidateContextPack(content, store);

        const systemPrompt = [
          'You are a knowledgeable learning assistant. Answer questions clearly and thoroughly.',
          'Do not generate harmful, illegal, sexually explicit, or deceptive content.',
          `Knowledge graph candidate context:\n${formatCandidateContextPack(candidatePack)}`,
          WEB_SEARCH_TOOL_PROMPT,
        ]
          .filter(Boolean)
          .join('\n');

        // Convert SessionMessage[] to ChatMessage[] for the LLM (append-only for KV-cache)
        const historyMessages: { role: 'user' | 'assistant'; content: string }[] =
          (sessionHistory ?? []).map((m) => ({
            role: m.type === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.content,
          }));

        // --- Pass 1: Stream LLM response ---
        let accumulated = '';
        const stream = chatStream(
          [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            { role: 'user', content },
          ],
          llmConfig,
          { serviceName: 'ask' },
        );

        for await (const token of stream) {
          accumulated += token;
          onToken(accumulated);
        }

        // --- Check for tool invocation OR forced web search ---
        const toolMatch = accumulated.match(TOOL_PATTERN);
        const needsSearch = webSearchEnabled || toolMatch;

        if (needsSearch) {
          // Determine search query
          let searchQuery = content; // default: use the user's question
          if (toolMatch) {
            try {
              const parsed = JSON.parse(toolMatch[1]);
              if (parsed.query) searchQuery = parsed.query;
            } catch { /* use default */ }
          }

          // Show searching indicator
          onToken('Searching the web...');

          const searchResult = await webSearch(searchQuery);

          if (searchResult.success && searchResult.data) {
            // Format search results for injection
            const searchContext = searchResult.data.results
              .slice(0, 5)
              .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}\nURL: ${r.url}`)
              .join('\n\n');

            // --- Pass 2: Re-prompt with search results ---
            accumulated = '';
            const stream2 = chatStream(
              [
                { role: 'system', content: systemPrompt },
                ...historyMessages,
                { role: 'user', content },
                {
                  role: 'assistant',
                  content: 'I searched the web for relevant information. Let me provide an answer based on the search results.',
                },
                {
                  role: 'user',
                  content: `Web search results for "${searchQuery}":\n\n${searchContext}\n\nUsing these search results, provide a comprehensive answer to my original question. Include numbered citations [1][2] etc. referencing the sources, and list them at the end under "Sources:" with format [N] [Title](URL).`,
                },
              ],
              llmConfig,
              { serviceName: 'ask' },
            );

            for await (const token of stream2) {
              accumulated += token;
              onToken(accumulated);
            }
          }
          // If search failed, keep the original response (minus the tool marker)
          else if (toolMatch) {
            accumulated = accumulated.replace(TOOL_PATTERN, '').trim();
            onToken(accumulated);
          }
        }

        // Persist and get structured question
        const rawQuestion = questionService.buildAndSave(content, accumulated, store);

        // Evaluate for off-topic/meta status (with session context for follow-up handling)
        const question = await filterQuestion(rawQuestion, sessionContext);

        // Persist the flagged status back to store if it changed
        if (question.flagged !== rawQuestion.flagged) {
          questionService.patchQuestion(question.id, { flagged: question.flagged });
          // Re-broadcast with the correct flagged status so other useQuestions instances
          // (e.g. HomeScreen) replace their copy before feed re-generation runs.
          // buildAndSave already fired QUESTION_ASKED without flagged set, so any
          // hook that received that event will still have the unflagged version.
          eventBus.emit({ type: 'QUESTION_ASKED', payload: question });
        }

        // ── Second classification call (Phase 14) ──────────────────────────────
        // Fire ONLY when Q&A enters the mindmap (not flagged).
        if (question.flagged !== true) {
          void classifyAndAnchor(question, questionService.getAll(), llmConfig).catch((err: unknown) => {
            console.warn('[EchoLearn] classifyAndAnchor failed:', err instanceof Error ? err.message : err);
          });
        }

        setQuestions((prev) => [question, ...prev.filter((q) => q.id !== question.id)]);
        setIsAsking(false);
        return question;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        onToken(msg);
        setError({ code: 'NETWORK_ERROR', message: msg, retryable: true });
        setIsAsking(false);
        return null;
      }
    },
    [],
  );

  const getByDate = useCallback(
    (date: string): Question[] => questions.filter((q) => q.date === date),
    [questions],
  );

  const getRecent = useCallback((n: number): Question[] => questions.slice(0, n), [questions]);

  const getById = useCallback(
    (id: string): Question | undefined => questions.find((q) => q.id === id),
    [questions],
  );

  return { questions, isAsking, isLoading, error, ask, askStreaming, getByDate, getRecent, getById };
}

export function useTodayQuestions() {
  const { getByDate } = useQuestions();
  return getByDate(today());
}
