import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--primary-40)',
    color: 'white',
  },
  secondary: {
    backgroundColor: 'var(--surface-variant)',
    color: 'var(--foreground)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--primary-40)',
  },
  danger: {
    backgroundColor: '#E53935',
    color: 'white',
  },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: '8px 16px', fontSize: '0.875rem', borderRadius: '20px' },
  md: { padding: '12px 24px', fontSize: '1rem', borderRadius: '24px' },
  lg: { padding: '16px 32px', fontSize: '1.0625rem', borderRadius: '28px' },
};

export function Button({ variant = 'primary', size = 'md', children, fullWidth, style, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 500,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'opacity 0.2s, transform 0.2s',
        opacity: disabled ? 0.5 : 1,
        width: fullWidth ? '100%' : undefined,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
