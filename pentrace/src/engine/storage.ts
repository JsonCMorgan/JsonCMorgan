export const SAVE_KEY = 'pentrace-save-v1';
export const PREFS_KEY = 'pentrace-prefs-v1';

/** Keys used while the game was called NEONTRACE, mapped to their PenTrace replacements. */
export const LEGACY_KEYS: Record<string, string> = {
  'neontrace-save-v1': SAVE_KEY,
  'neontrace-prefs-v1': PREFS_KEY,
};

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Moves NEONTRACE saves and prefs to the PenTrace keys. An existing PenTrace value always wins,
 * and a legacy value is only removed once its copy is written.
 */
export function migrateLegacyStorage(store: KeyValueStore): string[] {
  const moved: string[] = [];
  for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
    const legacy = store.getItem(oldKey);
    if (legacy === null) continue;
    if (store.getItem(newKey) === null) {
      store.setItem(newKey, legacy);
      moved.push(newKey);
    }
    store.removeItem(oldKey);
  }
  return moved;
}
