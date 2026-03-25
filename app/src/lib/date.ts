export function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isToday(date: string): boolean {
  return date === today();
}

// Parse a YYYY-MM-DD string using the local-time multi-arg constructor.
// This avoids browser/platform inconsistencies with ISO date strings:
//   - "YYYY-MM-DD" (date-only) is parsed as UTC midnight by spec → off-by-one in UTC+ zones
//   - "YYYY-MM-DDTHH:mm:ss" (no tz offset) is *supposed* to be local, but older iOS Safari
//     treated it as UTC.  The multi-arg constructor is always local on every platform.
function parseDateLocal(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  const dt = parseDateLocal(date);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateLabel(date: string): string {
  if (isToday(date)) return 'Today';
  const dt = parseDateLocal(date);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}
