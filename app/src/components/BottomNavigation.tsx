import { useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, GitBranch, Mic, Calendar, Settings } from 'lucide-react';
import { hapticImpactLight } from '../lib/haptics';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const leftItems: NavItem[] = [
  { to: '/home', icon: <Home size={22} />, label: 'Home' },
  { to: '/planner', icon: <Calendar size={22} />, label: 'Planner' },
];

const rightItems: NavItem[] = [
  { to: '/graph', icon: <GitBranch size={22} />, label: 'Graph' },
  { to: '/settings', icon: <Settings size={22} />, label: 'Settings' },
];

// Shared style to suppress all native mobile long-press / callout behaviors
const noCallout: React.CSSProperties = {
  WebkitTouchCallout: 'none',
  WebkitUserSelect: 'none',
  userSelect: 'none',
};

interface BottomNavigationProps {
  onAskLongPress?: () => void;
}

export function BottomNavigation({ onAskLongPress }: BottomNavigationProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const handleAskPointerDown = () => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      void hapticImpactLight();
      onAskLongPress?.();
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleAskClick = () => {
    // If the long-press already fired, don't also navigate
    if (!longPressFired.current) navigate('/ask');
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--surface-container)',
        borderTop: '1px solid var(--border)',
        padding: '8px',
        paddingBottom: 'calc(8px + var(--safe-area-bottom))',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: '448px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          gap: '4px',
          height: '64px',
        }}
      >
        {/* Left items */}
        {leftItems.map((item) => {
          const isActive = pathname.startsWith(item.to);
          return (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              onContextMenu={(e) => e.preventDefault()}
              className="active-squish"
              style={{
                ...noCallout,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                transition: 'all 0.2s',
                minWidth: '56px',
                height: '56px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isActive ? 'var(--secondary-container)' : 'transparent',
                color: isActive ? 'var(--primary-40)' : 'var(--muted-foreground)',
                flex: 1,
              }}
            >
              {item.icon}
              <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>{item.label}</span>
            </button>
          );
        })}

        {/* Center FAB — Ask */}
        {(() => {
          const isActive = pathname.startsWith('/ask');
          return (
            <button
              onClick={handleAskClick}
              onPointerDown={handleAskPointerDown}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onContextMenu={(e) => e.preventDefault()}
              className="active-squish"
              style={{
                ...noCallout,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                width: '60px',
                height: '60px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isActive ? 'var(--primary-30)' : 'var(--primary-40)',
                color: 'white',
                boxShadow: isActive
                  ? '0 0 0 4px color-mix(in srgb, var(--primary-40) 25%, transparent), 0 4px 14px rgba(0,0,0,0.25)'
                  : '0 4px 14px rgba(0,0,0,0.2)',
                flexShrink: 0,
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
              }}
            >
              <Mic size={24} />
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.02em' }}>Ask</span>
            </button>
          );
        })()}

        {/* Right items */}
        {rightItems.map((item) => {
          const isActive = pathname.startsWith(item.to);
          return (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              onContextMenu={(e) => e.preventDefault()}
              className="active-squish"
              style={{
                ...noCallout,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                transition: 'all 0.2s',
                minWidth: '56px',
                height: '56px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isActive ? 'var(--secondary-container)' : 'transparent',
                color: isActive ? 'var(--primary-40)' : 'var(--muted-foreground)',
                flex: 1,
              }}
            >
              {item.icon}
              <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
