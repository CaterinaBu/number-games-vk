export type ProgressGame = 'compare' | 'guess' | 'order' | 'near';

export type PlayerProgress = {
  mastered: Record<ProgressGame, boolean>;
};

const PROGRESS_STORAGE_KEY = 'number-games-progress-v1';

export function createEmptyProgress(): PlayerProgress {
  return {
    mastered: {
      compare: false,
      guess: false,
      order: false,
      near: false
    }
  };
}

export function loadProgress(): PlayerProgress {
  const empty = createEmptyProgress();

  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return empty;

    const parsed = JSON.parse(raw) as { mastered?: Partial<Record<ProgressGame, boolean>> };
    const mastered = parsed.mastered ?? {};

    return {
      mastered: {
        compare: mastered.compare === true,
        guess: mastered.guess === true,
        order: mastered.order === true,
        near: mastered.near === true
      }
    };
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
