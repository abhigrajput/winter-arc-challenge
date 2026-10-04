import { describe, expect, it } from 'vitest';
import { classifyPushStatus } from './outcome';

describe('classifyPushStatus', () => {
  it('treats 404 and 410 as a dead subscription', () => {
    expect(classifyPushStatus(404)).toBe('gone');
    expect(classifyPushStatus(410)).toBe('gone');
  });

  it('keeps the subscription on transient or payload errors', () => {
    for (const code of [400, 401, 403, 413, 429, 500, 503, undefined]) {
      expect(classifyPushStatus(code)).toBe('error');
    }
  });

  it('accepts 2xx', () => {
    expect(classifyPushStatus(201)).toBe('sent');
  });
});
