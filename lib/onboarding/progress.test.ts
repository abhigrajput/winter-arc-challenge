import { describe, expect, it } from 'vitest';
import { canEnterStep, isStepComplete, resumeStep, type ProgressInput } from './progress';

/** A profile fresh from the signup trigger: provisional username, nothing else. */
const fresh: ProgressInput = {
  profile: {
    username: 'user_14229162',
    display_name: 'smoke.test',
    timezone: 'Asia/Kolkata',
    challenge_start: '2026-09-30',
    sex: null,
    age: null,
    height_cm: null,
    weight_kg: null,
    target_weight_kg: null,
    activity_level: 1.375,
    goal: null,
    training_mode: null,
    fitness_level: null,
    days_per_week: null,
    session_minutes: null,
    diet_type: null,
    budget: 'normal',
    wake_time: '05:00:00',
    sleep_target_h: 8,
    onboarded: false,
  },
  hasBaseline: false,
  modulesChosen: false,
};

function withProfile(patch: Partial<NonNullable<ProgressInput['profile']>>): ProgressInput {
  return { ...fresh, profile: { ...fresh.profile!, ...patch } };
}

describe('isStepComplete', () => {
  it('does not count the provisional signup username as claimed', () => {
    expect(isStepComplete('identity', fresh)).toBe(false);
  });

  it('counts identity once a real username is claimed', () => {
    expect(isStepComplete('identity', withProfile({ username: 'abhishek' }))).toBe(true);
  });

  it('needs every body field before body is done', () => {
    const partial = withProfile({ sex: 'male', age: 25, height_cm: 180 });
    expect(isStepComplete('body', partial)).toBe(false);

    const full = withProfile({
      sex: 'male',
      age: 25,
      height_cm: 180,
      weight_kg: 85,
      target_weight_kg: 75,
      activity_level: 1.55,
    });
    expect(isStepComplete('body', full)).toBe(true);
  });

  it('treats the seeded defaults as not enough for routine or diet', () => {
    // wake_time and sleep_target_h ship with defaults, so routine reads as done,
    // but diet_type is null so diet does not.
    expect(isStepComplete('diet', fresh)).toBe(false);
    expect(isStepComplete('diet', withProfile({ diet_type: 'veg' }))).toBe(true);
  });

  it('uses the caller-supplied flags for modules and baseline', () => {
    expect(isStepComplete('modules', fresh)).toBe(false);
    expect(isStepComplete('modules', { ...fresh, modulesChosen: true })).toBe(true);
    expect(isStepComplete('baseline', { ...fresh, hasBaseline: true })).toBe(true);
  });

  it('treats a skipped baseline as done, so resume moves on to the result', () => {
    expect(isStepComplete('baseline', fresh)).toBe(false);
    expect(isStepComplete('baseline', { ...fresh, skippedBaseline: true })).toBe(true);
  });

  it('counts result only once onboarded is true', () => {
    expect(isStepComplete('result', fresh)).toBe(false);
    expect(isStepComplete('result', withProfile({ onboarded: true }))).toBe(true);
  });

  it('treats a missing profile as nothing done', () => {
    const none: ProgressInput = { profile: null, hasBaseline: false, modulesChosen: false };
    expect(isStepComplete('identity', none)).toBe(false);
    expect(resumeStep(none)).toBe('identity');
  });
});

describe('resumeStep', () => {
  it('starts at identity for a fresh profile', () => {
    expect(resumeStep(fresh)).toBe('identity');
  });

  it('walks forward as steps are filled in', () => {
    let state = withProfile({ username: 'abhishek' });
    expect(resumeStep(state)).toBe('body');

    state = withProfile({
      username: 'abhishek',
      sex: 'male',
      age: 25,
      height_cm: 180,
      weight_kg: 85,
      target_weight_kg: 75,
      activity_level: 1.55,
    });
    expect(resumeStep(state)).toBe('goal');

    state = { ...state, profile: { ...state.profile!, goal: 'fat_loss' } };
    expect(resumeStep(state)).toBe('modules');

    state = { ...state, modulesChosen: true };
    expect(resumeStep(state)).toBe('training');
  });

  it('lands on result when everything before it is done', () => {
    const done: ProgressInput = {
      profile: {
        ...fresh.profile!,
        username: 'abhishek',
        sex: 'male',
        age: 25,
        height_cm: 180,
        weight_kg: 85,
        target_weight_kg: 75,
        activity_level: 1.55,
        goal: 'fat_loss',
        training_mode: 'home',
        fitness_level: 'beginner',
        days_per_week: 4,
        session_minutes: 45,
        diet_type: 'veg',
      },
      hasBaseline: true,
      modulesChosen: true,
    };
    expect(resumeStep(done)).toBe('result');
  });
});

describe('canEnterStep', () => {
  it('allows the current step and everything behind it', () => {
    const state = withProfile({ username: 'abhishek' });
    expect(canEnterStep('identity', state)).toBe(true);
    expect(canEnterStep('body', state)).toBe(true);
  });

  it('blocks deep-linking past unfinished steps', () => {
    const state = withProfile({ username: 'abhishek' });
    expect(canEnterStep('goal', state)).toBe(false);
    expect(canEnterStep('result', state)).toBe(false);
  });
});
