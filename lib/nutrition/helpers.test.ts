import { describe, expect, it } from 'vitest';
import { foodTips, quickFoods } from './helpers';

describe('quickFoods', () => {
  it('gives a vegetarian no eggs, meat or fish', () => {
    const foods = quickFoods('veg', 'normal');
    const slugs = foods.map((f) => f.slug);
    expect(slugs).not.toContain('egg');
    expect(slugs).not.toContain('chicken');
    expect(slugs).not.toContain('fish');
    expect(slugs).toContain('paneer');
  });

  it('gives an egg eater eggs but no meat', () => {
    const slugs = quickFoods('egg', 'normal').map((f) => f.slug);
    expect(slugs).toContain('egg');
    expect(slugs).not.toContain('chicken');
  });

  it('gives a non-vegetarian everything', () => {
    const slugs = quickFoods('nonveg', 'normal').map((f) => f.slug);
    expect(slugs).toContain('chicken');
    expect(slugs).toContain('egg');
    expect(slugs).toContain('paneer');
  });

  it('puts mess items first in hostel mode', () => {
    const foods = quickFoods('veg', 'hostel');
    expect(foods[0]?.slug).toBe('mess_thali');
  });

  it('keeps mess items available but later on a normal budget', () => {
    const foods = quickFoods('veg', 'normal');
    expect(foods[0]?.slug).not.toBe('mess_thali');
    expect(foods.map((f) => f.slug)).toContain('mess_thali');
  });

  it('hides the non-veg thali from a vegetarian in hostel mode', () => {
    const slugs = quickFoods('veg', 'hostel').map((f) => f.slug);
    expect(slugs).toContain('mess_thali');
    expect(slugs).not.toContain('mess_thali_nonveg');
  });

  it('falls back to the full list when diet is unset', () => {
    expect(quickFoods(null, null).length).toBeGreaterThan(0);
  });

  it('gives every food positive calories and a serving', () => {
    for (const food of quickFoods('nonveg', 'normal')) {
      expect(food.calories, food.slug).toBeGreaterThan(0);
      expect(food.serving.length, food.slug).toBeGreaterThan(0);
    }
  });
});

describe('foodTips', () => {
  it('offers calorie-dense help on a bulk', () => {
    const titles = foodTips('lean_bulk').map((t) => t.title);
    expect(titles.join(' ')).toMatch(/dense|Liquid/);
  });

  it('offers volume foods and protein-first on a cut', () => {
    for (const goal of ['fat_loss', 'six_pack'] as const) {
      const titles = foodTips(goal).map((t) => t.title);
      expect(titles).toContain('Protein first');
      expect(titles).toContain('Volume foods');
    }
  });

  it('always returns something', () => {
    for (const goal of ['recomp', 'discipline', 'spiritual', null] as const) {
      expect(foodTips(goal).length).toBeGreaterThan(0);
    }
  });

  it('never uses shaming or earn-your-food framing (§10)', () => {
    const goals = ['fat_loss', 'six_pack', 'lean_bulk', 'recomp', 'discipline', 'spiritual', null] as const;
    const text = goals.flatMap((g) => foodTips(g)).map((t) => `${t.title} ${t.body}`).join(' ');
    expect(text).not.toMatch(/earn (your|the)|burn off|lazy|guilt|cheat day|ashamed/i);
  });
});
