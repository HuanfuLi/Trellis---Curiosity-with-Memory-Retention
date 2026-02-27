import { useState, useEffect, useCallback } from 'react';
import { setToastHandler } from '../../lib/toast';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const typeColors = {
  success: 'var(--primary-40)',
  error: '#E53935',
  info: 'var(--primary-30)',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((msg: { message: string; type: ToastMessage['type'] }) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...msg, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    setToastHandler(addToast);
    return () => setToastHandler(null);
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '320px',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: '12px 16px',
            backgroundColor: typeColors[t.type],
            color: 'white',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-3)',
            fontSize: '0.875rem',
            fontWeight: 500,
            animation: 'toast-in 0.2s ease',
          }}
        >
          {t.message}
        </div>
      ))}
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
