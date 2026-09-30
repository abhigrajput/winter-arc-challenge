import { describe, expect, it } from 'vitest';
import { GOAL_PRESETS, TASK_SLUGS, effectiveModules, goalPreset, resolveTask } from './goals';

const template = {
  steps: { slug: 'steps', title: 'Steps', module: 'core', default_target: 10000 },
  running: { slug: 'running', title: 'Running', module: 'running', default_target: 3 },
  noJunk: { slug: 'no_junk', title: 'No junk / added sugar', module: 'core', default_target: 1 },
  absCircuit: { slug: 'abs_circuit', title: 'Abs circuit', module: 'abs', default_target: 1 },
  skincareAm: {
    slug: 'skincare_am',
    title: 'Skincare AM + sunscreen',
    module: 'face_skin',
    default_target: 1,
  },
};

describe('GOAL_PRESETS', () => {
  it('covers every goal', () => {
    expect(Object.keys(GOAL_PRESETS).sort()).toEqual([
      'discipline',
      'fat_loss',
      'lean_bulk',
      'recomp',
      'six_pack',
      'spiritual',
    ]);
  });

  it('only overrides slugs that exist in the template set', () => {
    for (const preset of Object.values(GOAL_PRESETS)) {
      for (const slug of Object.keys(preset.targets)) {
        expect(TASK_SLUGS).toContain(slug);
      }
      for (const slug of Object.keys(preset.titles)) {
        expect(TASK_SLUGS).toContain(slug);
      }
      for (const slug of preset.optional) {
        expect(TASK_SLUGS).toContain(slug);
      }
    }
  });
});

describe('goalPreset', () => {
  it('falls back to template defaults with no goal', () => {
    const preset = goalPreset(null);
    expect(preset.targets).toEqual({});
    expect(preset.forcedModules).toEqual([]);
  });
});

describe('effectiveModules', () => {
  it('forces the abs module on for fat loss and six pack', () => {
    expect(effectiveModules('fat_loss', []).has('abs')).toBe(true);
    expect(effectiveModules('six_pack', []).has('abs')).toBe(true);
  });

  it('keeps what the user picked', () => {
    const modules = effectiveModules('fat_loss', ['face_skin']);
    expect(modules.has('face_skin')).toBe(true);
    expect(modules.has('abs')).toBe(true);
  });

  it('does not invent modules for goals that force none', () => {
    expect([...effectiveModules('recomp', ['jawline'])]).toEqual(['jawline']);
    expect([...effectiveModules('discipline', [])]).toEqual([]);
  });

  it('does not duplicate a module the user already picked', () => {
    expect([...effectiveModules('fat_loss', ['abs'])]).toEqual(['abs']);
  });
});

describe('resolveTask', () => {
  it('raises the step target for fat loss', () => {
    expect(resolveTask(template.steps, 'fat_loss', []).target).toBe(12000);
    expect(resolveTask(template.steps, 'six_pack', []).target).toBe(12000);
  });

  it('lowers the step target for a lean bulk', () => {
    expect(resolveTask(template.steps, 'lean_bulk', []).target).toBe(8000);
  });

  it('holds steps at 10,000 for recomp', () => {
    expect(resolveTask(template.steps, 'recomp', []).target).toBe(10000);
  });

  it('leaves the template default alone when the goal says nothing', () => {
    expect(resolveTask(template.steps, 'discipline', []).target).toBe(10000);
    expect(resolveTask(template.steps, null, []).target).toBe(10000);
  });

  it('relaxes the junk rule on a lean bulk', () => {
    expect(resolveTask(template.noJunk, 'lean_bulk', []).title).toBe('No junk before training');
    expect(resolveTask(template.noJunk, 'fat_loss', []).title).toBe('No junk / added sugar');
  });

  it('makes running optional on a lean bulk even if the module is picked', () => {
    expect(resolveTask(template.running, 'lean_bulk', ['running']).active).toBe(false);
    expect(resolveTask(template.running, 'fat_loss', ['running']).active).toBe(true);
  });

  it('activates abs for fat loss without the user picking it', () => {
    expect(resolveTask(template.absCircuit, 'fat_loss', []).active).toBe(true);
    expect(resolveTask(template.absCircuit, 'recomp', []).active).toBe(false);
  });

  it('leaves unpicked module tasks inactive rather than dropping them', () => {
    const resolved = resolveTask(template.skincareAm, 'fat_loss', []);
    expect(resolved.active).toBe(false);
    expect(resolved.title).toBe('Skincare AM + sunscreen');
  });

  it('activates a module task once the user picks it', () => {
    expect(resolveTask(template.skincareAm, 'fat_loss', ['face_skin']).active).toBe(true);
  });

  it('always keeps core tasks active', () => {
    for (const goal of ['fat_loss', 'lean_bulk', 'recomp', 'discipline', 'spiritual'] as const) {
      expect(resolveTask(template.steps, goal, []).active).toBe(true);
    }
  });
});
