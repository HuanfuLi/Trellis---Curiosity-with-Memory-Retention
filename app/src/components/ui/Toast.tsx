import { useState, useEffect, useCallback, useRef } from 'react';
import { setToastHandler } from '../../lib/toast';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  /** Phase 49-03 — optional trailing inline button (Undo, Retry, etc.). */
  action?: { label: string; onAction: () => void };
  exiting?: boolean;
}

const typeColors = {
  success: 'var(--primary-40)',
  error: 'var(--danger)',
  info: 'var(--primary-30)',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Track recent messages to suppress rapid duplicates (same text within 2s)
  const recentRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const addToast = useCallback(
    (msg: { message: string; type: ToastMessage['type']; action?: ToastMessage['action'] }) => {
      const now = Date.now();
      // Duplicate suppression key is type + message (action does NOT factor in —
      // two identical messages with different action handlers are still dupes).
      const key = `${msg.type}:${msg.message}`;
      const lastShown = recentRef.current.get(key) ?? 0;
      if (now - lastShown < 2000) return; // Suppress duplicate within 2s
      recentRef.current.set(key, now);

      const id = now.toString();
      setToasts((prev) => [...prev, { ...msg, id }]);
      // Phase 49-03 — extend auto-dismiss to 5000ms when an action button is
      // present so the user has time to tap it. Without action: 3000ms unchanged.
      const dismissDelay = msg.action ? 5000 : 3000;
      setTimeout(() => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 200);
      }, dismissDelay);
    },
    [],
  );

  useEffect(() => {
    setToastHandler(addToast);
    return () => setToastHandler(null);
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(96px + var(--safe-area-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        width: 'max-content',
        maxWidth: 'min(320px, 90vw)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 20px',
            backgroundColor: typeColors[t.type],
            color: 'white',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-3)',
            fontSize: '0.875rem',
            fontWeight: 500,
            textAlign: 'center',
            animation: t.exiting ? 'toast-out 0.2s ease forwards' : 'toast-in 0.2s ease',
            pointerEvents: t.action ? 'auto' : 'none',
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.onAction();
                dismissToast(t.id);
              }}
              style={{
                color: 'white',
                background: 'none',
                border: 'none',
                fontWeight: 700,
                padding: '0 0 0 12px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
      <style>{`
        @keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toast-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(8px); } }
      `}</style>
    </div>
  );
}
