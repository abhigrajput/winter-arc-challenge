import { describe, expect, it } from 'vitest';
import { PLAN_DISCLAIMER, checkPlan, type GuardrailContext } from './guardrails';
import type { DietPlan, SkincarePlan, WorkoutPlan } from './schemas';

const adult: GuardrailContext = { sex: 'male', age: 25, maintenanceCalories: 2600 };
const minor: GuardrailContext = { sex: 'male', age: 16, maintenanceCalories: 2400 };

const workout = (overrides: Partial<WorkoutPlan> = {}): WorkoutPlan => ({
  week: 1,
  split: 'Upper / Lower',
  deload: false,
  days: [
    {
      name: 'Day 1',
      focus: 'chest',
      exercises: [{ name: 'Push-up', sets: 3, reps: '8-12' }],
    },
  ],
  progression: 'Add 2.5 kg when all sets hit the top.',
  notes: [],
  ...overrides,
});

const diet = (overrides: Partial<DietPlan> = {}): DietPlan => ({
  week: 1,
  calorie_target: 2300,
  protein_g: 170,
  carbs_g: 230,
  fat_g: 70,
  meals: [
    {
      name: 'Breakfast',
      items: [{ food: 'Oats', quantity: '80 g', calories: 300, protein_g: 10 }],
      calories: 300,
      protein_g: 10,
    },
  ],
  swaps: [],
  notes: [],
  ...overrides,
});

const skincare = (overrides: Partial<SkincarePlan> = {}): SkincarePlan => ({
  week: 1,
  am: [{ step: 1, product: 'Cleanser', instructions: 'Rinse well.' }],
  pm: [{ step: 1, product: 'Moisturiser', instructions: 'Apply thinly.' }],
  actives: [],
  notes: [],
  ...overrides,
});

describe('banned substances', () => {
  it('rejects steroids and SARMs wherever they appear', () => {
    expect(checkPlan('workout', workout({ notes: ['Consider a steroid cycle'] }), adult).ok).toBe(
      false,
    );
    expect(checkPlan('workout', workout({ progression: 'Stack SARMs for week 6' }), adult).ok).toBe(
      false,
    );
  });

  it('rejects fat burners in a diet plan', () => {
    expect(checkPlan('diet', diet({ notes: ['Add a thermogenic fat burner'] }), adult).ok).toBe(
      false,
    );
  });

  it('rejects prescription-only medication in a skincare plan', () => {
    const plan = skincare({ notes: ['Start tretinoin nightly'] });
    const result = checkPlan('skincare', plan, adult);
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('prescription-only');
  });

  it('rejects dehydration cuts and extreme fasts', () => {
    expect(checkPlan('diet', diet({ notes: ['Use a sauna suit before weigh-in'] }), adult).ok).toBe(
      false,
    );
    expect(checkPlan('diet', diet({ notes: ['Try a 48 hour fast'] }), adult).ok).toBe(false);
  });

  it('rejects mewing and jaw devices (§8.4)', () => {
    expect(checkPlan('workout', workout({ notes: ['Practise mewing daily'] }), adult).ok).toBe(
      false,
    );
  });

  it('finds banned terms nested deep in the structure', () => {
    const plan = workout({
      days: [
        {
          name: 'Day 1',
          focus: 'chest',
          exercises: [{ name: 'Bench', sets: 3, reps: '5', notes: 'Run a testosterone cycle' }],
        },
      ],
    });
    expect(checkPlan('workout', plan, adult).ok).toBe(false);
  });
});

describe('shame language (§10)', () => {
  it('rejects earn-your-food framing', () => {
    const result = checkPlan('diet', diet({ notes: ['Earn your carbs with cardio'] }), adult);
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('earn-your-food');
  });

  it('rejects punishment and shaming copy', () => {
    expect(checkPlan('diet', diet({ notes: ['Burn off that pizza'] }), adult).ok).toBe(false);
    expect(checkPlan('workout', workout({ notes: ['Stop being lazy'] }), adult).ok).toBe(false);
  });

  it('accepts neutral, plain copy', () => {
    expect(checkPlan('diet', diet({ notes: ['Hit protein first at each meal.'] }), adult).ok).toBe(
      true,
    );
  });
});

