import rawDataset from './dataset.json';
import type { Fact } from './game';

export type DailyHistoryEntry = {
  dateKey: string;
  difficulty: 'easy' | 'medium' | 'hard';
};

export type LibraryProgress = {
  discoveredFactKeys: string[];
  dailyHistory: DailyHistoryEntry[];
  startedAt: string;
};

export type LibraryCategoryProgress = {
  category: string;
  opened: number;
  total: number;
};

const LIBRARY_STORAGE_KEY = 'number-games-library-v1';

const dataset = (rawDataset as Fact[]).filter(
  (row) => typeof row.value === 'number' && Number.isFinite(row.value)
);

export function factKey(fact: Fact): string {
  return JSON.stringify([
    fact.category,
    fact.metric,
    fact.object,
    fact.unit,
    fact.value
  ]);
}

function createEmptyLibraryProgress(): LibraryProgress {
  return {
    discoveredFactKeys: [],
    dailyHistory: [],
    startedAt: new Date().toISOString()
  };
}

export function loadLibraryProgress(): LibraryProgress {
  const empty = createEmptyLibraryProgress();

  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return empty;

    const parsed = JSON.parse(raw) as Partial<LibraryProgress>;
    const discoveredFactKeys = Array.isArray(parsed.discoveredFactKeys)
      ? [...new Set(parsed.discoveredFactKeys.filter((value): value is string => typeof value === 'string'))]
      : [];

    const dailyHistory = Array.isArray(parsed.dailyHistory)
      ? parsed.dailyHistory
        .filter((item): item is DailyHistoryEntry => (
          !!item
          && typeof item.dateKey === 'string'
          && (item.difficulty === 'easy' || item.difficulty === 'medium' || item.difficulty === 'hard')
        ))
        .filter((item, index, items) => items.findIndex((candidate) => candidate.dateKey === item.dateKey) === index)
      : [];

    return {
      discoveredFactKeys,
      dailyHistory,
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : empty.startedAt
    };
  } catch {
    return empty;
  }
}

export function saveLibraryProgress(progress: LibraryProgress): void {
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // The library remains usable when storage is unavailable.
  }
}

export function addDiscoveredFacts(
  progress: LibraryProgress,
  facts: Fact[]
): LibraryProgress {
  const known = new Set(progress.discoveredFactKeys);
  let changed = false;

  for (const fact of facts) {
    const key = factKey(fact);
    if (known.has(key)) continue;
    known.add(key);
    changed = true;
  }

  if (!changed) return progress;

  return {
    ...progress,
    discoveredFactKeys: [...known]
  };
}

export function registerDailyLibraryCompletion(
  progress: LibraryProgress,
  dateKey: string,
  difficulty: DailyHistoryEntry['difficulty']
): LibraryProgress {
  if (progress.dailyHistory.some((entry) => entry.dateKey === dateKey)) return progress;

  return {
    ...progress,
    dailyHistory: [...progress.dailyHistory, { dateKey, difficulty }]
  };
}

export function getLibraryFactOverview(progress: LibraryProgress): {
  opened: number;
  total: number;
  categories: LibraryCategoryProgress[];
} {
  const openedKeys = new Set(progress.discoveredFactKeys);
  const categoryTotals = new Map<string, number>();
  const categoryOpened = new Map<string, number>();

  for (const fact of dataset) {
    categoryTotals.set(fact.category, (categoryTotals.get(fact.category) ?? 0) + 1);
    if (openedKeys.has(factKey(fact))) {
      categoryOpened.set(fact.category, (categoryOpened.get(fact.category) ?? 0) + 1);
    }
  }

  const categories = [...categoryTotals.entries()]
    .map(([category, total]) => ({
      category,
      total,
      opened: categoryOpened.get(category) ?? 0
    }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category, 'ru'));

  return {
    opened: Math.min(openedKeys.size, dataset.length),
    total: dataset.length,
    categories
  };
}

function dateKeyToDay(dateKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
}

export function getDailyLibraryStats(
  progress: LibraryProgress,
  todayKey: string
): {
  total: number;
  currentStreak: number;
  bestStreak: number;
  difficultyCounts: Record<DailyHistoryEntry['difficulty'], number>;
} {
  const days = [...new Set(
    progress.dailyHistory
      .map((entry) => dateKeyToDay(entry.dateKey))
      .filter((value): value is number => value !== null)
  )].sort((a, b) => a - b);

  let bestStreak = 0;
  let running = 0;
  let previous: number | null = null;

  for (const day of days) {
    if (previous !== null && day === previous + 1) running += 1;
    else running = 1;
    bestStreak = Math.max(bestStreak, running);
    previous = day;
  }

  const today = dateKeyToDay(todayKey);
  let currentStreak = 0;

  if (days.length > 0 && today !== null) {
    const last = days[days.length - 1];
    if (last === today || last === today - 1) {
      currentStreak = 1;
      for (let index = days.length - 1; index > 0; index -= 1) {
        if (days[index] !== days[index - 1] + 1) break;
        currentStreak += 1;
      }
    }
  }

  const difficultyCounts = progress.dailyHistory.reduce(
    (acc, entry) => {
      acc[entry.difficulty] += 1;
      return acc;
    },
    { easy: 0, medium: 0, hard: 0 }
  );

  return {
    total: progress.dailyHistory.length,
    currentStreak,
    bestStreak,
    difficultyCounts
  };
}
