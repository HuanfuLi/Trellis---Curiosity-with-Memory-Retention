import type { ReactNode } from 'react';

type BadgeColor = 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray';

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
}

const colorMap: Record<BadgeColor, { bg: string; text: string }> = {
  green: { bg: 'var(--primary-90)', text: 'var(--primary-30)' },
  yellow: { bg: 'var(--secondary-80)', text: '#5D4037' },
  red: { bg: '#FFCDD2', text: '#B71C1C' },
  blue: { bg: 'var(--node-sky)', text: '#01579B' },
  purple: { bg: 'var(--node-lilac)', text: '#4A148C' },
  gray: { bg: 'var(--surface-variant)', text: 'var(--muted-foreground)' },
};

export function Badge({ children, color = 'gray' }: BadgeProps) {
  const { bg, text } = colorMap[color];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '0.75rem',
        fontWeight: 500,
        backgroundColor: bg,
        color: text,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
