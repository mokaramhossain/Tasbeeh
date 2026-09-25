#!/usr/bin/env node
/**
 * Checks that every verse cited on a name actually contains that name.
 *
 * The Qur'an text is Tanzil's "simple" edition, from the same open dataset
 * family the hadith pool comes from (fawazahmed0).
 *
 * What passes: a word in the verse with the name's letters, definite or
 * indefinite, once an attached وَ / فَ / بِ / لَ / كَ is removed. Letters, not
 * vowels, so this cannot tell ٱلْمَلِكُ (the King) from ٱلْمُلْكُ (sovereignty),
 * and it cannot check that the verse speaks *of Allah*. Both are a reader's
 * judgement, made when the verse was chosen in scripts/names.mjs. This catches
 * the other failure: a verse number misremembered or mistyped.
 *
 * Run: npm run data:verify-names
 */
import { NAMES } from './names.mjs';

const URL = 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/ara-quransimple.json';

/** Harakat, tanween, sukun, shadda, dagger alif, tatweel and Quranic marks. */
const MARKS = /[ؐ-ًؚ-ٰٟـۖ-ۭ]/g;

/**
 * Letters only. Tanween fath keeps its carrier alif (هَادِيًا → هاديا), which
 * the comparison below allows for.
 */
const bare = (word) => word.replace(/ٱ/g, 'ا').replace(MARKS, '');

/** The forms a word in a verse may take once its particles are removed. */
const candidates = (word) => {
  const out = new Set();
  const add = (w) => {
    out.add(w);
    if (w.startsWith('لل')) out.add(`ال${w.slice(2)}`);
  };
  const b = bare(word);
  add(b);
  for (const p of ['و', 'ف', 'ب', 'ل', 'ك']) if (b.startsWith(p)) add(b.slice(p.length));
  return [...out].flatMap((w) => [w, w.startsWith('ال') ? w.slice(2) : w]);
};

const response = await fetch(URL);
if (!response.ok) {
  console.error(`Could not fetch the Qur'an text: ${response.status}`);
  process.exit(1);
}
const { quran } = await response.json();
const verses = new Map(quran.map((v) => [`${v.chapter}:${v.verse}`, v.text]));

let failures = 0;
let cited = 0;
NAMES.forEach(([arabic, trn, , , , verse], i) => {
  if (!verse) return;
  cited += 1;
  const text = verses.get(verse);
  if (!text) {
    failures += 1;
    console.log(`✗ ${i + 1} ${trn}: ${verse} is not a verse`);
    return;
  }
  const words = bare(arabic).split(' ');
  let found;
  if (words.length > 1) {
    // Malik-ul-Mulk and Dhul-Jalali wal-Ikram: every word of the phrase, in order.
    const flat = bare(text).replace(/\s+/g, ' ');
    const phrase = words.map((w) => w.replace(/[ً-ْ]$/, '')).join(' ');
    found = flat.includes(phrase) ? phrase : undefined;
    if (!found) {
      const loose = words.map((w) => w.slice(0, -1));
      found = loose.every((w) => flat.includes(w)) ? loose.join(' … ') : undefined;
    }
  } else {
    const name = bare(arabic);
    const core = name.startsWith('ال') ? name.slice(2) : name;
    // A name ending in ي loses it when indefinite (هَادٍ), so both are accepted.
    const accept = new Set([core, core.replace(/ي$/, '')]);
    found = text.split(/\s+/).find((word) => candidates(word).some((form) => accept.has(form) || accept.has(form.replace(/ا$/, ''))));
  }
  if (found) {
    console.log(`✓ ${String(i + 1).padStart(2)} ${trn.padEnd(24)} ${verse.padEnd(7)} ${found}`);
  } else {
    failures += 1;
    console.log(`✗ ${i + 1} ${trn}: not found in ${verse}`);
  }
});

console.log(`\n${cited} verses checked, ${NAMES.length - cited} names cited to at-Tirmidhi 3507, ${failures} failed`);
process.exit(failures ? 1 : 0);
