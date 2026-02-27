import type { Question, ServiceResult, AskResult } from '../../types';
import { today, addDays } from '../../lib/date';
import { eventBus } from '../../lib/event-bus';

let idCounter = 100;
function newId(): string {
  return `q-${++idCounter}`;
}

const t = today();
const yesterday = addDays(t, -1);
const twoDaysAgo = addDays(t, -3);

const seedQuestions: Question[] = [
  {
    id: 'q-1',
    timestamp: Date.now() - 86400000 * 3,
    date: twoDaysAgo,
    content: 'What is dialectical materialism?',
    answer: 'Dialectical materialism is a philosophical approach combining Hegelian dialectics with materialist philosophy, developed by Marx and Engels. It holds that matter is the fundamental reality and that change occurs through the conflict of opposing forces (thesis, antithesis, synthesis). It became the foundational philosophy of Marxism and influenced political theory, economics, and social science.',
    summary: "Marx's philosophical framework combining dialectics with materialism",
    keywords: ['Marx', 'dialectics', 'materialism', 'Hegel', 'philosophy'],
    relatedQuestionIds: ['q-2'],
    categoryIds: ['cat-philosophy'],
    reviewSchedule: { nextReviewDate: t, reviewCount: 1, easeFactor: 2.5 },
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'q-2',
    timestamp: Date.now() - 86400000 * 2,
    date: twoDaysAgo,
    content: 'What is quantum entanglement?',
    answer: 'Quantum entanglement is a phenomenon where two or more particles become correlated such that the quantum state of each particle cannot be described independently of the others, even when separated by large distances. Measuring one particle instantly affects the correlated particle. Einstein famously called this "spooky action at a distance."',
    summary: 'Correlated quantum particles that affect each other regardless of distance',
    keywords: ['quantum', 'entanglement', 'physics', 'Einstein', 'correlation'],
    relatedQuestionIds: ['q-3'],
    categoryIds: ['cat-physics'],
    reviewSchedule: { nextReviewDate: t, reviewCount: 0, easeFactor: 2.5 },
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'q-3',
    timestamp: Date.now() - 86400000,
    date: yesterday,
    content: 'How do neural networks learn through backpropagation?',
    answer: 'Backpropagation is the core learning algorithm for neural networks. It works in two passes: (1) Forward pass — input data flows through the network to produce an output. (2) Backward pass — the error (loss) is computed and gradients are propagated backwards through the network using the chain rule of calculus. These gradients indicate how much each weight contributed to the error, and weights are updated using gradient descent to minimize loss.',
    summary: 'Neural networks learn by propagating error gradients backward through layers',
    keywords: ['neural networks', 'backpropagation', 'gradient descent', 'deep learning'],
    relatedQuestionIds: ['q-4', 'q-5'],
    categoryIds: ['cat-ml'],
    reviewSchedule: { nextReviewDate: addDays(t, 1), reviewCount: 2, easeFactor: 2.6 },
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'q-4',
    timestamp: Date.now() - 86400000,
    date: yesterday,
    content: 'What is the difference between supervised and unsupervised learning?',
    answer: 'Supervised learning trains models on labeled data (input-output pairs), learning to map inputs to known outputs. Examples: classification, regression. Unsupervised learning finds patterns in unlabeled data without predefined outputs. Examples: clustering, dimensionality reduction, generative models. Semi-supervised learning combines both approaches.',
    summary: 'Supervised learning uses labeled data; unsupervised finds patterns without labels',
    keywords: ['supervised learning', 'unsupervised learning', 'machine learning', 'classification'],
    relatedQuestionIds: ['q-3'],
    categoryIds: ['cat-ml'],
    reviewSchedule: { nextReviewDate: t, reviewCount: 0, easeFactor: 2.5 },
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'q-5',
    timestamp: Date.now() - 3600000,
    date: t,
    content: 'What is the second law of thermodynamics?',
    answer: 'The second law of thermodynamics states that the total entropy of an isolated system always increases over time, or remains constant in ideal cases. Entropy is a measure of disorder or randomness. This law explains why heat flows from hot to cold, why engines cannot be 100% efficient, and why many processes are irreversible. It fundamentally establishes the arrow of time.',
    summary: 'Entropy of isolated systems always increases; establishes irreversibility of time',
    keywords: ['thermodynamics', 'entropy', 'heat', 'irreversibility', 'physics'],
    relatedQuestionIds: ['q-2'],
    categoryIds: ['cat-physics'],
    reviewSchedule: { nextReviewDate: addDays(t, 2), reviewCount: 1, easeFactor: 2.4 },
    createdAt: Date.now() - 3600000,
  },
];

let store: Question[] = [...seedQuestions];

const mockAnswers = [
  'Great question! This concept is foundational to understanding the broader field. The key insight is that systems evolve through iterative feedback, where initial conditions shape outcomes in complex, non-linear ways. Research has shown this applies across domains from biology to economics.',
  'This is a fascinating area of study. The core principle involves the interaction between local rules and emergent global behavior. When individual components follow simple rules, surprisingly complex patterns arise at the system level — a phenomenon known as emergence.',
  'The answer involves understanding the interplay between structure and function. At the microscopic level, individual components behave according to well-defined rules. At the macroscopic level, these interactions produce properties that cannot be predicted from individual components alone.',
];

export const mockQuestionService = {
  async ask(content: string): Promise<ServiceResult<AskResult>> {
    await new Promise((r) => setTimeout(r, 1200));

    const answerIndex = Math.floor(Math.random() * mockAnswers.length);
    const relatedIds = store.slice(-2).map((q) => q.id);

    const question: Question = {
      id: newId(),
      timestamp: Date.now(),
      date: today(),
      content,
      answer: mockAnswers[answerIndex],
      summary: content.length > 60 ? content.slice(0, 57) + '...' : content,
      keywords: content.split(' ').slice(0, 4),
      relatedQuestionIds: relatedIds,
      categoryIds: ['cat-general'],
      reviewSchedule: {
        nextReviewDate: addDays(today(), 1),
        reviewCount: 0,
        easeFactor: 2.5,
      },
      createdAt: Date.now(),
    };

    store = [question, ...store];
    eventBus.emit({ type: 'QUESTION_ASKED', payload: question });

    const relatedQuestions = store.filter((q) => relatedIds.includes(q.id)).slice(0, 2);

    return {
      success: true,
      data: { question, relatedQuestions, newConnections: relatedIds.length },
    };
  },

  async getById(id: string): Promise<ServiceResult<Question>> {
    const q = store.find((q) => q.id === id);
    if (!q) return { success: false, error: { code: 'NOT_FOUND', message: 'Question not found', retryable: false } };
    return { success: true, data: q };
  },

  async getByDate(date: string): Promise<ServiceResult<Question[]>> {
    return { success: true, data: store.filter((q) => q.date === date) };
  },

  async getRecent(limit: number): Promise<ServiceResult<Question[]>> {
    return { success: true, data: store.slice(0, limit) };
  },

  async search(query: string): Promise<ServiceResult<Question[]>> {
    const q = query.toLowerCase();
    return {
      success: true,
      data: store.filter((item) =>
        item.content.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q)
      ),
    };
  },

  async delete(id: string): Promise<ServiceResult<void>> {
    store = store.filter((q) => q.id !== id);
    eventBus.emit({ type: 'QUESTION_DELETED', payload: { id } });
    return { success: true };
  },

  getAll(): Question[] {
    return store;
  },
};
