#!/usr/bin/env node
/**
 * Checks that every verse cited on a name actually contains that name.
 *
 * The Qur'an text is Tanzil's "simple" edition, from the same open dataset
 * family the hadith pool comes from (fawazahmed0). The matching rules, and
 * what they cannot check, are in scripts/name-match.mjs.
 *
 * Run: npm run data:verify-names
 */
import { NAMES } from './names.mjs';
import { findName } from './name-match.mjs';

const URL = 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/ara-quransimple.json';

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
  const at = text ? findName(arabic, text) : null;
  if (at) {
    const found = text.split(' ').slice(at[0], at[1] + 1).join(' ');
    console.log(`✓ ${String(i + 1).padStart(2)} ${trn.padEnd(24)} ${verse.padEnd(7)} ${found}`);
  } else {
    failures += 1;
    console.log(`✗ ${i + 1} ${trn}: ${text ? `not found in ${verse}` : `${verse} is not a verse`}`);
  }
});

console.log(`\n${cited} verses checked, ${NAMES.length - cited} names cited to at-Tirmidhi 3507, ${failures} failed`);
process.exit(failures ? 1 : 0);
