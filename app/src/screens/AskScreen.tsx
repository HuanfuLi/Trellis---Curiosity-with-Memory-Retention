import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network } from 'lucide-react';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { useQuestions } from '../state/useQuestions';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  relatedKnowledge?: string[];
  questionId?: string;
  isStreaming?: boolean;
}

export function AskScreen() {
  const navigate = useNavigate();
  const { askStreaming, isAsking, questions } = useQuestions();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'ai',
      content: "Hi! I'm your AI learning companion. Ask me anything to build your knowledge base.",
      relatedKnowledge: [],
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAsking]);

  const handleSend = useCallback(async (content: string) => {
    const userMsg: Message = { id: Date.now().toString(), type: 'user', content };
    const placeholderId = `ai-${Date.now() + 1}`;
    const placeholder: Message = {
      id: placeholderId,
      type: 'ai',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, placeholder]);

    const question = await askStreaming(content, (accumulated) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === placeholderId ? { ...m, content: accumulated } : m)),
      );
    });

    if (question) {
      const related = questions.filter((q) => question.relatedQuestionIds.includes(q.id));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                content: question.answer,
                isStreaming: false,
                relatedKnowledge: related.map((q) => q.summary),
                questionId: question.id,
              }
            : m,
        ),
      );
    } else {
      // onToken was called with the error message — just close the stream
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? { ...m, isStreaming: false, content: m.content || 'Something went wrong. Please try again.' }
            : m,
        ),
      );
    }
  }, [askStreaming, questions]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '448px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 16px 16px',
          backgroundColor: 'var(--surface)',
        }}
      >
        <div>
          <h1 style={{ marginBottom: '2px' }}>Ask</h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>Your AI learning companion</p>
        </div>
        <button
          onClick={() => navigate('/graph')}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: 'var(--surface-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary-40)',
          }}
          title="Knowledge Graph"
        >
          <Network size={22} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: '140px' }}>
        {messages.map((message) => (
          <div key={message.id}>
            <ChatMessage
              type={message.type}
              content={message.content + (message.isStreaming && message.content ? '|' : '')}
              relatedKnowledge={message.relatedKnowledge}
              onKnowledgeClick={(k) => {
                const q = questions.find((q) => q.summary === k);
                if (q) navigate(`/ask/${q.id}`);
              }}
            />
            {message.isStreaming && !message.content && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
                <div
                  style={{
                    padding: '16px 20px',
                    backgroundColor: 'var(--surface-variant)',
                    borderRadius: '24px',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-40)',
                        animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                  <style>{`@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }`}</style>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} placeholder="Ask anything..." />
    </div>
  );
}
