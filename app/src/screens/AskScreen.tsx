import { useState, useRef, useEffect } from 'react';
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
}

export function AskScreen() {
  const navigate = useNavigate();
  const { ask, isAsking, questions } = useQuestions();
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

  const handleSend = async (content: string) => {
    const userMsg: Message = { id: Date.now().toString(), type: 'user', content };
    setMessages((prev) => [...prev, userMsg]);

    const question = await ask(content);

    if (question) {
      const related = questions.filter((q) => question.relatedQuestionIds.includes(q.id));
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: question.answer,
        relatedKnowledge: related.map((q) => q.summary),
        questionId: question.id,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } else {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Sorry, I had trouble processing that. Please try again.',
      }]);
    }
  };

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
          <ChatMessage
            key={message.id}
            type={message.type}
            content={message.content}
            relatedKnowledge={message.relatedKnowledge}
            onKnowledgeClick={(k) => {
              const q = questions.find((q) => q.summary === k);
              if (q) navigate(`/ask/${q.id}`);
            }}
          />
        ))}

        {isAsking && (
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
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} placeholder="Ask anything..." />
    </div>
  );
}
