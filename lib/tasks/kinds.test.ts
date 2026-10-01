import { describe, expect, it } from 'vitest';
import { isCapTask, isNumericTaskComplete, numericTaskPercent } from './kinds';

describe('isCapTask', () => {
  it('treats the social media limit as a cap', () => {
    expect(isCapTask('social_limit')).toBe(true);
  });

  it('treats ordinary minute tasks as floors', () => {
    for (const slug of ['reading', 'gita', 'meditation', 'skill', 'editing', 'no_phone_morning']) {
      expect(isCapTask(slug), slug).toBe(false);
    }
  });

  it('handles a missing slug', () => {
    expect(isCapTask(null)).toBe(false);
    expect(isCapTask(undefined)).toBe(false);
  });
});

describe('isNumericTaskComplete', () => {
  it('completes a floor task at or above the target', () => {
    expect(isNumericTaskComplete(30, 30, 'reading')).toBe(true);
    expect(isNumericTaskComplete(45, 30, 'reading')).toBe(true);
    expect(isNumericTaskComplete(29, 30, 'reading')).toBe(false);
  });

  it('completes a cap task at or below the target', () => {
    expect(isNumericTaskComplete(0, 30, 'social_limit')).toBe(true);
    expect(isNumericTaskComplete(30, 30, 'social_limit')).toBe(true);
    expect(isNumericTaskComplete(31, 30, 'social_limit')).toBe(false);
  });

  it('starts a cap task complete, before anything is logged', () => {
    expect(isNumericTaskComplete(0, 30, 'social_limit')).toBe(true);
  });

  it('is never complete without a target', () => {
    expect(isNumericTaskComplete(10, 0, 'reading')).toBe(false);
    expect(isNumericTaskComplete(0, 0, 'social_limit')).toBe(false);
  });

  it('keeps no_phone_morning a floor, despite also being about phones', () => {
    expect(isNumericTaskComplete(60, 60, 'no_phone_morning')).toBe(true);
    expect(isNumericTaskComplete(10, 60, 'no_phone_morning')).toBe(false);
  });
});

describe('numericTaskPercent', () => {
  it('reports progress toward the target', () => {
    expect(numericTaskPercent(15, 30)).toBe(50);
    expect(numericTaskPercent(30, 30)).toBe(100);
  });

  it('caps the bar at 100', () => {
    expect(numericTaskPercent(90, 30)).toBe(100);
  });

  it('fills as a cap task is used up', () => {
    expect(numericTaskPercent(30, 30)).toBe(100);
  });

  it('is 0 without a target', () => {
    expect(numericTaskPercent(10, 0)).toBe(0);
  });
});
