/**
 * Legacy storage-key migration.
 *
 * The app was rebranded from EchoLearn → Trellis on 2026-05-07. All
 * localStorage keys moved from the `echolearn_*` prefix to `trellis_*`.
 * This module copies any pre-rebrand keys forward on first boot so existing
 * users don't lose data.
 *
 * Idempotent: safe to call on every boot. Once an `echolearn_*` key has been
 * copied (or its `trellis_*` counterpart already exists), the old key is
 * deleted so the migration cost stays O(0) on subsequent boots.
 *
 * Native SQLite database (Capacitor) is intentionally NOT migrated — the
 * connection name `'echolearn'` in db.service.ts is kept for backwards compat
 * since renaming would orphan the on-disk DB file.
 */

const LEGACY_PREFIX = 'echolearn_';
const NEW_PREFIX = 'trellis_';

export function migrateLegacyKeys(): { copied: number; skipped: number } {
  let copied = 0;
  let skipped = 0;

  if (typeof localStorage === 'undefined') return { copied, skipped };

  // Snapshot keys first — mutating localStorage during iteration with
  // localStorage.key(i) is unreliable when we delete keys mid-loop.
  const legacyKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LEGACY_PREFIX)) legacyKeys.push(key);
  }

  for (const oldKey of legacyKeys) {
    const newKey = NEW_PREFIX + oldKey.slice(LEGACY_PREFIX.length);
    try {
      const newValue = localStorage.getItem(newKey);
      if (newValue !== null) {
        // New key already populated (user opened the app post-rebrand and
        // generated fresh data). Don't clobber. Just drop the legacy copy.
        localStorage.removeItem(oldKey);
        skipped++;
        continue;
      }
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue === null) {
        skipped++;
        continue;
      }
      localStorage.setItem(newKey, oldValue);
      localStorage.removeItem(oldKey);
      copied++;
    } catch {
      // Quota or serialization errors — leave both keys in place so a future
      // boot can retry. Don't throw; migration must never block app start.
    }
  }

  return { copied, skipped };
}
