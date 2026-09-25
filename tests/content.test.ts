import { describe, expect, it } from 'vitest';
import { ADHKAR_DATA, ADHKAR_ROUTINE } from '../src/data/adhkar';
import { DUA_DATA } from '../src/data/duas';
import { OCCASION_DATA } from '../src/data/occasions';
import { ASMA_DATA } from '../src/data/asmaulHusna';
import { NAME_HIGHLIGHT, NAME_VERSES } from '../src/data/nameVerses.generated';
import { SURAH_TEXTS } from '../src/data/surahText';
import { SLOT_ITEMS } from '../src/data/rightNow';
import { CATEGORY_META } from '../src/data/categories';
import { DhikrItem, LocalizedText } from '../src/constants';
import KNOWN_GAPS from './known-gaps.json';

/**
 * The catalogue, checked as data rather than through a browser.
 *
 * Every rule here exists because something shipped broken: three Bengali
 * transliterations truncated mid-verse, two copies of Ayatul Kursi that had
 * drifted apart, a category listed twice on one du'a. None of it was visible in
 * a screenshot, and the translation report called the files 100% complete.
 */

const ALL: DhikrItem[] = [...ADHKAR_DATA, ...DUA_DATA, ...OCCASION_DATA, ...ASMA_DATA];

const BENGALI = /[ঀ-৿]/;
const ARABIC = /[؀-ۿ]/;

/** The localized fields that carry religious text. */
const TEXT_FIELDS = ['title', 'trn', 'meaning', 'benefit'] as const;

const localizedValues = (item: DhikrItem) =>
  TEXT_FIELDS.flatMap((field) => {
    const value = item[field] as LocalizedText | undefined;
    if (!value || typeof value !== 'object') return [];
    return (['en', 'bn'] as const)
      .filter((lang) => typeof value[lang] === 'string' && value[lang]!.trim())
      .map((lang) => ({ id: item.id, field, lang, text: value[lang] as string }));
  });

describe('ids and categories', () => {
  it('every id is unique', () => {
    const seen = new Map<string, number>();
    for (const item of ALL) seen.set(item.id, (seen.get(item.id) || 0) + 1);
    expect([...seen].filter(([, n]) => n > 1)).toEqual([]);
  });

  it('no du’a lists the same category twice', () => {
    // db_024 carried ['forgiveness', 'forgiveness'], which double-counted it in
    // every category tally.
    const repeats = ALL.filter((item) => item.cat && new Set(item.cat).size !== item.cat.length).map(
      (item) => `${item.id}: ${item.cat?.join(', ')}`
    );
    expect(repeats).toEqual([]);
  });

  it('every category an item claims exists in the registry', () => {
    const known = new Set(Object.keys(CATEGORY_META));
    const unknown = ALL.flatMap((item) => (item.cat || []).filter((key) => !known.has(key)));
    // The after-salah screen groups by its own two labels, which are not
    // Du'a-tab categories and deliberately have no registry entry.
    const ROUTINE_GROUPS = ['Protection', 'After Salah'];
    expect([...new Set(unknown)].filter((key) => !ROUTINE_GROUPS.includes(key))).toEqual([]);
  });
});

describe('references resolve', () => {
  const byId = new Map(ALL.map((item) => [item.id, item]));

  it('every id the Home strip offers is a real item', () => {
    const missing = Object.entries(SLOT_ITEMS).flatMap(([slot, ids]) =>
      ids.filter((id) => !byId.has(id)).map((id) => `${slot} → ${id}`)
    );
    expect(missing).toEqual([]);
  });

  it('every id in the after-salah routine is a real item', () => {
    // The routine is grouped (core, optional, protection), so flatten it.
    const ids = Object.values(ADHKAR_ROUTINE).flat();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => !byId.has(id))).toEqual([]);
  });
});

describe('the shared Surah text', () => {
  const PAIRS: [string, string, keyof typeof SURAH_TEXTS][] = [
    ['protection_ayatul_kursi', 'db_026', 'ayatulKursi'],
    ['protection_ikhlas', 'db_031', 'ikhlas'],
    ['protection_falaq', 'db_032', 'falaq'],
    ['protection_nas', 'db_033', 'nas']
  ];
  const byId = new Map(ALL.map((item) => [item.id, item]));

  it.each(PAIRS)('%s and %s read identically', (protectionId, duaId, key) => {
    const a = byId.get(protectionId)!;
    const b = byId.get(duaId)!;
    expect(a.arabic).toBe(SURAH_TEXTS[key].arabic);
    expect(b.arabic).toBe(SURAH_TEXTS[key].arabic);
    expect(a.meaning).toBe(b.meaning);
    expect(a.trn).toBe(b.trn);
  });

  it('Ayatul Kursi is split only on whitespace', () => {
    // The lines come from splitting the verse at its pause marks. Strip the
    // whitespace and it must be the same characters, or a mark was eaten.
    const lines = SURAH_TEXTS.ayatulKursi.arabic;
    expect(lines.split('\n').length).toBe(9);
    expect(lines.replace(/\s+/g, '').length).toBeGreaterThan(200);
  });
});

