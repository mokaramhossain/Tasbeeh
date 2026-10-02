import { LocalizedText } from '../constants';

export type Slot =
  | 'lastthird'
  | 'morning'
  | 'anytime'
  | 'evening'
  | 'night'
  | 'friday'
  | 'ramadan'
  | 'lastten'
  | 'eid'
  | 'arafah';

/*
 * Headers name the content, not the reader.
 *
 * "This morning" and "Right now" were claims about what someone was doing,
 * made from a clock that knows only what time it is. "Morning adhkar" is a
 * claim about the du'as, which is the only thing here that can be checked.
 */
export const SLOT_META: Record<Slot, { label: LocalizedText; icon: string; occasion?: boolean }> = {
  lastthird: { label: { en: 'The last part of the night', bn: 'রাতের শেষ ভাগ' }, icon: '🌌' },
  morning: { label: { en: 'Morning adhkar', bn: 'সকালের যিকর' }, icon: '🌤️' },
  anytime: { label: { en: 'Anytime', bn: 'যেকোনো সময়' }, icon: '🤲' },
  evening: { label: { en: 'Evening adhkar', bn: 'সন্ধ্যার যিকর' }, icon: '🌇' },
  night: { label: { en: 'Before sleep', bn: 'ঘুমের আগে' }, icon: '🌙' },
  friday: { label: { en: 'It’s Friday', bn: 'আজ জুমুআ' }, icon: '🕌' },
  ramadan: { label: { en: 'Ramadan', bn: 'রমাদান' }, icon: '🌙', occasion: true },
  lastten: { label: { en: 'The last ten nights', bn: 'শেষ দশ রাত' }, icon: '✨', occasion: true },
  eid: { label: { en: 'Eid', bn: 'ঈদ' }, icon: '🎉', occasion: true },
  arafah: { label: { en: 'The Day of Arafah', bn: 'আরাফার দিন' }, icon: '⛰️', occasion: true }
};

/**
 * Which items each slot offers, curated by id.
 *
 * Deliberately a hand-picked list rather than a query over `tags`: tags are
 * free text with 170 distinct values, so anything derived from them surfaces
 * near-misses and the strip stops being trustworthy. Each list is in priority
 * order and only the first two are shown (see `slotItems`) — this is a nudge,
 * not a second catalogue. Ids are resolved through `itemsById` and
 * filtered, so a renamed or removed item shortens the strip instead of
 * rendering a blank row.
 */
export const SLOT_ITEMS: Record<Slot, string[]> = {
  // The catalogue has no tahajjud or suhoor du'a, and inventing one to fill a
  // slot would be worse than an honest choice: istighfar is what the last third
  // of the night is actually known for, so that is what it offers.
  lastthird: ['db_050', 'db_024', 'db_063'],
  morning: ['db_029', 'db_034', 'db_036'],
  // Not time-bound, and labelled so. The slot used to say "Right now" over the
  // same two general du'as, which claimed a precision it did not have.
  anytime: ['db_001', 'db_005', 'db_046'],
  // db_024 and db_036 appear in two slots on purpose — they are morning-*and*-
  // evening adhkar, so that is accuracy rather than duplication.
  evening: ['db_035', 'db_036', 'db_024'],
  night: ['db_028', 'db_030', 'db_031'],
  friday: ['occ_006', 'db_025'],
  ramadan: ['occ_002', 'occ_003'],
  lastten: ['occ_001', 'occ_002'],
  eid: ['occ_004', 'occ_003'],
  arafah: ['occ_005']
};

/**
 * The Hijri date, or null on an engine without the Islamic calendars.
 *
 * Umm al-Qura is *calculated*. Local moon sighting commonly differs from it by
 * a day — Bangladesh included — so nothing here may assert that today is a
 * particular sacred date. The windows below are deliberately wide and the
 * labels name a period ("the last ten nights") rather than a claim ("tonight is
 * Laylat al-Qadr"). Offering the du'a and letting the reader judge the date is
 * the only honest option.
 */
export const hijriParts = (
  now: Date,
  offsetDays = 0
): { year: number; month: number; day: number } | null => {
  try {
    const shifted = new Date(now.getTime() + offsetDays * 86400000);
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });

    // An engine that does not carry the Islamic calendars does not say so — it
    // quietly resolves to `gregory` and returns Gregorian numbers, which would
    // be rendered as "10 Sha'ban 2026 AH": confidently, invisibly wrong. Some
    // Android WebViews ship a reduced ICU, so this is checked rather than
    // assumed, and a device that cannot do it gets no date at all.
    if (!fmt.resolvedOptions().calendar?.startsWith('islamic')) return null;

    const parts = fmt.formatToParts(shifted);
    const at = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const year = at('year');
    const month = at('month');
    const day = at('day');
    if (![year, month, day].every(Number.isFinite)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 30) return null;
    // A Gregorian year that slipped through the check above would land far
    // outside this range; a real Hijri year for any living reader will not.
    if (year < 1300 || year > 1600) return null;
    return { year, month, day };
  } catch {
    return null;
  }
};

/**
 * The month names, written here rather than read from the engine.
 *
 * WebKit renders `month: 'long'` on the islamic calendars from the *Gregorian*
 * name table: Settings showed "February 27, 1448 BC" on iOS, because Safar is
 * the second month and February is the second Gregorian one, with the era taken
 * from the BC/AD table too. The numbers above are correct on every engine —
 * only the names and the era are not — so the names live here and nothing but
 * numeric parts is ever asked of `Intl`. ICU's Bangla is no better: it renders
 * the era as "যুগ", which means an age or epoch, not the Hijra.
 */
