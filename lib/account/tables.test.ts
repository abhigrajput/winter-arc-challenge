import { describe, expect, it } from 'vitest';
import { USER_TABLES, exportFilename, isDeleteConfirmed, redactRows } from './tables';

describe('redactRows', () => {
  it('drops push-subscription keys but keeps the rest', () => {
    const rows = redactRows('push_subscriptions', [
      { id: '1', endpoint: 'https://push.example/x', p256dh: 'secret', auth: 'secret', created_at: 't' },
    ]);
    expect(rows).toEqual([{ id: '1', endpoint: 'https://push.example/x', created_at: 't' }]);
  });

  it('leaves other tables untouched', () => {
    const rows = [{ user_id: 'u', log_date: '2026-10-08', calories: 400 }];
    expect(redactRows('food_entries', rows)).toBe(rows);
  });
});

describe('USER_TABLES', () => {
  it('keys profiles by id and everything else by user_id', () => {
    for (const { table, key } of USER_TABLES) expect(key).toBe(table === 'profiles' ? 'id' : 'user_id');
  });

  it('lists each table once', () => {
    const names = USER_TABLES.map((t) => t.table);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('delete confirmation', () => {
  it('requires exactly DELETE', () => {
    expect(isDeleteConfirmed('DELETE')).toBe(true);
    expect(isDeleteConfirmed('  DELETE ')).toBe(true);
    expect(isDeleteConfirmed('delete')).toBe(false);
    expect(isDeleteConfirmed('')).toBe(false);
    expect(isDeleteConfirmed(null)).toBe(false);
  });
});

describe('exportFilename', () => {
  it('is dated', () => {
    expect(exportFilename(new Date('2026-10-08T12:00:00Z'))).toBe('winter-arc-export-2026-10-08.json');
  });
});
