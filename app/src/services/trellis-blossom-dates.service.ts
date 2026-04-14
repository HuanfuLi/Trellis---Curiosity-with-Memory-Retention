// Per CONTEXT D-09 (Fruit threshold: blossom for 7+ consecutive days) and RESEARCH Pitfall 4,
// we must persist the date each anchor first reached blossom state. This storage sits
// outside ReviewSchedule because it is a trellis-specific visualization concern.

const STORAGE_KEY = 'trellis_blossom_dates';

export type BlossomDateMap = Record<string, string>; // anchorId -> ISO YYYY-MM-DD

export function getBlossomDates(): BlossomDateMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as BlossomDateMap;
    }
    return {};
  } catch {
    return {};
  }
}

export function setBlossomDate(anchorId: string, isoDate: string): void {
  const current = getBlossomDates();
  current[anchorId] = isoDate;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // localStorage quota exceeded — silently drop; blossom will reset next cycle
  }
}

export function clearBlossomDate(anchorId: string): void {
  const current = getBlossomDates();
  if (!(anchorId in current)) return;
  delete current[anchorId];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch { /* ignore */ }
}

export function replaceBlossomDates(next: BlossomDateMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}
