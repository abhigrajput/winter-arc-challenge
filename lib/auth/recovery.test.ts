import { describe, expect, it } from 'vitest';
import { RECOVERY_WINDOW_SECONDS, isRecentRecovery, parseFlag } from './recovery';
import { newPasswordSchema, resetRequestSchema } from './messages';

const NOW = 1_800_000_000;

describe('parseFlag', () => {
  it('is on only for "true" or "1"', () => {
    expect(parseFlag('true')).toBe(true);
    expect(parseFlag('1')).toBe(true);
    for (const v of [undefined, '', 'false', '0', 'TRUE', 'yes', ' true']) expect(parseFlag(v)).toBe(false);
  });
});

describe('isRecentRecovery', () => {
  it('accepts a fresh recovery or OTP sign-in', () => {
    expect(isRecentRecovery([{ method: 'recovery', timestamp: NOW - 60 }], NOW)).toBe(true);
    expect(isRecentRecovery([{ method: 'otp', timestamp: NOW - 60 }], NOW)).toBe(true);
  });

  it('rejects a password session, however fresh', () => {
    expect(isRecentRecovery([{ method: 'password', timestamp: NOW }], NOW)).toBe(false);
  });

  it('rejects a recovery sign-in older than the window', () => {
    expect(isRecentRecovery([{ method: 'recovery', timestamp: NOW - RECOVERY_WINDOW_SECONDS - 1 }], NOW)).toBe(false);
    expect(isRecentRecovery([{ method: 'recovery', timestamp: NOW - RECOVERY_WINDOW_SECONDS }], NOW)).toBe(true);
  });

  it('finds the recovery entry among others', () => {
    const amr = [
      { method: 'password', timestamp: NOW - 86_400 },
      { method: 'recovery', timestamp: NOW - 10 },
    ];
    expect(isRecentRecovery(amr, NOW)).toBe(true);
  });

  it('rejects missing, string-form and future-dated claims', () => {
    expect(isRecentRecovery(undefined, NOW)).toBe(false);
    expect(isRecentRecovery([], NOW)).toBe(false);
    expect(isRecentRecovery(['recovery'], NOW)).toBe(false);
    expect(isRecentRecovery([{ method: 'recovery', timestamp: NOW + 3600 }], NOW)).toBe(false);
  });
});

describe('reset schemas', () => {
  it('normalises the request email', () => {
    const parsed = resetRequestSchema.safeParse({ email: '  Me@Example.COM ' });
    expect(parsed.success && parsed.data.email).toBe('me@example.com');
    expect(resetRequestSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });

  it('requires a long enough, matching new password', () => {
    expect(newPasswordSchema.safeParse({ password: 'longenough1', confirm: 'longenough1' }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: 'short', confirm: 'short' }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: 'longenough1', confirm: 'longenough2' }).success).toBe(false);
  });
});
