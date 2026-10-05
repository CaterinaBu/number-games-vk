type AnalyticsParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

let initialized = false;

function getCounterId(): number {
  const raw = import.meta.env.VITE_YANDEX_METRIKA_ID;
  const id = Number(raw ?? 0);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export function initAnalytics(): boolean {
  if (initialized) return true;

  const counterId = getCounterId();
  if (!counterId || typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  // Keep this queue compatible with Yandex's official async snippet:
  // each queued call is stored as the function's Arguments object.
  if (!window.ym) {
    window.ym = function (..._args: unknown[]) {
      const fn = window.ym as unknown as { a?: IArguments[]; l?: number };
      fn.a = fn.a || [];
      fn.a.push(arguments);
    };
  }

  const ymFn = window.ym as unknown as { a?: IArguments[]; l?: number };
  ymFn.l = Date.now();

  if (!document.querySelector('script[data-number-games-metrika]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://mc.yandex.ru/metrika/tag.js';
    script.dataset.numberGamesMetrika = 'true';
    document.head.appendChild(script);
  }

  window.ym(counterId, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    trackHash: true
  });

  initialized = true;
  return true;
}

export function trackEvent(name: string, params: AnalyticsParams = {}): void {
  const counterId = getCounterId();
  if (!counterId) return;

  if (!initialized) initAnalytics();
  if (!window.ym) return;

  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  );

  window.ym(counterId, 'reachGoal', name, cleanParams);
}
