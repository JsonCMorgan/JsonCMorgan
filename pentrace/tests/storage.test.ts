import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { migrateLegacyStorage, PREFS_KEY, SAVE_KEY } from '../src/engine/storage';

function memoryStore(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('NEONTRACE to PenTrace save migration', () => {
  it('moves an old save and prefs to the new keys, and the save still loads', () => {
    const old = new Game(null, 42, { tutorial: false });
    old.profile.credits = 1234;
    old.profile.totalEarned = 1234;
    const store = memoryStore({
      'neontrace-save-v1': JSON.stringify(old.serialize()),
      'neontrace-prefs-v1': '{"tutorial":false}',
    });

    expect(migrateLegacyStorage(store)).toEqual([SAVE_KEY, PREFS_KEY]);
    expect(store.data.has('neontrace-save-v1')).toBe(false);
    expect(store.getItem(PREFS_KEY)).toBe('{"tutorial":false}');

    const loaded = new Game(JSON.parse(store.getItem(SAVE_KEY)!));
    expect(loaded.profile.credits).toBe(1234);
    expect(loaded.world.org).toBe(old.world.org);
    expect(loaded.inTutorial).toBe(false);
  });

  it('never overwrites an existing PenTrace save', () => {
    const store = memoryStore({ 'neontrace-save-v1': 'old', [SAVE_KEY]: 'new' });
    expect(migrateLegacyStorage(store)).toEqual([]);
    expect(store.getItem(SAVE_KEY)).toBe('new');
    expect(store.data.has('neontrace-save-v1')).toBe(false);
  });

  it('does nothing when there is no old save', () => {
    const store = memoryStore();
    expect(migrateLegacyStorage(store)).toEqual([]);
    expect(store.data.size).toBe(0);
  });
});
