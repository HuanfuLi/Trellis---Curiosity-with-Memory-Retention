interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: number;
  label?: string;
  style?: React.CSSProperties;
}

export function ProgressBar({ value, color = 'var(--primary-40)', height = 8, label, style }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div style={style}>
      {label && (
        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '4px' }}>{label}</p>
      )}
      <div
        style={{
          height: `${height}px`,
          backgroundColor: 'var(--surface-variant)',
          borderRadius: 'var(--radius-pill)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${clamped}%`,
            backgroundColor: color,
            borderRadius: 'var(--radius-pill)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}
