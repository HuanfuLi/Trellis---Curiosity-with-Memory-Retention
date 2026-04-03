import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '48px 24px', maxWidth: '448px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '16px' }}>Something went wrong</p>
          <p style={{ color: 'var(--muted-foreground)', marginBottom: '24px', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/home';
            }}
            style={{
              padding: '12px 24px',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--primary-40)',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Go to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