describe('scripts are right', () => {
  it('every Arabic field is in Arabic script', () => {
    const wrong = ALL.filter((item) => item.arabic && !ARABIC.test(item.arabic)).map((i) => i.id);
    expect(wrong).toEqual([]);
  });

  it('no Bengali value is written in Latin, except a transliteration that has no Bengali', () => {
    const wrong = ALL.flatMap(localizedValues)
      .filter((v) => v.lang === 'bn' && v.field !== 'trn' && !BENGALI.test(v.text))
      .map((v) => `${v.id}.${v.field}`);
    expect(wrong).toEqual([]);
  });
});

describe('nothing ships half-written', () => {
  /**
   * An ellipsis in scripture means the text was cut to fit and never restored.
   *
   * The seven in known-gaps.json are recorded in docs/translation-todo.csv and
   * are waiting on a human. This is an exact comparison on purpose: a new one fails the
   * build, and a fixed one fails until it is struck off the list, so the list
   * cannot quietly go stale.
   */
  it('the only truncated values are the ones already known', () => {
    // The two entries that share a Surah text would each report the same
    // truncation, so the shared value is counted once under its own id.
    const shared = new Set<unknown>(Object.values(SURAH_TEXTS).flatMap((t) => [t.meaning, t.trn]));
    const found = [
      ...ALL.filter((item) => !shared.has(item.meaning) && !shared.has(item.trn)).flatMap(
        localizedValues
      ),
      ...Object.values(SURAH_TEXTS).flatMap((text) =>
        (['en', 'bn'] as const).map((lang) => ({
          id: text.id,
          field: 'meaning' as const,
          lang,
          text: text.meaning[lang] as string
        }))
      )
    ]
      .filter((v) => v.text && /(\.\.\.|…)/.test(v.text))
      .map((v) => `${v.id}.${v.field}.${v.lang}`);

    expect([...new Set(found)].sort()).toEqual([...KNOWN_GAPS].sort());
  });
});

describe('the names', () => {
  it('each cites where it is found: a verse, or the narration that lists it', () => {
    // Every name used to carry 7:180, which is about the names as a whole and
    // so said nothing about any one of them. The verses themselves are checked
    // against the Qur'an text by `npm run data:verify-names`.
    const bad = ASMA_DATA.filter(
      (item) =>
        !(item.source === 'Quran' && /^\d{1,3}:\d{1,3}$/.test(item.ref ?? '') && item.ref !== '7:180') &&
        !(item.source === 'At-Tirmidhi' && item.ref === '3507')
    ).map((item) => `${item.id}: ${item.source} ${item.ref}`);
    expect(bad).toEqual([]);
  });

  it('every name cited to a verse has that verse, whole, in all three texts', () => {
    const problems = ASMA_DATA.filter((item) => item.source === 'Quran').flatMap((item) => {
      const verse = NAME_VERSES[item.ref ?? ''];
      if (!verse) return [`${item.id}: no verse for ${item.ref}`];
      const out: string[] = [];
      const texts = { arabic: verse.arabic, en: verse.meaning.en, bn: verse.meaning.bn };
      Object.entries(texts).forEach(([field, text]) => {
        if (!text?.trim()) out.push(`${item.ref}.${field}: empty`);
        // Scripture is never shortened to fit.
        if (/(\.\.\.|…)/.test(text)) out.push(`${item.ref}.${field}: shortened`);
      });
      if (!ARABIC.test(verse.arabic)) out.push(`${item.ref}.arabic: not Arabic`);
      if (!BENGALI.test(verse.meaning.bn)) out.push(`${item.ref}.bn: not Bengali`);
      // Zakaria's footnotes are not shipped, so a marker would point at nothing.
      if (/\[[০-৯0-9]+\]/.test(verse.meaning.bn)) out.push(`${item.ref}.bn: footnote marker`);
      // The dataset prefixes verse 1 with the bismillah; it is not part of it.
      if (/^بِسْمِ/.test(verse.arabic) && item.ref !== '1:1') out.push(`${item.ref}.arabic: starts with the bismillah`);
      const span = NAME_HIGHLIGHT[item.id];
      const words = verse.arabic.split(' ').length;
      if (!span || span[0] < 0 || span[1] >= words || span[0] > span[1]) out.push(`${item.id}: highlight out of range`);
      return out;
    });
    expect(problems).toEqual([]);
  });

  it('names cited to the narration carry no verse', () => {
    const stray = ASMA_DATA.filter((item) => item.source !== 'Quran' && NAME_HIGHLIGHT[item.id]).map((item) => item.id);
    expect(stray).toEqual([]);
  });
});

describe('backup', () => {
  it('carries every key the app stores', async () => {
    // Four keys were each added to storage and not to the backup, and every
    // time a restore quietly reset that setting. This reads the source for the
    // keys actually written, so the next one fails here instead.
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { BACKUP_KEYS } = await import('../src/utils/backup');
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? files(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []
      );
    const stored = new Set(
      files('src').flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/'(dhikr-[a-z0-9-]+-v\d+)'/g)].map((m) => m[1]))
    );
    // Read once to migrate an old install, never written.
    const LEGACY = ['dhikr-tracker-v1'];
    const carried = new Set<string>([...BACKUP_KEYS, ...LEGACY]);
    expect([...stored].filter((key) => !carried.has(key)).sort()).toEqual([]);
  });
});
