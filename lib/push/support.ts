/**
 * Can this browser receive Web Push, and if not, what should we say? (§8.13)
 *
 * iOS/iPadOS only delivers push to a web app that has been added to the Home
 * Screen and opened from there, on 16.4 or later. In Safari proper the APIs are
 * missing, so an "Enable" button would just fail — show install steps instead.
 *
 * Pure: the component passes in what it read from navigator/window.
 */

export type PushSupport =
  | 'supported'
  /** iOS 16.4+ in a browser tab: install to the Home Screen first. */
  | 'ios-install'
  /** iOS older than 16.4: no web push at all. */
  | 'ios-too-old'
  | 'unsupported';

export interface BrowserTraits {
  userAgent: string;
  /** navigator.maxTouchPoints — iPadOS 13+ reports itself as a Mac. */
  maxTouchPoints: number;
  /** display-mode: standalone, or navigator.standalone on iOS. */
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
}

export function isIOS(traits: Pick<BrowserTraits, 'userAgent' | 'maxTouchPoints'>): boolean {
  if (/iPad|iPhone|iPod/.test(traits.userAgent)) return true;
  // iPadOS desktop-class Safari: "Macintosh" UA, but it has a touch screen.
  return /Macintosh/.test(traits.userAgent) && traits.maxTouchPoints > 1;
}

/** iOS major.minor from the UA ("OS 17_2" / "Version/17.2"), or null when unknown. */
export function iosVersion(userAgent: string): number | null {
  const os = userAgent.match(/OS (\d+)[_.](\d+)/);
  const version = userAgent.match(/Version\/(\d+)\.(\d+)/);
  const match = os ?? version;
  if (!match) return null;
  return Number(match[1]) + Number(match[2]) / 100;
}

export function pushSupport(traits: BrowserTraits): PushSupport {
  const apis = traits.hasServiceWorker && traits.hasPushManager && traits.hasNotification;

  if (isIOS(traits)) {
    const version = iosVersion(traits.userAgent);
    if (version !== null && version < 16.04) return 'ios-too-old';
    if (!traits.standalone) return 'ios-install';
    return apis ? 'supported' : 'ios-too-old';
  }

  return apis ? 'supported' : 'unsupported';
}

/** VAPID public key (base64url) → the Uint8Array PushManager.subscribe wants. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
