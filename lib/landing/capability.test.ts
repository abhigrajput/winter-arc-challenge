import { describe, expect, it } from 'vitest';
import { arcDay, heroMode, isLowEnd, scrollProgress, snowCount } from './capability';

describe('scrollProgress', () => {
  // A 2000px section with an 800px viewport has 1200px of travel.
  it('runs 0 → 1 while the sticky stage is pinned', () => {
    expect(scrollProgress(0, 2000, 800)).toBe(0);
    expect(scrollProgress(-600, 2000, 800)).toBe(0.5);
    expect(scrollProgress(-1200, 2000, 800)).toBe(1);
  });

  it('clamps before and after the section', () => {
    expect(scrollProgress(300, 2000, 800)).toBe(0);
    expect(scrollProgress(-5000, 2000, 800)).toBe(1);
  });

  it('copes with a section no taller than the viewport', () => {
    expect(scrollProgress(10, 700, 800)).toBe(0);
    expect(scrollProgress(-10, 700, 800)).toBe(1);
  });
});

const capable = { reducedMotion: false, webgl: true, hardwareConcurrency: 8, deviceMemory: 8 };

describe('heroMode', () => {
  it('runs 3D on a capable device', () => {
    expect(heroMode(capable)).toBe('3d');
  });

  it('falls back for reduced motion, no WebGL, or Save-Data', () => {
    expect(heroMode({ ...capable, reducedMotion: true })).toBe('fallback');
    expect(heroMode({ ...capable, webgl: false })).toBe('fallback');
    expect(heroMode({ ...capable, saveData: true })).toBe('fallback');
  });

  it('falls back on low-end hardware (≤ 4 cores or ≤ 4 GB)', () => {
    expect(heroMode({ ...capable, hardwareConcurrency: 4 })).toBe('fallback');
    expect(heroMode({ ...capable, deviceMemory: 4 })).toBe('fallback');
    expect(heroMode({ ...capable, deviceMemory: 2 })).toBe('fallback');
  });

  it('does not penalise unknown values (deviceMemory is Chromium-only)', () => {
    expect(isLowEnd({ hardwareConcurrency: 8 })).toBe(false);
    expect(isLowEnd({})).toBe(false);
    expect(heroMode({ reducedMotion: false, webgl: true, hardwareConcurrency: 6 })).toBe('3d');
  });
});

describe('snowCount', () => {
  it('uses ~500 particles on phones and ~1500 on desktop', () => {
    expect(snowCount(400)).toBe(500);
    expect(snowCount(767)).toBe(500);
    expect(snowCount(1440)).toBe(1500);
  });
});

describe('arcDay', () => {
  it('maps hero scroll progress to day 0..90', () => {
    expect(arcDay(0)).toBe(0);
    expect(arcDay(0.5)).toBe(45);
    expect(arcDay(1)).toBe(90);
  });

  it('clamps out-of-range and junk input', () => {
    expect(arcDay(-0.2)).toBe(0);
    expect(arcDay(1.7)).toBe(90);
    expect(arcDay(Number.NaN)).toBe(0);
  });
});
