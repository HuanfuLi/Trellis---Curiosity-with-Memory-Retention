import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: string;
}

export function Card({ children, padding = '20px', style, ...props }: CardProps) {
  return (
    <div
      {...props}
      style={{
        backgroundColor: 'var(--card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-1)',
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
