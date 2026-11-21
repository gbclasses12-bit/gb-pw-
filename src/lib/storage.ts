import type { EnrolledBatch, HistoryEntry } from './constants';

const ENROLLED_KEY = 'enrolledBatches';
const SELECTED_BATCH_KEY = 'selectedBatch';
const HISTORY_KEY = 'studyHistory';
export const THEME_KEY = 'USER_THEME';

export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';

export function getEnrolledBatches(): EnrolledBatch[] {
  try {
    const raw = localStorage.getItem(ENROLLED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEnrolledBatches(batches: EnrolledBatch[]): void {
  try {
    localStorage.setItem(ENROLLED_KEY, JSON.stringify(batches));
    window.dispatchEvent(new Event('batchesUpdated'));
  } catch {
    // ignore storage errors
  }
}

export function getSelectedBatch(): EnrolledBatch | null {
  try {
    const raw = localStorage.getItem(SELECTED_BATCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSelectedBatch(batch: EnrolledBatch | null): void {
  try {
    if (!batch) {
      localStorage.removeItem(SELECTED_BATCH_KEY);
    } else {
      localStorage.setItem(SELECTED_BATCH_KEY, JSON.stringify(batch));
    }
    window.dispatchEvent(new Event('batchesUpdated'));
  } catch {
    // ignore
  }
}

export function getStudyHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addStudyHistory(entry: Omit<HistoryEntry, 'watchedAt'> & { watchedAt?: string }): void {
  try {
    const current = getStudyHistory();
    const stamped: HistoryEntry = {
      ...entry,
      watchedAt: entry.watchedAt || new Date().toISOString(),
    };
    const filtered = current.filter(
      (item) => !(item.type === stamped.type && item.contentId === stamped.contentId),
    );
    const next = [stamped, ...filtered].slice(0, 80);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('studyHistoryUpdated'));
  } catch {
    // ignore
  }
}

export function getStoredTheme(): ThemeMode {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'LIGHT' || t === 'DARK' || t === 'SYSTEM') return t;
  } catch {
    // ignore
  }
  return 'SYSTEM';
}

export function applyTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // ignore
  }
  const root = document.documentElement;
  if (mode === 'DARK') {
    root.classList.add('dark');
  } else if (mode === 'LIGHT') {
    root.classList.remove('dark');
  } else {
    root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
}
