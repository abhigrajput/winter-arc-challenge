import { describe, expect, it } from 'vitest';
import { iosVersion, isIOS, pushSupport, urlBase64ToUint8Array, type BrowserTraits } from './support';

const IPHONE_17 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
const IPHONE_15 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1';
const IPADOS =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

const full = { hasServiceWorker: true, hasPushManager: true, hasNotification: true };
const none = { hasServiceWorker: true, hasPushManager: false, hasNotification: false };

function traits(over: Partial<BrowserTraits>): BrowserTraits {
  return { userAgent: ANDROID_CHROME, maxTouchPoints: 5, standalone: false, ...full, ...over };
}

describe('pushSupport', () => {
  it('Android Chrome works in a tab', () => {
    expect(pushSupport(traits({}))).toBe('supported');
  });

  it('iOS Safari in a tab gets install steps, not a broken button', () => {
    expect(pushSupport(traits({ userAgent: IPHONE_17, ...none }))).toBe('ios-install');
  });

  it('iOS installed to the Home Screen works', () => {
    expect(pushSupport(traits({ userAgent: IPHONE_17, standalone: true }))).toBe('supported');
  });

  it('iOS before 16.4 has no web push, installed or not', () => {
    expect(pushSupport(traits({ userAgent: IPHONE_15, ...none }))).toBe('ios-too-old');
    expect(pushSupport(traits({ userAgent: IPHONE_15, standalone: true, ...none }))).toBe('ios-too-old');
  });

  it('iPadOS posing as a Mac is still treated as iOS', () => {
    expect(isIOS({ userAgent: IPADOS, maxTouchPoints: 5 })).toBe(true);
    expect(isIOS({ userAgent: IPADOS, maxTouchPoints: 0 })).toBe(false);
    expect(pushSupport(traits({ userAgent: IPADOS, ...none }))).toBe('ios-install');
  });

  it('a desktop browser without the APIs is unsupported', () => {
    expect(pushSupport(traits({ maxTouchPoints: 0, ...none }))).toBe('unsupported');
  });
});

describe('iosVersion', () => {
  it('reads the OS version', () => {
    expect(iosVersion(IPHONE_17)).toBeCloseTo(17.02);
    expect(iosVersion(IPHONE_15)).toBeCloseTo(15.07);
    expect(iosVersion(ANDROID_CHROME)).toBeNull();
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url with missing padding', () => {
    expect([...urlBase64ToUint8Array('AQID-_8')]).toEqual([1, 2, 3, 251, 255]);
  });
});
