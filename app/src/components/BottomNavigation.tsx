import { NavLink } from 'react-router-dom';
import { Home, MessageSquare, Calendar, Settings } from 'lucide-react';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/home', icon: <Home size={24} />, label: 'Home' },
  { to: '/ask', icon: <MessageSquare size={24} />, label: 'Ask' },
  { to: '/calendar', icon: <Calendar size={24} />, label: 'Calendar' },
  { to: '/settings', icon: <Settings size={24} />, label: 'Settings' },
];

export function BottomNavigation() {
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
          gap: '8px',
          height: '64px',
        }}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '8px 24px',
              borderRadius: 'var(--radius-pill)',
              transition: 'all 0.2s',
              minWidth: '64px',
              height: '56px',
              textDecoration: 'none',
              backgroundColor: isActive ? 'var(--secondary-container)' : 'transparent',
              color: isActive ? 'var(--primary-40)' : 'var(--muted-foreground)',
            })}
          >
            {item.icon}
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
