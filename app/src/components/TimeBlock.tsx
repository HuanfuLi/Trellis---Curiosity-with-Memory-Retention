import { CornerDownRight } from 'lucide-react';

export interface TimeBlockProps {
  time: string;
  task: string;
  completed?: boolean;
  onPostpone?: () => void;
  onToggleComplete?: () => void;
  color?: string;
}

export function TimeBlock({ time, task, completed = false, onPostpone, onToggleComplete, color }: TimeBlockProps) {
  const bgColor = color || 'var(--node-mint)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px 20px',
        marginBottom: '12px',
        backgroundColor: bgColor,
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-1)',
        opacity: completed ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <div style={{ flexShrink: 0, width: '64px' }}>
        <span style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2D2D2D' }}>{time}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          onClick={onToggleComplete}
          style={{
            textAlign: 'left',
            width: '100%',
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#2D2D2D',
            textDecoration: completed ? 'line-through' : 'none',
            opacity: completed ? 0.7 : 1,
            lineHeight: 1.5,
          }}
        >
          {task}
        </button>
      </div>

      {!completed && (
        <button
          onClick={onPostpone}
          aria-label="Postpone task"
          style={{
            flexShrink: 0,
            padding: '8px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.8)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)')}
        >
          <CornerDownRight size={20} color="#2D2D2D" />
        </button>
      )}
    </div>
  );
}
