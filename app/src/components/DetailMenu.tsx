import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2 } from 'lucide-react';

interface DetailMenuProps {
  onDelete: () => void;
  /** Label shown in the delete confirmation dialog. */
  deleteLabel?: string;
}

export function DetailMenu({ onDelete, deleteLabel = 'this item' }: DetailMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen((v) => !v); setConfirming(false); }}
        aria-label="More options"
        style={{
          background: 'none',
          border: 'none',
          padding: '6px',
          cursor: 'pointer',
          color: 'var(--muted-foreground)',
          display: 'flex',
          alignItems: 'center',
          borderRadius: '8px',
        }}
      >
        <MoreVertical size={20} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            minWidth: '180px',
            backgroundColor: 'var(--card)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-3)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            zIndex: 200,
          }}
        >
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.875rem',
                color: '#E53935',
                fontWeight: 500,
              }}
            >
              <Trash2 size={16} />
              Delete
            </button>
          ) : (
            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--foreground)', marginBottom: '12px', lineHeight: 1.4 }}>
                Delete {deleteLabel}? This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { setOpen(false); setConfirming(false); onDelete(); }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-xl)',
                    border: 'none',
                    backgroundColor: '#E53935',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => { setOpen(false); setConfirming(false); }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surface-variant)',
                    color: 'var(--foreground)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
