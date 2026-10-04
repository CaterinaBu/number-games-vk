import bridge from '@vkontakte/vk-bridge';

const AD_ROUND_KEY = 'number-games-ad-rounds-v1';

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

export async function showInterstitialIfAvailable(): Promise<boolean> {
  if (!isVKEnvironment()) return false;

  const ready = initialized || await initVK();
  if (!ready) return false;

  try {
    const availability = await bridge.send('VKWebAppCheckNativeAds', {
      ad_format: 'interstitial'
    });

    if (!availability.result) {
      return false;
    }

    const result = await bridge.send('VKWebAppShowNativeAds', {
      ad_format: 'interstitial'
    });

    return result.result === true;
  } catch {
    // Ad errors should never block navigation or the next game.
    return false;
  }
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

    return Boolean(response);
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

export async function shareApp(link?: string): Promise<boolean> {
  if (!isVKEnvironment()) return false;

  const ready = initialized || await initVK();
  if (!ready) return false;

  try {
    const shareLink = link || window.location.href;
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
    await bridge.send('VKWebAppShowInviteBox');
    return true;
  } catch {
    return false;
  }
}

export function openCommunity(): boolean {
  if (typeof window === 'undefined') return false;

  const groupId = getCommunityId();
  if (!groupId) return false;

  const url = `https://vk.ru/club${groupId}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
