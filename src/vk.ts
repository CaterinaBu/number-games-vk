import bridge from '@vkontakte/vk-bridge';

const AD_ROUND_KEY = 'number-games-ad-rounds-v1';
const DEFAULT_VK_APP_ID = 54804062;

let initialized = false;
let initializationAttempted = false;

export function isVKEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  const hasVKLaunchParams =
    params.has('vk_platform') ||
    params.has('vk_app_id') ||
    params.has('vk_user_id');

  return bridge.isEmbedded() || hasVKLaunchParams;
}

export async function initVK(): Promise<boolean> {
  if (initialized) return true;
  if (initializationAttempted) return false;

  initializationAttempted = true;

  if (!isVKEnvironment()) {
    return false;
  }

  try {
    await bridge.send('VKWebAppInit');
    initialized = true;

    try {
      await bridge.send('VKWebAppSetTitle', {
        title: 'Игры с числами'
      });
    } catch {
      // Title is optional and may be unsupported in some clients.
    }

    return true;
  } catch {
    return false;
  }
}

export function registerCompletedRound(): boolean {
  if (typeof window === 'undefined') return false;

  let completed = 0;

  try {
    completed = Number(localStorage.getItem(AD_ROUND_KEY) ?? '0');
    if (!Number.isFinite(completed) || completed < 0) completed = 0;
  } catch {
    completed = 0;
  }

  const next = completed + 1;

  try {
    localStorage.setItem(AD_ROUND_KEY, String(next));
  } catch {
    // The game still works if storage is unavailable.
  }

  return next % 3 === 0;
}

export type AdShowResult = 'interstitial' | 'banner' | null;

async function isDesktopVK(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const launchParams = await bridge.send('VKWebAppGetLaunchParams');
    const platform = launchParams.vk_platform ?? '';
    return platform === 'desktop_web' || platform === 'desktop_web_messenger' || platform === 'desktop_app_messenger';
  } catch {
    const platform = new URLSearchParams(window.location.search).get('vk_platform') ?? '';
    return platform === 'desktop_web' || platform === 'desktop_web_messenger' || platform === 'desktop_app_messenger';
  }
}

async function showDesktopBannerIfAvailable(): Promise<boolean> {
  if (!(await isDesktopVK())) return false;

  try {
    const availability = await bridge.send('VKWebAppCheckBannerAd');
    if (!availability.result) return false;

    const result = await bridge.send('VKWebAppShowBannerAd', {
      banner_location: 'bottom',
      banner_align: 'center',
      layout_type: 'resize',
      height_type: 'compact',
      orientation: 'horizontal',
      can_close: true
    });

    return result.result === true;
  } catch {
    return false;
  }
}

export async function showAdIfAvailable(): Promise<AdShowResult> {
  if (!isVKEnvironment()) return null;

  const ready = initialized || await initVK();
  if (!ready) return null;

  try {
    const availability = await bridge.send('VKWebAppCheckNativeAds', {
      ad_format: 'interstitial'
    });

    if (availability.result) {
      const result = await bridge.send('VKWebAppShowNativeAds', {
        ad_format: 'interstitial'
      });

      if (result.result === true) {
        return 'interstitial';
      }
    }
  } catch {
    // Fall through to the desktop banner fallback below.
  }

  if (await showDesktopBannerIfAvailable()) {
    return 'banner';
  }

  return null;
}


export function getDonationGroupId(): number {
  const raw = import.meta.env.VITE_VK_DONATION_GROUP_ID;
  const id = Number(raw ?? 0);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export function getVKAppId(): number {
  if (typeof window === 'undefined') return 0;
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get('vk_app_id') ?? 0);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export function isDonationConfigured(): boolean {
  return getDonationGroupId() > 0;
}

export async function donateToCommunity(amount: number): Promise<boolean> {
  if (!Number.isFinite(amount) || amount < 1) return false;
  if (!isVKEnvironment()) return false;

  const groupId = getDonationGroupId();
  const appId = getVKAppId();
  if (!groupId || !appId) return false;

  const ready = initialized || await initVK();
  if (!ready) return false;

  try {
    const response = await bridge.send('VKWebAppOpenPayForm', {
      app_id: appId,
      action: 'pay-to-group',
      params: {
        amount: Math.round(amount),
        group_id: groupId,
        description: 'Добровольная поддержка игры'
      }
    });

    // VK returns TransactionResult for VKWebAppOpenPayForm.
    // A non-empty response by itself does not mean the payment succeeded:
    // status must be true, and a successful transaction has an id.
    const payload =
      response &&
      typeof response === 'object' &&
      'result' in response
        ? (response as { result?: unknown }).result
        : response;

    if (!payload || typeof payload !== 'object') return false;

    const transaction = payload as {
      status?: unknown;
      transaction_id?: unknown;
    };

    return (
      transaction.status === true &&
      typeof transaction.transaction_id === 'string' &&
      transaction.transaction_id.trim().length > 0
    );
  } catch {
    return false;
  }
}


export function getCommunityId(): number {
  const raw = import.meta.env.VITE_VK_COMMUNITY_ID;
  const explicit = Number(raw ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  return getDonationGroupId();
}

async function getPublicVKAppLink(): Promise<string> {
  let appId = getVKAppId();

  if (!appId) {
    try {
      const launchParams = await bridge.send('VKWebAppGetLaunchParams');
      appId = Number(launchParams.vk_app_id ?? 0);
    } catch {
      // Fall back to the production app id below.
    }
  }

  if (!Number.isFinite(appId) || appId <= 0) {
    appId = DEFAULT_VK_APP_ID;
  }

  return `https://vk.ru/app${appId}`;
}

export async function shareApp(link?: string): Promise<boolean> {
  if (!isVKEnvironment()) return false;

  const ready = initialized || await initVK();
  if (!ready) return false;

  try {
    const shareLink = link || await getPublicVKAppLink();
    await bridge.send('VKWebAppShare', { link: shareLink });
    return true;
  } catch {
    return false;
  }
}

export async function inviteFriends(): Promise<boolean> {
  if (!isVKEnvironment()) return false;

  const ready = initialized || await initVK();
  if (!ready) return false;

  try {
    const result = await bridge.send('VKWebAppShowInviteBox');
    if (result.success === true) return true;
  } catch {
    // VKWebAppShowInviteBox is unavailable on some clients (notably Web).
  }

  // Fallback for unsupported clients: share the VK app link instead.
  return shareApp();
}

export function openCommunity(): boolean {
  if (typeof window === 'undefined') return false;

  const groupId = getCommunityId();
  if (!groupId) return false;

  const url = `https://vk.ru/club${groupId}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
