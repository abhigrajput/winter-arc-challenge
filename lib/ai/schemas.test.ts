import { describe, expect, it } from 'vitest';
import {
  isPlanType,
  parseAndValidate,
  planSchemas,
  stripFences,
  workoutPlanSchema,
} from './schemas';

const validWorkout = {
  week: 1,
  split: 'Upper / Lower',
  deload: false,
  days: [
    { name: 'Day 1', focus: 'chest', exercises: [{ name: 'Push-up', sets: 3, reps: '8-12' }] },
  ],
  progression: 'Add reps.',
  notes: [],
};

describe('stripFences', () => {
  it('leaves bare JSON alone', () => {
    expect(stripFences('{"a":1}')).toBe('{"a":1}');
  });

  it('removes ```json fences', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('removes bare ``` fences', () => {
    expect(stripFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('drops prose before and after the object', () => {
    expect(stripFences('Here is your plan:\n{"a":1}\nHope that helps!')).toBe('{"a":1}');
  });

  it('keeps nested braces intact', () => {
    const json = '{"a":{"b":[1,2]},"c":3}';
    expect(stripFences(`\`\`\`json\n${json}\n\`\`\``)).toBe(json);
  });

  it('trims surrounding whitespace', () => {
    expect(stripFences('   \n {"a":1}  \n ')).toBe('{"a":1}');
  });
});

describe('isPlanType', () => {
  it('accepts the three plan types', () => {
    expect(isPlanType('workout')).toBe(true);
    expect(isPlanType('diet')).toBe(true);
    expect(isPlanType('skincare')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isPlanType('sleep')).toBe(false);
    expect(isPlanType('')).toBe(false);
  });
});

describe('workoutPlanSchema', () => {
  it('accepts a well-formed plan', () => {
    expect(workoutPlanSchema.safeParse(validWorkout).success).toBe(true);
  });

  it('defaults deload and notes when absent', () => {
    const { deload, ...withoutDeload } = validWorkout;
    void deload;
    const parsed = workoutPlanSchema.parse({ ...withoutDeload, notes: undefined });
    expect(parsed.deload).toBe(false);
    expect(parsed.notes).toEqual([]);
  });

  it('rejects a week outside the 13-week programme', () => {
    expect(workoutPlanSchema.safeParse({ ...validWorkout, week: 0 }).success).toBe(false);
    expect(workoutPlanSchema.safeParse({ ...validWorkout, week: 14 }).success).toBe(false);
  });

  it('rejects a day with no exercises', () => {
    const plan = { ...validWorkout, days: [{ name: 'Day 1', focus: 'chest', exercises: [] }] };
    expect(workoutPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('keeps reps as free text so ranges and holds both work', () => {
    for (const reps of ['8-12', 'AMRAP', '30s hold']) {
      const plan = {
        ...validWorkout,
        days: [{ name: 'D', focus: 'f', exercises: [{ name: 'X', sets: 3, reps }] }],
      };
      expect(workoutPlanSchema.safeParse(plan).success, reps).toBe(true);
    }
  });
});

describe('parseAndValidate', () => {
  it('accepts fenced JSON', () => {
    const result = parseAndValidate(planSchemas.workout, `\`\`\`json\n${JSON.stringify(validWorkout)}\n\`\`\``);
    expect(result.ok).toBe(true);
  });

  it('reports invalid JSON rather than throwing', () => {
    const result = parseAndValidate(planSchemas.workout, 'not json at all');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons[0]).toContain('not valid JSON');
  });

  it('reports schema failures with field paths', () => {
    const result = parseAndValidate(planSchemas.workout, JSON.stringify({ week: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.join(' ')).toMatch(/split|days|progression/);
    }
  });

  it('caps the number of reported issues', () => {
    const result = parseAndValidate(planSchemas.diet, JSON.stringify({}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.length).toBeLessThanOrEqual(6);
  });

  it('round-trips a diet plan', () => {
    const diet = {
      week: 2,
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
    };
    const result = parseAndValidate(planSchemas.diet, JSON.stringify(diet));
    expect(result.ok).toBe(true);
  });

  it('rejects a skincare plan with too many actives', () => {
    const plan = {
      week: 1,
      am: [{ step: 1, product: 'Cleanser', instructions: 'Rinse.' }],
      pm: [{ step: 1, product: 'Moisturiser', instructions: 'Apply.' }],
      actives: Array.from({ length: 4 }, (_, i) => ({
        name: `Active ${i}`,
        frequency: 'Nightly',
        introduction: 'Patch test.',
      })),
      notes: [],
    };
    expect(parseAndValidate(planSchemas.skincare, JSON.stringify(plan)).ok).toBe(false);
  });
});
