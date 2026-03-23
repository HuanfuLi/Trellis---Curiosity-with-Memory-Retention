import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageSquare } from 'lucide-react';
import type { ChatSession, DailyPost, SessionMessage } from '../types';
import { useQuestions } from '../state/useQuestions';
import { conceptFeedService } from '../services/concept-feed.service';
import { sessionService } from '../services/session.service';
import { postContextQaService } from '../services/post-context-qa.service';
import { Markdown } from '../components/Markdown';
import { ChatMessage } from '../components/ChatMessage';
import { toast } from '../lib/toast';

let msgIdCounter = 0;
function newMsgId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++msgIdCounter}`;
}

export function PostDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { questions } = useQuestions();
  const [post, setPost] = useState<DailyPost | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [streaming, setStreaming] = useState('');
  const [input, setInput] = useState('');
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadingPost(true);
    void conceptFeedService.getPostById(id, questions).then((loaded) => {
      if (cancelled) return;
      setPost(loaded);
      setLoadingPost(false);
      if (loaded) {
        setSession(sessionService.getOrCreatePostSession(loaded, questions));
      }
    });
    return () => { cancelled = true; };
  }, [id, questions]);

  // Track initial message count so we only auto-scroll on NEW messages, not on mount
  const initialMsgCount = useRef<number | null>(null);
  useEffect(() => {
    const count = session?.messages.length ?? 0;
    if (initialMsgCount.current === null) {
      // First render with messages — record baseline, don't scroll
      initialMsgCount.current = count;
      return;
    }
    // Only scroll when messages are added after initial load, or during streaming
    if (count > initialMsgCount.current || streaming) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages, streaming]);

  const quickAskPrompts = useMemo(() => post?.quickAskPrompts ?? [], [post]);

  const handleAsk = async (content: string) => {
    if (!content.trim() || !post || !session) return;

    const userMsg: SessionMessage = { id: newMsgId('u'), type: 'user', content: content.trim() };
    const nextSession: ChatSession = { ...session, messages: [...session.messages, userMsg] };
    setSession(nextSession);
    sessionService.save(nextSession);
    sessionService.setActiveId(nextSession.id);
    setInput('');
    setStreaming('');

    try {
      let accumulated = '';
      for await (const token of postContextQaService.askStreaming(nextSession.origin!.context, userMsg.content)) {
        accumulated += token;
        setStreaming(accumulated);
      }

      const aiMsg: SessionMessage = {
        id: newMsgId('ai'),
        type: 'ai',
        content: accumulated || 'Something went wrong. Please try again.',
      };
      const updated: ChatSession = { ...nextSession, messages: [...nextSession.messages, aiMsg] };
      setSession(updated);
      sessionService.save(updated);
      setStreaming('');
    } catch (error) {
      setStreaming('');
      toast(error instanceof Error ? error.message : 'Failed to ask about this post.', 'error');
    }
  };

  if (loadingPost) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '448px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Loading post...
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '448px', margin: '0 auto' }}>
        <button onClick={() => navigate('/home')} style={{ background: 'none', padding: 0, color: 'var(--primary-40)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={18} />
          Back to Home
        </button>
        <h2 style={{ marginTop: '24px', marginBottom: '8px' }}>Post not found</h2>
        <p style={{ color: 'var(--muted-foreground)' }}>This post is no longer available in the current daily feed.</p>
      </div>
    );
  }

  const messages = session?.messages ?? [];

  return (
    <div style={{ padding: '16px 16px 104px', maxWidth: '448px', margin: '0 auto' }}>
      <button onClick={() => navigate('/home')} style={{ background: 'none', padding: '4px 2px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '0.95rem' }}>
        <ArrowLeft size={18} />
        Back to Home
      </button>

      <article
        style={{
          borderRadius: '22px',
          padding: '20px 16px',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary-90) 70%, white), var(--card))',
          boxShadow: 'var(--shadow-2)',
          border: '1px solid color-mix(in srgb, var(--primary-40) 18%, var(--border))',
          marginBottom: '14px',
          userSelect: 'text',
          WebkitTouchCallout: 'default',
        }}
      >
        <p style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
          {post.contextLabel} · {post.narrativeMode}
        </p>
        <h1 style={{ fontSize: '1.55rem', lineHeight: 1.12, marginBottom: '12px', textWrap: 'balance' }}>{post.title}</h1>
        <p style={{ fontSize: '0.98rem', lineHeight: 1.62, color: 'var(--foreground)', marginBottom: '16px' }}>{post.whyCare}</p>
        <Markdown>{post.bodyMarkdown}</Markdown>
        <div
          style={{
            marginTop: '16px',
            padding: '14px',
            borderRadius: '16px',
            backgroundColor: 'var(--surface-variant)',
            border: '1px solid var(--border)',
          }}
        >
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '6px' }}>
            Takeaway
          </p>
          <p style={{ lineHeight: 1.65 }}>{post.takeaway}</p>
        </div>
      </article>

      <section
        style={{
          borderRadius: '20px',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--card)',
          boxShadow: 'var(--shadow-1)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid var(--surface-variant)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <MessageSquare size={17} color="var(--primary-40)" />
            <h2 style={{ fontSize: '1rem' }}>Ask this post</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {quickAskPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => void handleAsk(prompt)}
                disabled={Boolean(streaming)}
                style={{
                  padding: '7px 11px',
                  borderRadius: '999px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface-variant)',
                  color: 'var(--foreground)',
                  cursor: streaming ? 'not-allowed' : 'pointer',
                  opacity: streaming ? 0.6 : 1,
                  fontSize: '0.85rem',
                  lineHeight: 1.35,
                  textAlign: 'left',
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {messages.length === 0 && !streaming && (
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.86rem', lineHeight: 1.55 }}>
              Ask for an example, challenge the claim, or connect this post to something else you have been learning.
            </p>
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              messageId={message.id}
              type={message.type}
              content={message.content}
              relatedKnowledge={message.relatedKnowledge}
            />
          ))}

          {streaming && (
            <ChatMessage
              messageId="streaming"
              type="ai"
              content={streaming}
            />
          )}

          <div ref={threadEndRef} />
        </div>

        <div style={{ padding: '0 14px 14px' }}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleAsk(input);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={2}
              placeholder="Ask a follow-up about this post..."
              disabled={Boolean(streaming)}
              style={{
                flex: 1,
                resize: 'vertical',
                minHeight: '84px',
                borderRadius: '16px',
                border: '1.5px solid var(--border)',
                backgroundColor: 'var(--surface-variant)',
                color: 'var(--foreground)',
                padding: '12px 13px',
                fontSize: '0.95rem',
                lineHeight: 1.45,
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || Boolean(streaming)}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: 'var(--primary-40)',
                color: 'white',
                cursor: !input.trim() || streaming ? 'not-allowed' : 'pointer',
                opacity: !input.trim() || streaming ? 0.5 : 1,
              }}
            >
              Ask
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
