import { useState } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
}

export function ChatInput({ onSend, placeholder = 'Ask anything...' }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        position: 'fixed',
        bottom: '80px',
        left: 0,
        right: 0,
        padding: '0 16px 16px',
      }}
    >
      <div style={{ maxWidth: '448px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            backgroundColor: 'var(--surface-variant)',
            borderRadius: 'var(--radius-pill)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1,
              background: 'transparent',
              color: 'var(--foreground)',
            }}
          />
          <button
            type="submit"
            disabled={!message.trim()}
            style={{
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-40)',
              color: 'white',
              opacity: message.trim() ? 1 : 0.4,
              cursor: message.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s',
            }}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </form>
  );
}
