import { isPlainObject } from './storage';

export const BACKUP_KEYS = [
  'dhikr-tracker-v2',
  'dhikr-lifetime-counts-v1',
  'dhikr-custom-v1',
  'dhikr-personal-sections-v1',
  'dhikr-favorites-v1',
  'dhikr-favorites-metadata-v1',
  'dhikr-pinned-v1',
  'dhikr-targets-v1',
  'dhikr-theme-v1',
  'dhikr-language-v1',
  'dhikr-haptic-v1',
  'dhikr-sound-v1',
  'dhikr-auto-advance-v1',
  'dhikr-reading-position-v1',
  'dhikr-category-target-v1',
  'dhikr-reset-baseline-v1',
  'dhikr-record-v1',
  'dhikr-today-counts-v1',
  'dhikr-arabic-font-size-v1',
  'dhikr-english-font-size-v1',
  // These four were persisted but never exported, so a restore silently reset
  // line spacing, both reading toggles, and the recently-read list.
  'dhikr-arabic-leading-v1',
  'dhikr-reading-leading-v1',
  // Carried so a restore onto a fresh install does not have the raised reading
  // defaults applied a second time over sizes the reader had already chosen.
  'dhikr-type-defaults-v2',
  'dhikr-show-transliteration-v1',
  'dhikr-show-translation-v1',
  'dhikr-recent-v1',
  // Restoring a backup must not put a returning user back through setup.
  'dhikr-setup-done-v1',
  'dhikr-install-hint-v1',
  'dhikr-hijri-offset-v1',
  'dhikr-visits-v1',
  // How much of the routine Home carries. Missed when it was added, so a
  // restore put everyone back on the default scope.
  'dhikr-routine-scope-v1',
  // Carried for the same reason as the type defaults: a restore onto a fresh
  // install must not switch "Continue to the next" on over a chosen "off".
  'dhikr-auto-advance-default-v1'
] as const;

export interface BackupFile {
  app: 'dhikr-tracker';
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

/**
 * Everything lives in localStorage and nothing is synced to a server, so
 * clearing site data or switching devices loses years of counts. Export/import
 * gives the user a way to keep that history.
 */
export const createBackup = (): BackupFile => {
  const data: Record<string, string> = {};
  BACKUP_KEYS.forEach((key) => {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    } catch {
      /* ignore */
    }
  });
  return {
    app: 'dhikr-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  };
};

export const downloadBackup = (backup: BackupFile) => {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `dhikr-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so Safari has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export type RestoreResult = { ok: true; restored: number } | { ok: false; reason: string };

export const restoreBackup = (raw: string): RestoreResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'not-json' };
  }

  if (!isPlainObject(parsed) || parsed.app !== 'dhikr-tracker' || !isPlainObject(parsed.data)) {
    return { ok: false, reason: 'not-a-backup' };
  }

  const data = parsed.data;
  let restored = 0;
  const allowed = new Set<string>(BACKUP_KEYS);

  for (const [key, value] of Object.entries(data)) {
    if (!allowed.has(key) || typeof value !== 'string') continue;
    try {
      // Reject anything that is not valid JSON so we never write a payload that
      // would crash the next startup.
      JSON.parse(value);
    } catch {
      // Plain strings (the language key) are stored unquoted, so allow short
      // non-JSON values through rather than dropping them.
      if (value.length > 32) continue;
    }
    try {
      localStorage.setItem(key, value);
      restored += 1;
    } catch {
      return { ok: false, reason: 'storage-full' };
    }
  }

  if (restored === 0) return { ok: false, reason: 'empty' };
  return { ok: true, restored };
};
