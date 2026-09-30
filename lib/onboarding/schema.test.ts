import { describe, expect, it } from 'vitest';
import {
  STEPS,
  baselineSchemaFor,
  bodySchema,
  dietSchema,
  identitySchema,
  isStep,
  modulesSchema,
  nextStep,
  previousStep,
  routineSchema,
  scheduleSchema,
  trainingSchema,
} from './schema';

const validBody = {
  sex: 'male',
  age: '25',
  height_cm: '180',
  weight_kg: '85',
  target_weight_kg: '75',
  activity_level: '1.55',
};

describe('step navigation', () => {
  it('runs identity through result', () => {
    expect(STEPS[0]).toBe('identity');
    expect(STEPS[STEPS.length - 1]).toBe('result');
  });

  it('recognises only real steps', () => {
    expect(isStep('body')).toBe(true);
    expect(isStep('nonsense')).toBe(false);
  });

  it('walks forward and back, stopping at the ends', () => {
    expect(nextStep('identity')).toBe('body');
    expect(nextStep('result')).toBe('result');
    expect(previousStep('body')).toBe('identity');
    expect(previousStep('identity')).toBeNull();
  });
});

describe('identitySchema', () => {
  const valid = {
    username: 'abhishek_arc',
    display_name: 'Abhishek',
    timezone: 'Asia/Kolkata',
    challenge_start: '2026-09-30',
  };

  it('accepts a good profile', () => {
    expect(identitySchema.safeParse(valid).success).toBe(true);
  });

  it('lowercases and trims the username', () => {
    const parsed = identitySchema.parse({ ...valid, username: '  AbhiShek_Arc  ' });
    expect(parsed.username).toBe('abhishek_arc');
  });

  it('rejects usernames with punctuation or spaces', () => {
    for (const username of ['ab', 'has space', 'has-dash', 'has.dot', 'a'.repeat(21)]) {
      expect(identitySchema.safeParse({ ...valid, username }).success).toBe(false);
    }
  });

  it('requires an ISO start date', () => {
    expect(identitySchema.safeParse({ ...valid, challenge_start: '30-09-2026' }).success).toBe(
      false,
    );
  });
});

describe('bodySchema', () => {
  it('coerces the numeric strings a form sends', () => {
    const parsed = bodySchema.parse(validBody);
    expect(parsed.age).toBe(25);
    expect(parsed.activity_level).toBe(1.55);
  });

  it('refuses a target weight under BMI 18.5', () => {
    const result = bodySchema.safeParse({ ...validBody, target_weight_kg: '50' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'target_weight_kg');
      expect(issue?.message).toContain('59.9 kg');
    }
  });

  it('accepts a target exactly at the BMI floor', () => {
    expect(bodySchema.safeParse({ ...validBody, target_weight_kg: '60' }).success).toBe(true);
  });

  it('rejects an activity level outside the four multipliers', () => {
    expect(bodySchema.safeParse({ ...validBody, activity_level: '1.9' }).success).toBe(false);
  });

  it('rejects under-13s', () => {
    expect(bodySchema.safeParse({ ...validBody, age: '12' }).success).toBe(false);
  });
});

describe('modulesSchema', () => {
  it('treats picking nothing as valid', () => {
    expect(modulesSchema.parse({ modules: [] }).modules).toEqual([]);
  });

  it('rejects unknown module slugs', () => {
    expect(modulesSchema.safeParse({ modules: ['abs', 'made_up'] }).success).toBe(false);
  });
});

describe('trainingSchema', () => {
  it('accepts a gym setup with no equipment listed', () => {
    const result = trainingSchema.safeParse({
      training_mode: 'gym',
      equipment: [],
      max_dumbbell_kg: null,
    });
    expect(result.success).toBe(true);
  });

  it('demands a max weight once dumbbells are ticked', () => {
    const result = trainingSchema.safeParse({
      training_mode: 'home',
      equipment: ['dumbbells'],
      max_dumbbell_kg: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path[0]).toBe('max_dumbbell_kg');
    }
  });

  it('passes once the max weight is given', () => {
    const result = trainingSchema.safeParse({
      training_mode: 'home',
      equipment: ['dumbbells', 'pull_up_bar'],
      max_dumbbell_kg: '20',
    });
    expect(result.success).toBe(true);
  });
});

describe('scheduleSchema', () => {
  it('holds days per week to 3-6', () => {
    const base = { fitness_level: 'beginner', session_minutes: '45' };
    expect(scheduleSchema.safeParse({ ...base, days_per_week: '2' }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...base, days_per_week: '7' }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...base, days_per_week: '4' }).success).toBe(true);
  });

  it('only allows the four session lengths', () => {
    const base = { fitness_level: 'beginner', days_per_week: '4' };
    expect(scheduleSchema.safeParse({ ...base, session_minutes: '50' }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...base, session_minutes: '90' }).success).toBe(true);
  });
});

describe('dietSchema', () => {
  it('defaults the notes to an empty string', () => {
    const parsed = dietSchema.parse({ diet_type: 'veg', budget: 'hostel' });
    expect(parsed.diet_notes).toBe('');
  });
});

describe('routineSchema', () => {
  it('takes an HH:MM wake time', () => {
    expect(routineSchema.safeParse({ wake_time: '05:00', sleep_target_h: '8' }).success).toBe(true);
    expect(routineSchema.safeParse({ wake_time: '5am', sleep_target_h: '8' }).success).toBe(false);
  });

  it('keeps the sleep target between 4 and 12 hours', () => {
    expect(routineSchema.safeParse({ wake_time: '05:00', sleep_target_h: '3' }).success).toBe(false);
    expect(routineSchema.safeParse({ wake_time: '05:00', sleep_target_h: '13' }).success).toBe(
      false,
    );
  });
});

describe('baselineSchemaFor', () => {
  it('lets a man skip the hip measurement', () => {
    const result = baselineSchemaFor('male').safeParse({
      waist_cm: '90',
      neck_cm: '39',
      hip_cm: null,
    });
    expect(result.success).toBe(true);
  });

  it('requires the hip measurement for a woman', () => {
    const result = baselineSchemaFor('female').safeParse({
      waist_cm: '74',
      neck_cm: '32',
      hip_cm: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path[0]).toBe('hip_cm');
    }
  });

  it('accepts a woman with a hip measurement', () => {
    expect(
      baselineSchemaFor('female').safeParse({ waist_cm: '74', neck_cm: '32', hip_cm: '96' })
        .success,
    ).toBe(true);
  });
});
