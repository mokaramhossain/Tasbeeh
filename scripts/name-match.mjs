/**
 * Finding a name inside a verse, shared by the verifier and the verse build.
 *
 * Letters, not vowels: harakat, tanween, shadda and the Quranic pause marks are
 * removed before comparing, and an attached وَ / فَ / بِ / لَ / كَ is allowed.
 * So this cannot tell ٱلْمَلِكُ (the King) from ٱلْمُلْكُ (sovereignty), and it
 * cannot tell that a verse speaks *of Allah*. Both were a reader's judgement,
 * made when each verse was chosen in scripts/names.mjs. What it does catch is
 * a verse number misremembered or mistyped.
 */

/** Harakat, tanween, sukun, shadda, dagger alif, tatweel and Quranic marks. */
const MARKS = /[ؐ-ًؚ-ٰٟـۖ-ۭ]/g;

/**
 * Letters only. Tanween fath keeps its carrier alif (هَادِيًا → هاديا), which
 * `wordMatches` allows for.
 */
export const bare = (word) => word.replace(/ٱ/g, 'ا').replace(MARKS, '');

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

const wordMatches = (word, name) => {
  const b = bare(name);
  const core = b.startsWith('ال') ? b.slice(2) : b;
  // A name ending in ي loses it when indefinite (هَادٍ), so both are accepted.
  const accept = new Set([core, core.replace(/ي$/, '')]);
  return candidates(word).some((form) => accept.has(form) || accept.has(form.replace(/ا$/, '')));
};

/**
 * Where the name sits in the verse, as [first, last] indexes into
 * `verse.split(' ')`, or null when it is not there.
 *
 * Two names are phrases — Malik-ul-Mulk, Dhul-Jalali wal-Ikram — and are found
 * as consecutive words, the first word compared without its case ending.
 */
export const findName = (arabicName, verse) => {
  const words = verse.split(' ');
  const parts = arabicName.split(' ');
  if (parts.length === 1) {
    const at = words.findIndex((word) => wordMatches(word, arabicName));
    return at === -1 ? null : [at, at];
  }
  const stem = (w) => bare(w).replace(/^ال/, '').replace(/^وال/, '').slice(0, -1);
  const want = parts.map(stem);
  for (let i = 0; i + want.length <= words.length; i += 1) {
    if (want.every((part, k) => bare(words[i + k]).includes(part))) return [i, i + want.length - 1];
  }
  return null;
};