export const HIJRI_MONTHS: LocalizedText[] = [
  { en: 'Muharram', bn: 'মুহাররম' },
  { en: 'Safar', bn: 'সফর' },
  { en: 'Rabi al-Awwal', bn: 'রবিউল আউয়াল' },
  { en: 'Rabi al-Thani', bn: 'রবিউস সানি' },
  { en: 'Jumada al-Ula', bn: 'জুমাদাল উলা' },
  { en: 'Jumada al-Akhirah', bn: 'জুমাদাল আখিরাহ' },
  { en: 'Rajab', bn: 'রজব' },
  { en: 'Sha’ban', bn: 'শাবান' },
  { en: 'Ramadan', bn: 'রমাদান' },
  { en: 'Shawwal', bn: 'শাওয়াল' },
  { en: 'Dhul-Qa’dah', bn: 'জিলকদ' },
  { en: 'Dhul-Hijjah', bn: 'জিলহজ' }
];

/** After the Hijra — never the engine's era, which reads "BC" on iOS. */
export const HIJRI_ERA: LocalizedText = { en: 'AH', bn: 'হিজরি' };

/**
 * The time of day, by the device clock and nothing else.
 *
 * Boundaries are in minutes from midnight so they can fall on a half hour,
 * which the hour-only arithmetic that once put 3am in the same bucket as
 * bedtime could not do.
 */
const timeSlot = (now: Date): Slot => {
  const minutes = now.getHours() * 60 + now.getMinutes();
  // The pre-dawn window closes at 04:30. It ran to 05:29 and was still calling
  // 5:10am "the last part of the night" — by then Fajr has passed for most of
  // the year in most places, and istighfar for the night is the wrong offer
  // once the morning adhkar are due. No fixed hour is right everywhere: Fajr
  // moves by season and latitude, so this is a compromise that errs towards
  // the morning. Anchoring it to a Fajr time the reader sets once is the only
  // way to make it actually correct, and is not built yet.
  if (minutes >= 180 && minutes < 270) return 'lastthird';
  if (minutes < 660) return minutes < 180 ? 'night' : 'morning';
  if (minutes < 900) return 'anytime';
  if (minutes < 1170) return 'evening';
  return 'night';
};

/**
 * Occasion beats the clock; Friday joins the clock rather than replacing it.
 *
 * `offsetDays` is the reader's own correction. Moon sighting differs by
 * country and often by a day from any calculated calendar, and the app has no
 * way to know which authority someone follows — asking the device where it is
 * would be both a privacy cost and still a guess. So the person sets it once
 * in Settings and the app believes them.
 *
 * Friday used to be checked above the clock, which meant the morning and
 * evening adhkar vanished from the strip for the whole of every Friday. It is
 * now a modifier: `slotItems` prepends the Friday salawat to whatever the hour
 * already offers. A Hijri occasion still overrides outright, because Arafah
 * genuinely displaces an ordinary day in a way a weekday does not.
 */
export const currentSlot = (now: Date = new Date(), offsetDays = 0): Slot => {
  const h = hijriParts(now, offsetDays);
  if (h) {
    if (h.month === 9 && h.day >= 20) return 'lastten';
    // Arafah is the 9th. The 10th is Eid al-Adha, so the window stops at 9 —
    // widened only to the 8th, which people commonly fast alongside it.
    if (h.month === 12 && h.day >= 8 && h.day <= 9) return 'arafah';
    if ((h.month === 10 && h.day <= 2) || (h.month === 12 && h.day >= 10 && h.day <= 13)) return 'eid';
    if (h.month === 9) return 'ramadan';
  }

  return now.getDay() === 5 ? 'friday' : timeSlot(now);
};

/**
 * The ids this moment offers, at most two.
 *
 * Two, not three: the strip sits above the routine, and three rows pushed Play
 * the routine down a screen that exists to be pressed. Two still leaves Friday
 * room for the salawat *and* the hour's du'a; one would drop the morning or
 * evening adhkar from Home every Friday.
 *
 * Friday contributes exactly **one** lead item and the hour supplies the rest.
 * Letting it contribute its whole list filled two of the three places and
 * pushed the morning adhkar back off the screen — which was the original
 * complaint in a quieter form, not a fix for it. Duplicates are dropped and the
 * cap is applied last, so there is one rule rather than a per-slot accident.
 */
export const slotItems = (slot: Slot, now: Date = new Date()): string[] => {
  const ids =
    slot === 'friday'
      ? [...SLOT_ITEMS.friday.slice(0, 1), ...SLOT_ITEMS[timeSlot(now)]]
      : SLOT_ITEMS[slot];
  return [...new Set(ids)].slice(0, 2);
};

/** Shown under an occasion strip, never under a time-of-day one. */
export const HIJRI_NOTE: LocalizedText = {
  en: 'Dates follow a calculated calendar and may differ from your local moon sighting. You can adjust this in Settings.',
  bn: 'তারিখ গণনাভিত্তিক ক্যালেন্ডার অনুসারে; আপনার এলাকার চাঁদ দেখার সাথে পার্থক্য হতে পারে। সেটিংস থেকে ঠিক করে নিতে পারেন।'
};

/**
 * Today's Hijri date, ready for Settings to show what the app believes.
 *
 * Returns pieces rather than a finished string so the caller can put the day
 * and year through `formatDigits` and read ২৬ সফর ১৪৪৮ হিজরি in Bangla.
 */
export const hijriLabelParts = (
  now: Date,
  offsetDays: number
): { day: number; month: LocalizedText; year: number; era: LocalizedText } | null => {
  const h = hijriParts(now, offsetDays);
  if (!h) return null;
  return { day: h.day, month: HIJRI_MONTHS[h.month - 1], year: h.year, era: HIJRI_ERA };
};
