import { describe, expect, it } from 'vitest';
import { AUTH_ERRORS, mapAuthError, signUpSchema } from './messages';
import { clientIp, hashIp, overLimit, SIGNUP_LIMIT, windowStart } from './rate-limit';

const valid = { name: 'Rana', email: 'Rana@Example.com ', password: 'longenough', confirm: 'longenough' };

function headers(map: Record<string, string>) {
  return { get: (name: string) => map[name.toLowerCase()] ?? null };
}

describe('signUpSchema', () => {
  it('accepts name, email, password, confirm and normalizes the email', () => {
    const r = signUpSchema.safeParse(valid);
    expect(r.success && r.data.email).toBe('rana@example.com');
  });

  it('says "Password too short" under 8 characters', () => {
    const r = signUpSchema.safeParse({ ...valid, password: 'short12', confirm: 'short12' });
    expect(!r.success && r.error.issues[0]?.message).toBe(AUTH_ERRORS.passwordTooShort);
  });

  it('rejects a mismatched confirmation', () => {
    const r = signUpSchema.safeParse({ ...valid, confirm: 'different1' });
    expect(!r.success && r.error.issues[0]).toMatchObject({ path: ['confirm'], message: AUTH_ERRORS.passwordMismatch });
  });

  it('requires a name', () => {
    const r = signUpSchema.safeParse({ ...valid, name: '  ' });
    expect(!r.success && r.error.issues[0]?.message).toBe(AUTH_ERRORS.nameRequired);
  });
});

describe('mapAuthError', () => {
  it('maps Supabase codes to plain text', () => {
    expect(mapAuthError('user_already_exists', 'signUp')).toBe('Email already registered');
    expect(mapAuthError('invalid_credentials', 'signIn')).toBe('Wrong email or password');
    expect(mapAuthError('weak_password', 'signUp')).toBe('Password too short');
  });

  it('never leaks unknown errors on sign-in', () => {
    expect(mapAuthError('email_not_confirmed', 'signIn')).toBe('Wrong email or password');
    expect(mapAuthError(undefined, 'signUp')).toBe(AUTH_ERRORS.generic);
  });
});

describe('rate limit helpers', () => {
  it('takes the client from the start of x-forwarded-for', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(clientIp(headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientIp(headers({}))).toBe('unknown');
  });

  it('hashes deterministically per secret, never storing the IP', () => {
    const a = hashIp('203.0.113.7', 's1');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('203');
    expect(hashIp('203.0.113.7', 's1')).toBe(a);
    expect(hashIp('203.0.113.7', 's2')).not.toBe(a);
  });

  it('allows 30 per hour, blocks the 31st', () => {
    expect(overLimit(SIGNUP_LIMIT - 1)).toBe(false);
    expect(overLimit(SIGNUP_LIMIT)).toBe(true);
    expect(windowStart(new Date('2026-10-06T12:00:00Z'))).toBe('2026-10-06T11:00:00.000Z');
  });
});
