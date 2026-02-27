import { Brain, MessageCircle } from 'lucide-react';

export type NodeSize = 'concept' | 'question' | 'detail';
export type NodeCategory = 'mint' | 'salmon' | 'lilac' | 'peach' | 'sky';
export type NodeState = 'default' | 'selected' | 'dimmed';

interface GraphNodeProps {
  size: NodeSize;
  category: NodeCategory;
  state?: NodeState;
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const sizeConfig = {
  concept: { width: 64, height: 64, fontSize: '0.75rem', iconSize: 24 },
  question: { width: 48, height: 48, fontSize: '0.65rem', iconSize: 0 },
  detail: { width: 12, height: 12, fontSize: 0, iconSize: 0 },
};

const categoryColors: Record<NodeCategory, string> = {
  mint: '#B2DFDB',
  salmon: '#FFAB91',
  lilac: '#CE93D8',
  peach: '#FFCCBC',
  sky: '#B3E5FC',
};

export function GraphNode({ size, category, state = 'default', label, icon, onClick }: GraphNodeProps) {
  const config = sizeConfig[size];
  const bgColor = categoryColors[category];

  const getStateStyle = (): React.CSSProperties => {
    switch (state) {
      case 'selected':
        return {
          outline: '4px solid var(--primary-40)',
          outlineOffset: '2px',
          boxShadow: '0 0 20px rgba(85,139,47,0.3)',
          borderRadius: '50%',
        };
      case 'dimmed':
        return { opacity: 0.3 };
      default:
        return {};
    }
  };

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        cursor: 'pointer',
        width: config.width,
        height: config.height,
        ...getStateStyle(),
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '2px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => {
          if (state === 'default') (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
      >
        {size !== 'detail' && (
          <>
            {icon || (size === 'concept' ? <Brain size={config.iconSize} color="#2D2D2D" /> : <MessageCircle size={16} color="#2D2D2D" />)}
            {label && (
              <span
                style={{
                  fontSize: config.fontSize,
                  textAlign: 'center',
                  color: '#2D2D2D',
                  maxWidth: size === 'concept' ? '58px' : '42px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.2,
                  padding: '0 2px',
                }}
              >
                {label}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