describe('calorie floors', () => {
  it('rejects a male plan under 1500 kcal', () => {
    const result = checkPlan('diet', diet({ calorie_target: 1400 }), adult);
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('1500');
  });

  it('rejects a female plan under 1200 kcal', () => {
    const female: GuardrailContext = { sex: 'female', age: 30, maintenanceCalories: 1900 };
    expect(checkPlan('diet', diet({ calorie_target: 1100 }), female).ok).toBe(false);
  });

  it('accepts a plan at the floor', () => {
    expect(checkPlan('diet', diet({ calorie_target: 1500 }), adult).ok).toBe(true);
  });
});

describe('under-18 rules', () => {
  it('rejects a calorie swing beyond 250 kcal', () => {
    const result = checkPlan('diet', diet({ calorie_target: 1900 }), minor);
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('250');
  });

  it('accepts a mild adjustment', () => {
    expect(checkPlan('diet', diet({ calorie_target: 2200 }), minor).ok).toBe(true);
  });

  it('rejects any supplement mention', () => {
    const result = checkPlan('diet', diet({ notes: ['Add a whey shake'] }), minor);
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('supplements to a minor');
  });

  it('allows supplements for an adult', () => {
    expect(checkPlan('diet', diet({ notes: ['Add a whey shake'] }), adult).ok).toBe(true);
  });

  it('rejects max-effort testing', () => {
    const result = checkPlan('workout', workout({ progression: 'Test your 1RM in week 4' }), minor);
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('max-effort');
  });
});

describe('injury handling (§10)', () => {
  const injured: GuardrailContext = { ...adult, injuryReported: true };

  it('rejects a plan that ignores a reported injury', () => {
    const result = checkPlan('workout', workout(), injured);
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('seeing a professional');
  });

  it('accepts a plan that refers the user on', () => {
    const plan = workout({ notes: ['Pain that persists needs a healthcare professional.'] });
    expect(checkPlan('workout', plan, injured).ok).toBe(true);
  });
});

describe('skincare rules (§8.3)', () => {
  it('accepts an allowed OTC active', () => {
    const plan = skincare({
      actives: [{ name: 'Salicylic acid 2%', frequency: 'Every other night', introduction: 'Patch test first.' }],
    });
    expect(checkPlan('skincare', plan, adult).ok).toBe(true);
  });

  it('rejects an active that is not on the list', () => {
    const plan = skincare({
      actives: [{ name: 'Kojic acid', frequency: 'Nightly', introduction: 'Patch test.' }],
    });
    const result = checkPlan('skincare', plan, adult);
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('not on the OTC list');
  });

  it('rejects introducing more than one active at a time', () => {
    const plan = skincare({
      actives: [
        { name: 'Niacinamide', frequency: 'AM', introduction: 'Patch test.' },
        { name: 'Benzoyl peroxide', frequency: 'PM', introduction: 'Patch test.' },
      ],
    });
    const result = checkPlan('skincare', plan, adult);
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('more than one new active');
  });

  it('requires a dermatologist referral for severe presentations', () => {
    const plan = skincare({ notes: ['This looks like cystic acne.'] });
    const result = checkPlan('skincare', plan, adult);
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('dermatologist');
  });

  it('accepts severe wording when the referral is present', () => {
    const plan = skincare({
      notes: ['Cystic acne needs a dermatologist, not a routine change.'],
    });
    expect(checkPlan('skincare', plan, adult).ok).toBe(true);
  });
});

describe('clean plans', () => {
  it('passes a plain workout plan', () => {
    expect(checkPlan('workout', workout(), adult)).toEqual({ ok: true, violations: [] });
  });

  it('passes a plain diet plan', () => {
    expect(checkPlan('diet', diet(), adult).ok).toBe(true);
  });

  it('passes a plain skincare plan', () => {
    expect(checkPlan('skincare', skincare(), adult).ok).toBe(true);
  });

  it('reports each violation once', () => {
    const plan = diet({ notes: ['steroid', 'steroid again'] });
    const result = checkPlan('diet', plan, adult);
    expect(result.violations.filter((v) => v.includes('steroid'))).toHaveLength(1);
  });
});

describe('PLAN_DISCLAIMER', () => {
  it('is the exact wording §10 requires', () => {
    expect(PLAN_DISCLAIMER).toBe('General guidance, not medical advice.');
  });
});
