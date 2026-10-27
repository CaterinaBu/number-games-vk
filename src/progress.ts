export type ProgressGame = 'compare' | 'guess' | 'order' | 'near';
export type GameProgressStatus = 'new' | 'tutorial' | 'mastered';

export type PlayerProgress = {
  status: Record<ProgressGame, GameProgressStatus>;
  factPoints: number;
};

const PROGRESS_STORAGE_KEY = 'number-games-progress-v2';
const LEGACY_PROGRESS_STORAGE_KEY = 'number-games-progress-v1';

const GAMES: ProgressGame[] = ['compare', 'guess', 'order', 'near'];

export function createEmptyProgress(): PlayerProgress {
  return {
    status: {
      compare: 'new',
      guess: 'new',
      order: 'new',
      near: 'new'
    },
    factPoints: 0
  };
}

function isStatus(value: unknown): value is GameProgressStatus {
  return value === 'new' || value === 'tutorial' || value === 'mastered';
}

export function loadProgress(): PlayerProgress {
  const empty = createEmptyProgress();

  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw) as {
        status?: Partial<Record<ProgressGame, GameProgressStatus>>;
        factPoints?: unknown;
      };

      const next = createEmptyProgress();

      for (const game of GAMES) {
        const value = parsed.status?.[game];
        next.status[game] = isStatus(value) ? value : 'new';
      }

      if (
        typeof parsed.factPoints === 'number'
        && Number.isFinite(parsed.factPoints)
        && parsed.factPoints >= 0
      ) {
        next.factPoints = Math.floor(parsed.factPoints);
      }

      return next;
    }

    // Migration from the first boolean progress format.
    const legacyRaw = localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY);
    if (!legacyRaw) return empty;

    const legacy = JSON.parse(legacyRaw) as {
      mastered?: Partial<Record<ProgressGame, boolean>>;
    };

    const migrated = createEmptyProgress();

    for (const game of GAMES) {
      migrated.status[game] = legacy.mastered?.[game] === true ? 'mastered' : 'new';
    }

    saveProgress(migrated);
    return migrated;
  } catch {
    return empty;
  }
}

export function saveProgress(progress: PlayerProgress): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // The game stays usable when storage is blocked.
  }
}
