import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCcw,
  Plus,
  X,
  Edit2,
  BookOpen,
  Loader2,
  Star,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { APP_NAME, APP_SHORT_NAME, DhikrItem, Language, LocalizedText, THEMES } from './constants';
import { ADHKAR_DATA, ADHKAR_ROUTINE } from './data/adhkar';
import { DUA_DATA } from './data/duas';
import { ASMA_CYCLE_ITEM, ASMA_DATA, isAsmaId } from './data/asmaulHusna';
import { OCCASION_DATA } from './data/occasions';
import { currentSlot, slotItems, type Slot } from './data/rightNow';
import { ALL_SURAHS } from './data/surahs';
import {
  CATEGORY_META as CATEGORY_LABELS,
  DUA_CATEGORIES,
  ROUTINE_SCOPES,
  type RoutineScope
} from './data/categories';

/** Marks a pinned id as a whole category rather than one item. */
const CATEGORY_PIN = 'cat:';
/** Marks a repetition as belonging to one of your collections, not a category. */
const SECTION_TARGET = 'sec:';

/** The reader's key for the routine, so it resumes like any other set. */
const ROUTINE_KEY = 'routine';
import { createTranslate } from './i18n';
import { LANGUAGE_CODES, DEFAULT_LANGUAGE, languageInfo } from './locales';
import { applyTheme, resolveThemeId } from './theme';
import { getLocalDateString, msUntilNextLocalMidnight, parseLocalDate } from './utils/date';
import { normalizeForSearch } from './utils/search';
import { formatDuaAsText, shareText } from './utils/share';
import { pruneDayCounts, readDayCounts, reconcileLifetime } from './utils/counts';
import { downloadSurah } from './utils/quran';
import {
  readJSON,
  writeJSON,
  readString,
  writeString,
  isPlainObject,
  isStringArray
} from './utils/storage';

/**
 * Everything the Du'a tab browses. The names are a separate set rather than
 * appended to DUA_DATA so the du'a count stays honest and adhkar stay out.
 */
const DUA_TAB_DATA: DhikrItem[] = [...DUA_DATA, ...OCCASION_DATA, ...ASMA_DATA];

/**
 * Everything resolvable by id. The cycle marker belongs here but not above:
 * the Record needs to name it, and a du'a list must never show it as a row.
 */
const DHIKR_DATA: DhikrItem[] = [...ADHKAR_DATA, ...DUA_TAB_DATA, ASMA_CYCLE_ITEM];
const SUPPORT_EMAIL = 'app@qubeq.com';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.moizit.dhikrtracker';

// Components
import BottomNav from './components/BottomNav';
import FocusModeOverlay from './components/FocusModeOverlay';
import BackupModal from './components/BackupModal';
import UpdatePrompt from './components/UpdatePrompt';
import FirstRunSetup from './components/FirstRunSetup';
import InstallPrompt from './components/InstallPrompt';
import type { RecentEntry } from './components/CollectionRow';
import useBackNavigation from './hooks/useBackNavigation';

// Screens
import AdhkarScreen from './screens/AdhkarScreen';
import DuaScreen from './screens/DuaScreen';
import PersonalScreen from './screens/PersonalScreen';
import MoreScreen from './screens/MoreScreen';

// --- Types ---
type Counts = Record<string, number>;
type PersonalSection = { id: string; name: LocalizedText };

type ConfirmAction =
  | { type: 'reset-all' }
  | { type: 'reset-routine' }
  | { type: 'reset-names' }
  | { type: 'delete-item'; id: string }
  | { type: 'delete-section'; id: string };

type Overlay =
  | { kind: 'manual' }
  | { kind: 'surah' }
  | { kind: 'section' }
  | { kind: 'rating' }
  | { kind: 'backup' }
  | { kind: 'target'; itemId: string }
  | { kind: 'confirm'; title: string; message: string; action: ConfirmAction }
  | {
      kind: 'focus';
      ids: string[];
      index: number;
      cycle?: boolean;
      category?: string;
      /** Opened by a "read through" button rather than by tapping one du'a. */
      playthrough?: boolean;
    };

type ManualDraft = {
  title: string;
  arabic: string;
  trn: string;
  meaning: string;
  benefit: string;
  source: string;
  ref: string;
  target: number;
  sectionId: string;
};

const EMPTY_DRAFT: ManualDraft = {
  title: '',
  arabic: '',
  trn: '',
  meaning: '',
  benefit: '',
  source: '',
  ref: '',
  target: 0,
  sectionId: 'all'
};

const DEFAULT_SECTIONS: PersonalSection[] = [{ id: 'all', name: 'All Items' }];

/** The category the names are filed under, and their recent-list entry. */
const NAMES_KEY = 'names';
const recentKey = (id: string) => (isAsmaId(id) ? `${CATEGORY_PIN}${NAMES_KEY}` : id);

/** Reads one language out of a stored value without falling back to the other. */
const localeField = (value: LocalizedText | undefined, lang: Language): string =>
  typeof value === 'string' ? value : value?.[lang] ?? '';

/**
 * Writes `next` into the active language while keeping whatever was stored for
 * the other one. Editing a bilingual item in English must not overwrite its
 * Bengali text with the English.
 */
const mergeLocalized = (existing: LocalizedText | undefined, next: string, lang: Language) => ({
  en: lang === 'en' ? next : localeField(existing, 'en') || next,
  bn: lang === 'bn' ? next : localeField(existing, 'bn') || next
});

/** Quick-pick counts offered in the Set Target dialog. Kept odd (witr). */
const TARGET_PRESETS = [3, 7, 11, 33, 101, 999];

/** Set once the raised reading defaults have been taken up. */
const TYPE_DEFAULTS_KEY = 'dhikr-type-defaults-v2';

/** Set once "Continue to the next" has been switched on for an existing profile. */
const AUTO_ADVANCE_DEFAULT_KEY = 'dhikr-auto-advance-default-v1';

/**
 * A stored size that is still exactly the old default is one nobody chose.
 *
 * Every preference is written to storage on first render, so "unset" does not
 * exist by the time anyone reads this — matching the old default is the only
 * available signal, and it is only trusted once. After the marker is written a
 * reader who genuinely wants the smaller size keeps it.
 */
const adoptedSize = (key: string, was: number, now: number): number => {
  const stored = readJSON<number>(key, now);
  if (readJSON(TYPE_DEFAULTS_KEY, false)) return stored;
  return stored === was ? now : stored;
};

export default function App() {
  const [activeTab, setActiveTab] = useState(0); // 0: Adhkar, 1: Du'a, 2: Personal, 3: More
  const [duaSearchQuery, setDuaSearchQuery] = useState('');
  const [duaSelectedCategory, setDuaSelectedCategory] = useState('All');
  const [personalSearchQuery, setPersonalSearchQuery] = useState('');
  const [currentDate, setCurrentDate] = useState(() => getLocalDateString());

  const [counts, setCounts] = useState<Record<string, Counts>>(() => {
    const stored = pruneDayCounts(readDayCounts());
    // With the record off nothing is written to it, so today's counters are
    // read back from a key of their own — otherwise a reload at noon would
    // silently zero a tasbeeh someone was halfway through.
    if (readJSON('dhikr-record-v1', true)) return stored;
    const key = getLocalDateString();
    const today = readJSON<{ date: string; values: Counts }>(
      'dhikr-today-counts-v1',
      { date: '', values: {} },
      isPlainObject
    );
    return today.date === key ? { ...stored, [key]: today.values } : stored;
  });
  // Kept separately from day counts, which are pruned to 400 days, so the
  // all-time total survives. Writing was paused in v1.0.2 but the key was never
  // deleted, so anyone who used an earlier build keeps their history.
  // Reconciled against the day buckets on load rather than trusted as-is:
  // lifetime writes were paused in v1.0.2, so the stored map is missing that
  // window for older users and absent entirely for anyone who installed then.
  const [lifetimeCounts, setLifetimeCounts] = useState<Counts>(() =>
    reconcileLifetime(
      readJSON<Counts>('dhikr-lifetime-counts-v1', {}, isPlainObject),
      pruneDayCounts(readDayCounts())
    )
  );
  const [customItems, setCustomItems] = useState<DhikrItem[]>(() =>
    readJSON<DhikrItem[]>('dhikr-custom-v1', [], Array.isArray)
  );
  const [personalSections, setPersonalSections] = useState<PersonalSection[]>(() => {
    const saved = readJSON<PersonalSection[]>('dhikr-personal-sections-v1', DEFAULT_SECTIONS, Array.isArray);
    // The "all" bucket must always exist or the Personal screen has no home
    // section to fall back to.
    return saved.some((section) => section.id === 'all') ? saved : [...DEFAULT_SECTIONS, ...saved];
  });
  const [favoritesMetadata, setFavoritesMetadata] = useState<Record<string, { sectionId?: string }>>(() =>
    readJSON('dhikr-favorites-metadata-v1', {}, isPlainObject)
  );
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readJSON<string[]>('dhikr-pinned-v1', [], isStringArray));
  // Where each pinned collection was left, so a set of ninety-nine can be read
  // across a day rather than only in one sitting.
  const [readingPositions, setReadingPositions] = useState<Record<string, number>>(() =>
    readJSON<Record<string, number>>('dhikr-reading-position-v1', {}, isPlainObject)
  );
  const [favorites, setFavorites] = useState<string[]>(() =>
    readJSON<string[]>('dhikr-favorites-v1', [], isStringArray)
  );
  /**
   * How many times each du'a in a category is recited before moving on.
   *
   * A set is often read with a repetition — each of the ninety-nine three
   * times, or seven — and setting that on all 99 items by hand is not a thing
   * anyone would do. One number on the parent covers the whole family; an item
   * with its own target still wins, so a deliberate choice is never overridden.
   */
  const [categoryTargets, setCategoryTargets] = useState<Counts>(() =>
    readJSON<Counts>('dhikr-category-target-v1', {}, isPlainObject)
  );
  /**
   * What "Reset" has already accounted for today.
   *
   * Reset used to delete from the day's counts, which also erased that day from
   * the Record — the calendar square, the day's total, and "days with dhikr".
   * A record of worship should not be destroyed by clearing a counter, so the
   * counts stay and this marks where the current round began. The screens
   * subtract it; the Record does not, and is permanent.
   *
   * Held with its date so it lapses at midnight along with the day it describes.
   */
  const [resetBaseline, setResetBaseline] = useState<{ date: string; values: Counts }>(() =>
    readJSON<{ date: string; values: Counts }>(
      'dhikr-reset-baseline-v1',
      { date: '', values: {} },
      isPlainObject
    )
  );
  /**
   * Whether a history is kept at all.
   *
   * On by default — the Record is where a month of dhikr becomes visible, and
   * hiding it by default would mean most people never find it. Off means
   * exactly that: nothing accumulates. Today's counters still work, because a
   * counter you cannot read is not a counter, but no day beyond today is
   * stored and no lifetime total grows. What was recorded before it was
   * switched off is left alone rather than deleted — turning a display off is
   * not a reason to destroy a record of worship.
   */
  const [keepRecord, setKeepRecord] = useState<boolean>(() => readJSON('dhikr-record-v1', true));
  /**
   * How much of the after-salah routine Home carries, and Play reads through.
   *
   * One answer, given once on the welcome screen, governing three things that
   * were never allowed to disagree: which sections Home shows, what the Play
   * button runs, and what Reset Routine clears.
   *
   * Core and Protection default to being together because they are one sitting
   * — istighfar, the tasbih, then Ayatul Kursi and the Quls — and the split
   * between them was a fact about this app's data, not about the practice.
   */
  const [routineScope, setRoutineScope] = useState<RoutineScope>(() => {
    const stored = readJSON<string>('dhikr-routine-scope-v1', 'protection');
    return ROUTINE_SCOPES.includes(stored as RoutineScope) ? (stored as RoutineScope) : 'protection';
  });
  const [customTargets, setCustomTargets] = useState<Counts>(() =>
    readJSON<Counts>('dhikr-targets-v1', {}, isPlainObject)
  );

  const [selectedPersonalSectionId, setSelectedPersonalSectionId] = useState('all');

  const [currentTheme, setCurrentTheme] = useState<string>(() =>
    readString(
      'dhikr-theme-v1',
      // Follow the phone rather than imposing a dark look on someone whose
      // device is in light mode. A stored choice still wins.
      'system',
      THEMES.map((t) => t.id)
    )
  );
  const [language, setLanguage] = useState<Language>(() =>
    readString<Language>('dhikr-language-v1', DEFAULT_LANGUAGE, LANGUAGE_CODES)
  );
  const [isHapticEnabled, setIsHapticEnabled] = useState<boolean>(() => readJSON('dhikr-haptic-v1', true));
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => readJSON('dhikr-sound-v1', false));
  /*
   * On by default: finishing a count and moving on is what a routine is.
   *
   * It used to default to off, and every setting is written on first render,
   * so every existing profile holds `false` whether or not anyone chose it.
   * Those are switched on once, the same way the reading sizes were raised; a
   * reader who then turns it off keeps it off. Restoring a backup never clears
   * the marker, so an older backup's choice is kept as it was.
   */
  const [autoAdvance, setAutoAdvance] = useState<boolean>(() =>
    readJSON(AUTO_ADVANCE_DEFAULT_KEY, false) ? readJSON('dhikr-auto-advance-v1', true) : true
  );
  /*
   * Reading sizes, raised once for everyone who never chose their own.
   *
   * 28px of Scheherazade and 16px of Lora were too small to read comfortably at
   * arm's length, and the old defaults are indistinguishable from a deliberate
   * choice by the time they have been written to storage — which happens on
   * first render, so nobody was ever left "unset". `adoptedSize` moves a value
   * that is still exactly the old default, once, and records that it has done
   * so; a reader who then picks 28 keeps 28 forever.
   */
  const [arabicFontSize, setArabicFontSize] = useState<number>(() =>
    adoptedSize('dhikr-arabic-font-size-v1', 28, 32)
  );
  const [englishFontSize, setEnglishFontSize] = useState<number>(() =>
    adoptedSize('dhikr-english-font-size-v1', 16, 18)
  );
  const [arabicLeading, setArabicLeading] = useState<number>(() => readJSON('dhikr-arabic-leading-v1', 2.1));
  const [readingLeading, setReadingLeading] = useState<number>(() => readJSON('dhikr-reading-leading-v1', 1.8));
  const [showTransliteration, setShowTransliteration] = useState<boolean>(() =>
    readJSON('dhikr-show-transliteration-v1', true)
  );
  const [showTranslation, setShowTranslation] = useState<boolean>(() => readJSON('dhikr-show-translation-v1', true));
  // Most people return to the same handful of du'as; this saves hunting for
  // them again. Ids only, newest first, capped.
  //
  // The names are kept as one entry, `cat:names`, rather than one per name:
  // reading through the ninety-nine filled "Recently read" with names and
  // pushed everything else out. Lists stored before that are folded on read.
  const [recentIds, setRecentIds] = useState<string[]>(() => [
    ...new Set(readJSON<string[]>('dhikr-recent-v1', [], isStringArray).map(recentKey))
  ]);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [updatePending, setUpdatePending] = useState(false);
  // Re-evaluated on the same signals as the date rollover — reopening the app,
  // tab focus, midnight — rather than on a timer nobody is watching.
  // The reader's own correction to the calculated Hijri date. Stored, never
  // inferred — the app has no business guessing where someone is.
  const [hijriOffset, setHijriOffset] = useState<number>(() => {
    const stored = readJSON<number>('dhikr-hijri-offset-v1', 0);
    return Number.isFinite(stored) ? Math.max(-2, Math.min(2, Math.round(stored))) : 0;
  });
  const [nowSlot, setNowSlot] = useState<Slot>(() => currentSlot(new Date(), 0));
  // The rollover listeners are registered once and outlive every change, so
  // they read the correction through a ref rather than closing over a value
  // that was current only at mount.
  const hijriOffsetRef = useRef(hijriOffset);

  // Shown only on a device that has never used the app. Anyone upgrading
  // already has settings in storage, so any `dhikr-` key counts as set up —
  // otherwise every existing user would be greeted by a setup screen.
  const [needsSetup, setNeedsSetup] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    try {
      if (localStorage.getItem('dhikr-setup-done-v1')) return false;
      return !Object.keys(localStorage).some((key) => key.startsWith('dhikr-'));
    } catch {
      return false;
    }
  });

  // --- Overlays -------------------------------------------------------------
  // Exactly one overlay can be open at a time, which keeps the back-button
  // history stack trivially balanced.
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState<ManualDraft>(EMPTY_DRAFT);
  const [targetDraft, setTargetDraft] = useState(0);
  const [surahSearchQuery, setSurahSearchQuery] = useState('');
  const [isFetchingSurah, setIsFetchingSurah] = useState(false);
  const [surahError, setSurahError] = useState<string | null>(null);
  const [isEditingSection, setIsEditingSection] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState<{ en: string; bn: string }>({ en: '', bn: '' });
  const [ratingValue, setRatingValue] = useState(0);

  const t = useMemo(() => createTranslate(language), [language]);

  const closeOverlay = useCallback(() => setOverlay(null), []);

  const handleBack = useCallback(() => {
    if (overlay) {
      setOverlay(null);
      return;
    }
    setActiveTab(0);
  }, [overlay]);

  /**
   * Tapping the tab you are already on returns it to its root, the way a native
   * tab bar pops to the top.
   *
   * Without this the Du'a tab stays wherever you left it: open a category, read
   * a du'a, come back, and the browse screen — with the category grid, the
   * favourites and the recently read — is only reachable through the small back
   * arrow. Tapping the lit tab is the gesture people already try.
   */
  const selectTab = useCallback(
    (tab: number) => {
      if (tab === activeTab && tab === 1) {
        setDuaSelectedCategory('All');
        setDuaSearchQuery('');
      }
      if (tab === activeTab) window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveTab(tab);
    },
    [activeTab]
  );

  // The overlay and any non-default tab each own one history entry, so a single
  // Back press dismisses exactly one layer and the next one leaves the app.
  useBackNavigation({
    depth: (overlay ? 1 : 0) + (activeTab !== 0 ? 1 : 0),
    onBack: handleBack
  });

  // --- Persistence ----------------------------------------------------------
  /*
   * The record is permanent, so with the switch off it is frozen exactly as it
   * stands rather than rewritten.
   *
   * This used to write `{ [currentDate]: today }` in that case, which would
   * have deleted every earlier day the moment the switch was turned off — the
   * opposite of what the switch is for. Today's counters live in a key of
   * their own instead: they survive a reload, and nothing accumulates behind a
   * switch that is off.
   */
  useEffect(() => {
    if (keepRecord) writeJSON('dhikr-tracker-v2', counts);
  }, [counts, keepRecord]);
  useEffect(() => {
    if (!keepRecord) {
      writeJSON('dhikr-today-counts-v1', { date: currentDate, values: counts[currentDate] || {} });
    }
  }, [counts, keepRecord, currentDate]);

  /*
   * Switching the record back on adopts today.
   *
   * The day's counters kept working while it was off, so the day bucket can be
   * ahead of the lifetime total the moment it is written again. Reconciling
   * takes the larger of the two — never their sum — which leaves the Record
   * agreeing with itself instead of disagreeing until the next reload.
   */
  const wasKeepingRecord = useRef(keepRecord);
  useEffect(() => {
    if (keepRecord && !wasKeepingRecord.current) {
      setLifetimeCounts((prev) => reconcileLifetime(prev, counts));
    }
    wasKeepingRecord.current = keepRecord;
  }, [keepRecord, counts]);
  useEffect(() => { writeJSON('dhikr-record-v1', keepRecord); }, [keepRecord]);
  useEffect(() => { writeJSON('dhikr-routine-scope-v1', routineScope); }, [routineScope]);
  useEffect(() => { writeJSON('dhikr-lifetime-counts-v1', lifetimeCounts); }, [lifetimeCounts]);
  useEffect(() => { writeJSON('dhikr-custom-v1', customItems); }, [customItems]);
  useEffect(() => { writeJSON('dhikr-personal-sections-v1', personalSections); }, [personalSections]);
  useEffect(() => { writeJSON('dhikr-favorites-v1', favorites); }, [favorites]);
  useEffect(() => { writeJSON('dhikr-favorites-metadata-v1', favoritesMetadata); }, [favoritesMetadata]);
  useEffect(() => { writeJSON('dhikr-pinned-v1', pinnedIds); }, [pinnedIds]);
  useEffect(() => { writeJSON('dhikr-reading-position-v1', readingPositions); }, [readingPositions]);

  /*
   * Record where a collection has been read to.
   *
   * Watching the overlay rather than each control means every way of moving —
   * the arrows, a swipe, the arrow keys, tap-to-advance, and "Continue to the
   * next" — is covered by one place. A completed round wraps the index back to
   * 0, so finishing the ninety-nine also clears the position, with no separate
   * reset to keep in step.
   */
  useEffect(() => {
    if (overlay?.kind !== 'focus' || !overlay.category) return;
    const { category, index } = overlay;
    setReadingPositions((prev) => (prev[category] === index ? prev : { ...prev, [category]: index }));
  }, [overlay]);
  useEffect(() => { writeJSON('dhikr-targets-v1', customTargets); }, [customTargets]);
  useEffect(() => { writeJSON('dhikr-reset-baseline-v1', resetBaseline); }, [resetBaseline]);
  useEffect(() => { writeJSON('dhikr-category-target-v1', categoryTargets); }, [categoryTargets]);
  useEffect(() => { writeJSON('dhikr-haptic-v1', isHapticEnabled); }, [isHapticEnabled]);
  useEffect(() => { writeJSON('dhikr-sound-v1', isSoundEnabled); }, [isSoundEnabled]);
  useEffect(() => { writeJSON('dhikr-auto-advance-v1', autoAdvance); }, [autoAdvance]);
  useEffect(() => { writeJSON('dhikr-arabic-font-size-v1', arabicFontSize); }, [arabicFontSize]);
  useEffect(() => { writeJSON('dhikr-english-font-size-v1', englishFontSize); }, [englishFontSize]);
  useEffect(() => { writeJSON('dhikr-arabic-leading-v1', arabicLeading); }, [arabicLeading]);
  useEffect(() => { writeJSON('dhikr-reading-leading-v1', readingLeading); }, [readingLeading]);
  // Written after the sizes have been read, so the raised defaults are taken up
  // exactly once per profile.
  useEffect(() => { writeJSON(TYPE_DEFAULTS_KEY, true); }, []);
  useEffect(() => { writeJSON(AUTO_ADVANCE_DEFAULT_KEY, true); }, []);
  useEffect(() => { writeJSON('dhikr-show-transliteration-v1', showTransliteration); }, [showTransliteration]);
  useEffect(() => { writeJSON('dhikr-show-translation-v1', showTranslation); }, [showTranslation]);
  useEffect(() => { writeJSON('dhikr-recent-v1', recentIds); }, [recentIds]);
  useEffect(() => {
    hijriOffsetRef.current = hijriOffset;
    writeJSON('dhikr-hijri-offset-v1', hijriOffset);
  }, [hijriOffset]);
  // Re-resolve immediately when the correction changes, rather than waiting for
  // the next focus or midnight.
  useEffect(() => { setNowSlot(currentSlot(new Date(), hijriOffset)); }, [hijriOffset]);
  useEffect(() => { writeString('dhikr-language-v1', language); }, [language]);

  // The document's own language settings, taken from the registry: `lang` picks
  // the right glyph forms and hyphenation, `dir` flows the whole layout, and the
  // font stack falls back per language because Lora carries no Bengali. An RTL
  // language needs a registry entry and nothing here.
  useEffect(() => {
    const { code, dir, fontStack, tracking } = languageInfo(language);
    const root = document.documentElement;
    root.setAttribute('lang', code);
    root.setAttribute('dir', dir);
    root.setAttribute('data-tracking', tracking ? 'on' : 'off');
    root.style.setProperty('--font-ui', fontStack);
  }, [language]);

  // --- Day rollover ---------------------------------------------------------
  // `currentDate` used to be captured once at mount, so an app left open past
  // midnight (the normal case for an installed PWA) kept writing counts into
  // the previous day and reported the wrong "today".
  useEffect(() => {
    let timer: number;

    const scheduleRollover = () => {
      timer = window.setTimeout(() => {
        setCurrentDate(getLocalDateString());
        setNowSlot(currentSlot(new Date(), hijriOffsetRef.current));
        scheduleRollover();
      }, msUntilNextLocalMidnight());
    };

    const syncNow = () => {
      setNowSlot(currentSlot(new Date(), hijriOffsetRef.current));
      const today = getLocalDateString();
      setCurrentDate((prev) => (prev === today ? prev : today));
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncNow();
    };

    scheduleRollover();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', syncNow);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', syncNow);
    };
  }, []);

  // --- Theme ----------------------------------------------------------------
  useEffect(() => {
    writeString('dhikr-theme-v1', currentTheme);
    applyTheme(currentTheme, { arabicFontSize, englishFontSize, arabicLeading, readingLeading });
  }, [currentTheme, arabicFontSize, englishFontSize, arabicLeading, readingLeading]);

  useEffect(() => {
    if (currentTheme !== 'system' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () =>
      applyTheme('system', { arabicFontSize, englishFontSize, arabicLeading, readingLeading });
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [currentTheme, arabicFontSize, englishFontSize, arabicLeading, readingLeading]);

  // --- Scroll lock ----------------------------------------------------------
  useEffect(() => {
    document.body.style.overflow = overlay ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [overlay]);

  // --- Feedback (sound + haptics) -------------------------------------------
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = async () => {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playClickSound = useCallback(async () => {
    if (!isSoundEnabled) return;
    try {
      const ctx = await getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.error('Audio play failed', e);
    }
  }, [isSoundEnabled]);

  const playSuccessSound = useCallback(async () => {
    if (!isSoundEnabled) return;
    try {
      const ctx = await getAudioContext();
      if (!ctx) return;
      const playNote = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.18, startTime + 0.03);
        gain.gain.linearRampToValueAtTime(0, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = ctx.currentTime;
      playNote(523.25, now, 0.15); // C5
      playNote(659.25, now + 0.15, 0.15); // E5
      playNote(783.99, now + 0.3, 0.3); // G5
    } catch (e) {
      console.error('Audio play failed', e);
    }
  }, [isSoundEnabled]);

  const vibrate = useCallback(
    (pattern: number | number[]) => {
      if (!isHapticEnabled) return;
      if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
      try {
        navigator.vibrate(pattern);
      } catch {
        /* ignore */
      }
    },
    [isHapticEnabled]
  );

  // --- Derived data ---------------------------------------------------------
  const allItems = useMemo(() => [...DHIKR_DATA, ...customItems], [customItems]);

  const itemsById = useMemo(() => {
    const map = new Map<string, DhikrItem>();
    allItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [allItems]);

  const routineItems = useMemo(() => {
    const resolve = (ids: string[]) => ids.map((id) => itemsById.get(id)).filter(Boolean) as DhikrItem[];
    return {
      core: resolve(ADHKAR_ROUTINE.afterSalahCore),
      optional: resolve(ADHKAR_ROUTINE.afterSalahOptional),
      // Empty at the narrowest scope, which is how Home stops showing the
      // section: the same four texts stay in the Du'a catalogue.
      protection: routineScope === 'core' ? [] : resolve(ADHKAR_ROUTINE.protection)
    };
  }, [itemsById, routineScope]);

  /**
   * The routine, as the reader defined it.
   *
   * One list feeding three things that must not disagree: what Home shows, what
   * Play reads through, and what Reset Routine clears. Pinned *collections* are
   * left out even at the widest scope — a pinned Asma ul Husna is ninety-nine
   * names with its own resume point, and it belongs in its own read-through,
   * not in the middle of a post-salah sitting.
   */
  const routineIds = useMemo(() => {
    const ids = [...ADHKAR_ROUTINE.afterSalahCore, ...ADHKAR_ROUTINE.afterSalahOptional];
    if (routineScope !== 'core') ids.push(...ADHKAR_ROUTINE.protection);
    if (routineScope === 'pinned') {
      ids.push(...pinnedIds.filter((id) => !id.startsWith(CATEGORY_PIN) && !ids.includes(id)));
    }
    return ids;
  }, [routineScope, pinnedIds]);

  const getLocalizedCategory = useCallback((cat: string) => CATEGORY_LABELS[cat]?.[language] || cat, [language]);

  // Only offer categories that actually contain duas — "Repentance" was listed
  // but had no items, so selecting it always produced an empty list.
  const categories = useMemo(() => {
    const used = new Set<string>();
    DUA_TAB_DATA.forEach((item) => (item.cat || []).forEach((cat) => used.add(cat)));
    return DUA_CATEGORIES.filter((cat) => used.has(cat));
  }, []);

  /** Search now covers transliteration, tags and the Arabic itself, not just title + meaning. */
  const buildHaystack = useCallback(
    (item: DhikrItem) =>
      normalizeForSearch(
        [
          t(item.title),
          t(item.meaning),
          t(item.trn),
          t(item.benefit),
          item.arabic,
          item.source ?? '',
          ...(item.tags || []),
          ...(item.cat || []).map(getLocalizedCategory)
        ].join(' ')
      ),
    [t, getLocalizedCategory]
  );

  const filteredDuaItems = useMemo(() => {
    const query = normalizeForSearch(duaSearchQuery);
    return DUA_TAB_DATA.filter((item) => {
      const matchesCategory = duaSelectedCategory === 'All' || item.cat?.includes(duaSelectedCategory);
      if (!matchesCategory) return false;
      return query === '' || buildHaystack(item).includes(query);
    });
  }, [duaSearchQuery, duaSelectedCategory, buildHaystack]);

  const filteredPersonalItems = useMemo(() => {
    const favoriteBase = DHIKR_DATA.filter((item) => favorites.includes(item.id));
    const byId = new Map<string, DhikrItem>();
    [...favoriteBase, ...customItems].forEach((item) => {
      const sectionId = item.sectionId || favoritesMetadata[item.id]?.sectionId || 'all';
      byId.set(item.id, { ...item, sectionId });
    });
    const query = normalizeForSearch(personalSearchQuery);
    return Array.from(byId.values()).filter((item) => {
      const matchesSection = selectedPersonalSectionId === 'all' || item.sectionId === selectedPersonalSectionId;
      if (!matchesSection) return false;
      return query === '' || buildHaystack(item).includes(query);
    });
  }, [personalSearchQuery, customItems, favorites, favoritesMetadata, selectedPersonalSectionId, buildHaystack]);

  /** Everything saved, before the collection filter — lets Personal tell
   *  "nothing saved at all" apart from "nothing in this collection". */
  const personalItemsBySection = useMemo(() => {
    const favoriteBase = DHIKR_DATA.filter((item) => favorites.includes(item.id));
    const byId = new Map<string, DhikrItem>();
    [...favoriteBase, ...customItems].forEach((item) => {
      const sectionId = item.sectionId || favoritesMetadata[item.id]?.sectionId || 'all';
      byId.set(item.id, { ...item, sectionId });
    });
    const counts: Record<string, number> = {};
    byId.forEach((item) => {
      const key = item.sectionId || 'all';
      counts[key] = (counts[key] || 0) + 1;
    });
    // Selecting "All Items" is a wildcard that shows every saved item, so its
    // chip has to count them all. Counting only the ones filed under `all` made
    // the chip read 0 while opening it listed the item.
    counts.all = byId.size;
    return { total: byId.size, counts };
  }, [favorites, customItems, favoritesMetadata]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    DUA_TAB_DATA.forEach((item) => (item.cat || []).forEach((cat) => { map[cat] = (map[cat] || 0) + 1; }));
    return map;
  }, []);

  const duaFavoriteItems = useMemo(
    () => DUA_TAB_DATA.filter((item) => favorites.includes(item.id)),
    [favorites]
  );

  // `slotItems` owns the cap and the Friday merge, so a Friday morning shows
  // the salawat and the morning adhkar rather than the salawat alone.
  const rightNowItems = useMemo(
    () => slotItems(nowSlot, new Date()).map((id) => itemsById.get(id)).filter(Boolean) as DhikrItem[],
    [nowSlot, itemsById]
  );

  const handleShare = useCallback(
    async (item: DhikrItem) => {
      const text = formatDuaAsText(item, t, PLAY_STORE_URL);
      const result = await shareText(text, t(item.title));
      if (result === 'copied') setShareStatus(t('Copied'));
      else if (result === 'failed') setShareStatus(t('Failed'));
      else setShareStatus(null);
      if (result !== 'shared') window.setTimeout(() => setShareStatus(null), 2000);
    },
    [t]
  );

  const baseline = resetBaseline.date === currentDate ? resetBaseline.values : {};

  /** What the counters show: the round since the last reset, not the day. */
  const currentCounts = useMemo(() => {
    const raw = counts[currentDate] || {};
    if (Object.keys(baseline).length === 0) return raw;
    const shown: Counts = {};
    Object.entries(raw).forEach(([id, value]) => {
      shown[id] = Math.max(0, value - (baseline[id] || 0));
    });
    return shown;
  }, [counts, currentDate, baseline]);

  /**
   * The repetition a set asks for, or 1 when it asks for none.
   *
   * "Set" is either a built-in category or one of your own collections, which
   * are keyed `sec:<id>` in the same map. A category key never starts with
   * `sec:`, so the two cannot collide, and one map means one accessor, one
   * editor and one stored key rather than a parallel copy of each.
   */
  const categoryTarget = useCallback(
    (key: string) => categoryTargets[key] ?? 1,
    [categoryTargets]
  );

  /**
   * Which of your collections an item is in, or null when it is not saved.
   *
   * Unsaved items must return null: everything with no collection would
   * otherwise count as being in "All Items", and a repetition set there would
   * silently rewrite the target of every dhikr on Home.
   */
  const collectionOf = useCallback(
    (item: DhikrItem) => {
      if (!favorites.includes(item.id) && !customItems.some((entry) => entry.id === item.id)) return null;
      return item.sectionId || favoritesMetadata[item.id]?.sectionId || 'all';
    },
    [favorites, customItems, favoritesMetadata]
  );

  const getTarget = useCallback(
    (item: DhikrItem) => {
      if (customTargets[item.id] !== undefined) return customTargets[item.id];
      // A collection you made yourself is a more deliberate grouping than the
      // category an item was authored into, so it is asked first.
      const section = collectionOf(item);
      const fromCollection = section ? categoryTargets[`${SECTION_TARGET}${section}`] : undefined;
      if (fromCollection && fromCollection > 1) return fromCollection;
      // An item can sit in several categories; the first one that asks for a
      // repetition wins, which is stable because `cat` order is authored.
      const fromCategory = (item.cat || []).map((key) => categoryTargets[key]).find((n) => n && n > 1);
      return fromCategory ?? item.target;
    },
    [customTargets, categoryTargets, collectionOf]
  );

  // --- Actions --------------------------------------------------------------
  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  /**
   * A pinned category rides in the same list as pinned items, under a prefix.
   *
   * One store, one toggle, one backup key — and because no item id can begin
   * with `cat:`, the existing `pinnedItems` filter skips these without knowing
   * they exist.
   */
  const togglePinCategory = useCallback(
    (category: string) => togglePin(`${CATEGORY_PIN}${category}`),
    [togglePin]
  );

  const isCategoryPinned = useCallback(
    (category: string) => pinnedIds.includes(`${CATEGORY_PIN}${category}`),
    [pinnedIds]
  );

  /**
   * Saving a category is saving a du'a that happens to contain others.
   *
   * It rides in `favorites` under the same prefix pinning uses, so the Saved
   * tab's item lookup skips it for the same reason Home's does: no item id
   * begins with `cat:`.
   */
  const toggleFavoriteCategory = useCallback((category: string) => {
    const id = `${CATEGORY_PIN}${category}`;
    setFavorites((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  }, []);

  const isCategoryFavorite = useCallback(
    (category: string) => favorites.includes(`${CATEGORY_PIN}${category}`),
    [favorites]
  );

  /** Resolves `cat:` ids in a list to their category, metadata and members. */
  const resolveCollections = useCallback(
    (ids: string[]) =>
      ids
        .filter((id) => id.startsWith(CATEGORY_PIN))
        .map((id) => {
          const key = id.slice(CATEGORY_PIN.length);
          return { key, meta: CATEGORY_LABELS[key], items: DUA_TAB_DATA.filter((item) => item.cat?.includes(key)) };
        })
        .filter((entry) => entry.meta && entry.items.length > 0),
    []
  );

  /** Each pinned category, with its members — one row on Home, not ninety-nine. */
  const pinnedCollections = useMemo(() => resolveCollections(pinnedIds), [pinnedIds, resolveCollections]);

  /** The same, for the Saved tab. */
  const favouriteCollections = useMemo(() => resolveCollections(favorites), [favorites, resolveCollections]);

  /** Recently read, with the names as one entry that resumes where it was left. */
  const recentEntries = useMemo(
    () =>
      recentIds.flatMap((id): RecentEntry[] => {
        if (id.startsWith(CATEGORY_PIN)) {
          return resolveCollections([id]).map((collection) => ({ kind: 'collection', collection }));
        }
        const item = itemsById.get(id);
        return item ? [{ kind: 'item', item }] : [];
      }),
    [recentIds, itemsById, resolveCollections]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        if (prev.includes(id)) {
          // Dropping the metadata too, so re-favouriting later starts fresh
          // rather than reviving a collection the user has since forgotten.
          setFavoritesMetadata((meta) => {
            if (!meta[id]) return meta;
            const next = { ...meta };
            delete next[id];
            return next;
          });
          return prev.filter((f) => f !== id);
        }
        // A favourite used to always land in "all", so with any other
        // collection selected the Personal tab filtered it straight back out
        // and reported nothing saved. It now joins the collection you are in,
        // the same way Add Personal Dua already behaves.
        setFavoritesMetadata((meta) => ({
          ...meta,
          [id]: { ...(meta[id] || {}), sectionId: selectedPersonalSectionId }
        }));
        return [...prev, id];
      });
    },
    [selectedPersonalSectionId]
  );

  const handleIncrement = useCallback(
    (id: string, target: number) => {
      const current = currentCounts[id] || 0;
      const next = current + 1;
      // `next === target` missed the celebration whenever a target was lowered
      // below the running count; crossing the line in either direction counts.
      const justCompleted = target > 0 && current < target && next >= target;

      if (justCompleted) {
        playSuccessSound();
        vibrate([100, 50, 100, 50, 200]);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          // Resolved, not raw: with 'system' selected the raw id matches the
          // placeholder entry rather than the light or dark palette actually on
          // screen, so the confetti came out the wrong gold.
          colors: [THEMES.find((theme) => theme.id === resolveThemeId(currentTheme))?.gold || '#D4AF37', '#ffffff']
        });
      } else {
        playClickSound();
        vibrate(15);
      }

      setCounts((prev) => {
        const prevDayCounts = prev[currentDate] || {};
        return { ...prev, [currentDate]: { ...prevDayCounts, [id]: (prevDayCounts[id] || 0) + 1 } };
      });
      if (keepRecord) setLifetimeCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    },
    // The sound helpers close over isSoundEnabled, so they must take part in
    // this callback's identity. Leaving them out meant the first tap after
    // toggling Sound used the previous setting.
    [currentCounts, currentDate, currentTheme, keepRecord, vibrate, playClickSound, playSuccessSound]
  );

  const handleResetItem = useCallback(
    (id: string) => {
      // Same rule as the other resets: the counter starts again, the record of
      // what was already recited stands.
      setResetBaseline((prev) => {
        const raw = counts[currentDate] || {};
        const values = prev.date === currentDate ? { ...prev.values } : {};
        values[id] = raw[id] || 0;
        return { date: currentDate, values };
      });
    },
    [counts, currentDate]
  );

  const askConfirm = useCallback((title: string, message: string, action: ConfirmAction) => {
    setOverlay({ kind: 'confirm', title, message, action });
  }, []);

  const handleReset = useCallback(() => {
    askConfirm(
      t('Reset All Progress?'),
      // Both halves of the old warning — "clears your counts" and "cannot be
      // undone" — stopped being true when reset started writing a baseline
      // instead of deleting.
      t('Today’s counters start again from zero. Your record keeps what you have already recited.'),
      { type: 'reset-all' }
    );
  }, [askConfirm, t]);

  const handleResetRoutine = useCallback(() => {
    askConfirm(t('Reset Routine?'), t('This will reset counts for all items in your current routine.'), {
      type: 'reset-routine'
    });
  }, [askConfirm, t]);

  /**
   * Start the names again: their place, their counters for today and today's
   * rounds, and nothing else. As with every reset, the Record keeps what was
   * recited.
   *
   * The names only, not any category. A du'a has one counter wherever it is
   * shown, and 68 du'as sit in more than one category, so resetting Daily
   * would also clear a du'a counted from Guidance. The names belong to no
   * other category, so resetting them can only ever touch them.
   */
  const handleResetNames = useCallback(() => {
    askConfirm(
      // A placeholder rather than "Reset" + name: Bangla puts the verb last.
      t('Reset {name}?').replace('{name}', t(CATEGORY_LABELS[NAMES_KEY])),
      t('Starts again from the first, with its counters at zero. Your record keeps what you have already recited.'),
      { type: 'reset-names' }
    );
  }, [askConfirm, t]);

  const handleDeletePersonalItem = useCallback(
    (id: string) => {
      askConfirm(t('Delete Item?'), t('Are you sure you want to remove this item from your collection?'), {
        type: 'delete-item',
        id
      });
    },
    [askConfirm, t]
  );

  const handleDeleteSection = useCallback(
    (sectionId: string) => {
      if (sectionId === 'all') return;
      askConfirm(
        t('Delete Collection?'),
        t('This will remove the collection. Items inside will be moved to "All Items".'),
        { type: 'delete-section', id: sectionId }
      );
    },
    [askConfirm, t]
  );

  const handleConfirm = useCallback(() => {
    if (!overlay || overlay.kind !== 'confirm') return;
    const { action } = overlay;

    if (action.type === 'reset-all') {
      setResetBaseline({ date: currentDate, values: { ...(counts[currentDate] || {}) } });
    } else if (action.type === 'reset-routine') {
      // Only the routine, never the whole day: Du'a and Personal counts have
      // nothing to do with the after-salah round.
      setResetBaseline((prev) => {
        const raw = counts[currentDate] || {};
        const values = prev.date === currentDate ? { ...prev.values } : {};
        routineIds.forEach((id) => { values[id] = raw[id] || 0; });
        return { date: currentDate, values };
      });
    } else if (action.type === 'reset-names') {
      const ids = [...ASMA_DATA.map((item) => item.id), ASMA_CYCLE_ITEM.id];
      setResetBaseline((prev) => {
        const raw = counts[currentDate] || {};
        const values = prev.date === currentDate ? { ...prev.values } : {};
        ids.forEach((id) => { values[id] = raw[id] || 0; });
        return { date: currentDate, values };
      });
      setReadingPositions((prev) => ({ ...prev, [NAMES_KEY]: 0 }));
    } else if (action.type === 'delete-item') {
      setCustomItems((prev) => prev.filter((item) => item.id !== action.id));
      setFavorites((prev) => prev.filter((id) => id !== action.id));
      setPinnedIds((prev) => prev.filter((id) => id !== action.id));
    } else if (action.type === 'delete-section') {
      setPersonalSections((prev) => prev.filter((section) => section.id !== action.id));
      setCustomItems((prev) =>
        prev.map((item) => (item.sectionId === action.id ? { ...item, sectionId: 'all' } : item))
      );
      setFavoritesMetadata((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          if (next[id]?.sectionId === action.id) next[id] = { ...next[id], sectionId: 'all' };
        });
        return next;
      });
      setSelectedPersonalSectionId((prev) => (prev === action.id ? 'all' : prev));
    }

    closeOverlay();
  }, [overlay, counts, currentDate, routineIds, closeOverlay]);

  const handleMoveToCollection = useCallback((itemId: string, sectionId: string) => {
    setCustomItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, sectionId } : item)));
    setFavoritesMetadata((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), sectionId } }));
  }, []);

  const handleSaveSection = useCallback(() => {
    const trimmed = { en: newSectionName.en.trim(), bn: newSectionName.bn.trim() };
    if (!trimmed.en && !trimmed.bn) return;

    if (isEditingSection && editingSectionId) {
      setPersonalSections((prev) =>
        prev.map((section) => (section.id === editingSectionId ? { ...section, name: trimmed } : section))
      );
    } else {
      setPersonalSections((prev) => [...prev, { id: `section_${Date.now()}`, name: trimmed }]);
    }

    setIsEditingSection(false);
    setEditingSectionId(null);
    setNewSectionName({ en: '', bn: '' });
    closeOverlay();
  }, [newSectionName, isEditingSection, editingSectionId, closeOverlay]);

  const openManualModal = useCallback(
    (item?: DhikrItem) => {
      if (item) {
        setEditingItemId(item.id);
        setManualDraft({
          title: localeField(item.title, language) || t(item.title),
          arabic: item.arabic,
          trn: localeField(item.trn, language),
          meaning: localeField(item.meaning, language),
          benefit: localeField(item.benefit, language),
          source: item.source || '',
          ref: item.ref || '',
          target: item.target,
          sectionId: item.sectionId || 'all'
        });
      } else {
        setEditingItemId(null);
        setManualDraft({
          ...EMPTY_DRAFT,
          target: 33,
          sectionId: selectedPersonalSectionId
        });
      }
      setOverlay({ kind: 'manual' });
    },
    [t, language, selectedPersonalSectionId]
  );

  const handleManualSave = useCallback(() => {
    const title = manualDraft.title.trim();
    if (!title) return;

    const existing = editingItemId ? customItems.find((item) => item.id === editingItemId) : undefined;

    // The form has one field per value, so writing it to both languages would
    // wipe the other translation — a downloaded surah stores an English name
    // and an Arabic one. Only the language being edited is replaced.
    const newItem: DhikrItem = {
      ...existing,
      step: existing?.step ?? 4,
      id: editingItemId || `manual_${Date.now()}`,
      title: mergeLocalized(existing?.title, title, language),
      arabic: manualDraft.arabic.trim(),
      trn: mergeLocalized(existing?.trn, manualDraft.trn, language),
      meaning: mergeLocalized(existing?.meaning, manualDraft.meaning, language),
      benefit: manualDraft.benefit
        ? mergeLocalized(existing?.benefit, manualDraft.benefit, language)
        : 'Personal collection',
      source: manualDraft.source.trim(),
      ref: manualDraft.ref.trim(),
      target: Math.max(0, manualDraft.target || 0),
      badge: existing?.badge ?? 'Custom',
      sectionId: manualDraft.sectionId || selectedPersonalSectionId
    };

    setCustomItems((prev) =>
      existing ? prev.map((item) => (item.id === existing.id ? newItem : item)) : [newItem, ...prev]
    );

    setEditingItemId(null);
    setManualDraft(EMPTY_DRAFT);
    closeOverlay();
  }, [manualDraft, editingItemId, customItems, language, selectedPersonalSectionId, closeOverlay]);

  const handleSaveTarget = useCallback(() => {
    if (overlay?.kind !== 'target') return;
    const itemId = overlay.itemId;
    const value = Math.max(0, targetDraft || 0);
    if (itemId.startsWith(CATEGORY_PIN)) {
      setCategoryTargets((prev) => ({
        ...prev,
        [itemId.slice(CATEGORY_PIN.length)]: Math.max(1, value)
      }));
    } else {
      setCustomTargets((prev) => ({ ...prev, [itemId]: value }));
    }
    closeOverlay();
  }, [overlay, targetDraft, closeOverlay]);

  const handleAddSurah = useCallback(
    async (surahId: string) => {
      setIsFetchingSurah(true);
      setSurahError(null);
      try {
        // Both languages, not just the current one: the item is kept for good
        // and switching language later should not send you back to the network.
        const surah = await downloadSurah(surahId, ['en', 'bn']);

        const newItem: DhikrItem = {
          step: 4,
          id: `surah_${surahId}_${Date.now()}`,
          // `surah.name` is the *Arabic* name, so the Bangla title read
          // سُورَةُ ٱلْفَاتِحَةِ. The app already ships all 114 names in Bangla.
          title: {
            en: surah.englishName,
            bn: ALL_SURAHS.find((entry) => entry.id === surah.number)?.bn || surah.englishName
          },
          arabic: surah.arabic,
          // Verse-numbered the same way as the Arabic, so the three blocks line
          // up ayah for ayah when read together.
          trn: surah.transliteration ? { en: surah.transliteration } : undefined,
          meaning: {
            en: surah.translations.en || `Surah ${surah.englishName} — ${surah.englishNameTranslation}`,
            bn: surah.translations.bn || `সূরা ${surah.englishName} — ${surah.englishNameTranslation}`
          },
          source: 'Quran',
          ref: `${surah.number}`,
          target: 1,
          badge: 'Surah',
          sectionId: selectedPersonalSectionId
        };
        setCustomItems((prev) => [newItem, ...prev]);
        setSurahSearchQuery('');
        closeOverlay();
      } catch (err) {
        // Previously the modal just closed and nothing appeared, which looked
        // identical to the app ignoring the tap.
        console.error('Failed to fetch surah', err);
        setSurahError(
          t('Could not download that surah. Check your connection and try again.')
        );
      } finally {
        setIsFetchingSurah(false);
      }
    },
    [selectedPersonalSectionId, closeOverlay, t]
  );

  const rememberRead = useCallback((id: string) => {
    const key = recentKey(id);
    setRecentIds((prev) => [key, ...prev.filter((entry) => entry !== key)].slice(0, 12));
  }, []);

  const openFocus = useCallback((
    item: DhikrItem,
    list: DhikrItem[],
    category?: string,
    playthrough = false
  ) => {
    rememberRead(item.id);
    const ids = list.length > 0 ? list.map((entry) => entry.id) : [item.id];
    const index = Math.max(0, ids.indexOf(item.id));
    // The names are recited as a round, so their reader wraps rather than
    // stopping dead at the ninety-ninth. Derived from the list itself, so no
    // screen has to know about it.
    const cycle = ids.length > 1 && ids.every(isAsmaId);
    // Opening one name from the full list of ninety-nine is reading the set,
    // so it keeps the set's place too: "Continue from" on Home and in Recently
    // read then points at the last name actually read, however it was reached.
    // Only the full list — an index into search results means nothing there.
    const key = category ?? (cycle && ids.length === ASMA_DATA.length ? NAMES_KEY : undefined);
    setOverlay({ kind: 'focus', ids, index, cycle, category: key, playthrough });
  }, [rememberRead]);

  /**
   * Play the routine through, starting where the day actually is.
   *
   * Not from a stored index: a routine is done several times a day and what
   * matters on returning is which du'a is still short of its count, not which
   * card was last on screen. Everything already finished is skipped; when it is
   * all done it starts again from the top.
   */
  const routinePlaylist = useMemo(
    () => routineIds.map((id) => itemsById.get(id)).filter(Boolean) as DhikrItem[],
    [routineIds, itemsById]
  );

  const routineDone = useMemo(
    () => routinePlaylist.filter((item) => {
      const target = getTarget(item);
      return target > 0 && (currentCounts[item.id] || 0) >= target;
    }).length,
    [routinePlaylist, currentCounts, getTarget]
  );

  const playRoutine = useCallback(() => {
    if (routinePlaylist.length === 0) return;
    const next =
      routinePlaylist.find((item) => {
        const target = getTarget(item);
        return !(target > 0 && (currentCounts[item.id] || 0) >= target);
      }) ?? routinePlaylist[0];
    openFocus(next, routinePlaylist, ROUTINE_KEY, true);
  }, [routinePlaylist, currentCounts, getTarget, openFocus]);

  /**
   * Reopen a collection where the reader left it.
   *
   * A stored index can outlive the list it pointed into — a category shrinks,
   * or a backup is restored onto a newer build — so it is clamped rather than
   * trusted, which would otherwise open the reader on nothing.
   */
  const openCollection = useCallback(
    (key: string) => {
      const items = DUA_TAB_DATA.filter((item) => item.cat?.includes(key));
      if (items.length === 0) return;
      const stored = readingPositions[key] ?? 0;
      const index = Math.min(Math.max(0, stored), items.length - 1);
      openFocus(items[index], items, key, true);
    },
    [readingPositions, openFocus]
  );

  /**
   * Whether the names have anything to reset today: a place to resume from, a
   * round, or a counter above zero. Offering "reset" on an untouched set is
   * noise.
   */
  const namesHaveProgress = useMemo(
    () =>
      (readingPositions[NAMES_KEY] ?? 0) > 0 ||
      [...ASMA_DATA.map((item) => item.id), ASMA_CYCLE_ITEM.id].some((id) => (currentCounts[id] || 0) > 0),
    [readingPositions, currentCounts]
  );

  const restartCollection = useCallback((key: string) => {
    setReadingPositions((prev) => ({ ...prev, [key]: 0 }));
  }, []);

  const moveFocus = useCallback((delta: number) => {
    setOverlay((prev) => {
      if (prev?.kind !== 'focus') return prev;
      const length = prev.ids.length;
      const raw = prev.index + delta;
      // A du'a list stops at its ends; a round of names comes back around.
      if (!prev.cycle) {
        if (raw < 0 || raw >= length) return prev;
        return { ...prev, index: raw };
      }
      return { ...prev, index: ((raw % length) + length) % length };
    });
  }, []);

  /**
   * Advance to the next name, and count a completed round when the cursor comes
   * back to the start.
   *
   * The wrap is detected here rather than inside the setOverlay updater —
   * React may run an updater twice, which would count two rounds for one lap.
   *
   * This is wired to onNext as well as to the body tap. Every way forward — the
   * arrow button, a swipe, the right arrow key — funnels through onNext, and
   * while only the body tap used it, someone reading the names with the arrow
   * completed a full round of ninety-nine and had nothing recorded.
   */
  const advanceCycle = useCallback(() => {
    if (overlay?.kind !== 'focus' || !overlay.cycle) return;
    const isLap = overlay.index === overlay.ids.length - 1;
    moveFocus(1);
    if (isLap) handleIncrement(ASMA_CYCLE_ITEM.id, ASMA_CYCLE_ITEM.target);
  }, [overlay, moveFocus, handleIncrement]);

  /**
   * Counting inside the reader, with the option to roll on when the target is
   * reached — the routine read as a playlist rather than as a list you have to
   * keep coming back to.
   *
   * Completion is worked out from the same rule handleIncrement uses, before
   * the state write, because after it the count is already past the target and
   * "did this tap finish it" can no longer be answered.
   *
   * The move is deferred so the confetti and the chord land first, and it is
   * guarded on the cursor still sitting where it was: closing the reader or
   * moving by hand inside that second must not be overridden a moment later.
   */
  const incrementInFocus = useCallback(
    (item: DhikrItem) => {
      const target = getTarget(item);
      const current = currentCounts[item.id] || 0;
      const completes = target > 0 && current < target && current + 1 >= target;
      handleIncrement(item.id, target);

      if (!completes || overlay?.kind !== 'focus') return;
      /*
       * A reader opened by a "read through" button always rolls on.
       *
       * Pressing something that says "read through 12 du'as" is an
       * instruction, so it is followed whether or not "Continue to the next"
       * is switched on. Tapping a single row inside a category is not that,
       * even though it also carries the category — hence the explicit flag
       * rather than a test for one.
       *
       * A repetition counts as well: finishing the third Ar-Rahman and then
       * sitting there, with tap-to-advance switched off because the tap is
       * now counting, was a dead end.
       */
      const repeating = overlay.category ? categoryTarget(overlay.category) > 1 : false;
      if (!autoAdvance && !overlay.playthrough && !repeating) return;

      const from = overlay.index;
      // Decided out here: the wrap ends a round, and a setOverlay updater may
      // run twice, which would count two.
      const isLap = Boolean(overlay.cycle) && from === overlay.ids.length - 1;
      window.setTimeout(() => {
        setOverlay((prev) => {
          if (prev?.kind !== 'focus' || prev.index !== from) return prev;
          const raw = prev.index + 1;
          if (raw < prev.ids.length) return { ...prev, index: raw };
          return prev.cycle ? { ...prev, index: 0 } : prev;
        });
        if (isLap) handleIncrement(ASMA_CYCLE_ITEM.id, ASMA_CYCLE_ITEM.target);
      }, 1100);
    },
    [autoAdvance, categoryTarget, currentCounts, getTarget, handleIncrement, overlay]
  );

  /**
   * Opens a category's own page — its benefit, source and children.
   *
   * This is where a saved or pinned parent leads, rather than straight into the
   * reader: the parent is the thing that carries the summary, and reading it
   * through is one button away once you are there.
   */
  const openCategory = useCallback((key: string) => {
    setDuaSearchQuery('');
    setDuaSelectedCategory(key);
    setActiveTab(1);
    window.scrollTo({ top: 0 });
  }, []);

  const openTargetModal = useCallback(
    (item: DhikrItem) => {
      setTargetDraft(getTarget(item));
      setOverlay({ kind: 'target', itemId: item.id });
    },
    [getTarget]
  );

  const openCategoryTargetModal = useCallback(
    (key: string) => {
      setTargetDraft(categoryTarget(key));
      setOverlay({ kind: 'target', itemId: `${CATEGORY_PIN}${key}` });
    },
    [categoryTarget]
  );

  const focusItem = overlay?.kind === 'focus' ? itemsById.get(overlay.ids[overlay.index]) ?? null : null;
  /* With a repetition set, the tap has to count rather than move on. */
  const repeatingSet =
    overlay?.kind === 'focus' && overlay.category ? categoryTarget(overlay.category) > 1 : false;

  const ownedIds = useMemo(() => new Set(customItems.map((item) => item.id)), [customItems]);

  const headerDate = useMemo(() => {
    const parsed = parseLocalDate(currentDate);
    if (Number.isNaN(parsed.getTime())) return '';
    // `new Date("YYYY-MM-DD")` parses as UTC, which showed the previous day for
    // anyone west of Greenwich.
    return parsed.toLocaleDateString(languageInfo(language).code, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }, [currentDate, language]);

  const overlayShell = 'fixed inset-0 overflow-y-auto bg-bg/90 backdrop-blur-sm pt-safe';
  const inputClass =
    'w-full bg-bg border border-border rounded-xl p-3 text-sm text-text-main outline-none focus:border-gold';
  const labelClass = 'block text-[10px] font-bold text-text-sub uppercase mb-1';

  return (
    <div className="min-h-screen bg-bg text-text-main font-serif pb-24 transition-colors duration-500">
      <div className="status-bar-fill" aria-hidden="true" />
      {/* Header */}
      <header className="relative bg-card border-b border-border px-4 pb-6 header-safe shadow-sm">
        <div className="flex justify-between items-center max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-wide flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-transparent flex items-center justify-center">
                  {/* Vite rewrites root-relative asset URLs in index.html but
                      not inside JSX, so this must carry the base itself or it
                      404s when served from a sub-path (GitHub Pages). */}
                  <img
                    src={`${import.meta.env.BASE_URL}icon.svg`}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-contain"
                  />
                </div>
                {t(APP_SHORT_NAME)}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-text-sub font-bold uppercase tracking-widest opacity-90">
                  {t('Assalamu Alaikum')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-center min-w-[100px] mr-2">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{t('Today')}</span>
              <span className="text-xs font-bold text-gold-ink">{headerDate}</span>
            </div>
            {/* Was white-on-translucent-black, which disappeared in the Light theme. */}
            <button
              onClick={handleReset}
              className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-bg px-4 text-text-sub transition-colors hover:border-gold/50 hover:text-gold-ink"
              title={t('Reset All')}
            >
              <RotateCcw size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">{t('Reset All')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-3 sm:px-4 pt-6 max-w-3xl mx-auto pb-28">
        <AnimatePresence mode="wait">
          {activeTab === 0 && (
            <AdhkarScreen
              routineItems={routineItems}
              onPlayRoutine={playRoutine}
              routineTotal={routinePlaylist.length}
              routineDone={routineDone}
              onResetRoutine={handleResetRoutine}
              counts={currentCounts}
              onCountChange={handleIncrement}
              onResetItem={handleResetItem}
              getTarget={getTarget}
              onSetTarget={openTargetModal}
              getLocalizedText={t}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              language={language}
              onFocus={openFocus}
              pinnedIds={pinnedIds}
              onTogglePin={togglePin}
              allDhikrItems={allItems}
              sections={personalSections}
              onMoveToCollection={handleMoveToCollection}
              onBrowseDuas={() => setActiveTab(1)}
              currentDate={currentDate}
              rightNowItems={rightNowItems}
              rightNowSlot={nowSlot}
              // The names have their own button on Home, so a pinned copy
              // would only list them twice.
              pinnedCollections={pinnedCollections.filter((collection) => collection.key !== NAMES_KEY)}
              readingPositions={readingPositions}
              onOpenCollection={openCategory}
              onRestartCollection={restartCollection}
              names={{
                position: Math.min(readingPositions[NAMES_KEY] ?? 0, ASMA_DATA.length - 1),
                total: ASMA_DATA.length,
                rounds: currentCounts[ASMA_CYCLE_ITEM.id] || 0,
                hasProgress: namesHaveProgress,
                onPlay: () => openCollection(NAMES_KEY),
                onReset: handleResetNames
              }}
              onOpenItem={openFocus}
              showTransliteration={showTransliteration}
              showTranslation={showTranslation}
            />
          )}

          {activeTab === 1 && (
            <DuaScreen
              language={language}
              getLocalizedText={t}
              searchQuery={duaSearchQuery}
              onSearchChange={setDuaSearchQuery}
              selectedCategory={duaSelectedCategory}
              onCategorySelect={setDuaSelectedCategory}
              categories={categories}
              categoryCounts={categoryCounts}
              filteredItems={filteredDuaItems}
              totalCount={DUA_TAB_DATA.length}
              favoriteItems={duaFavoriteItems}
              recentEntries={recentEntries}
              onResetNames={handleResetNames}
              namesHaveProgress={namesHaveProgress}
              readingPositions={readingPositions}
              isFavorite={(id) => favorites.includes(id)}
              isPinned={(id) => pinnedIds.includes(id)}
              onOpen={openFocus}
              onTogglePinCategory={togglePinCategory}
              isCategoryPinned={isCategoryPinned}
              onToggleFavoriteCategory={toggleFavoriteCategory}
              isCategoryFavorite={isCategoryFavorite}
              onReadCategory={openCollection}
              categoryPosition={readingPositions[duaSelectedCategory] ?? 0}
              categoryTarget={categoryTarget(duaSelectedCategory)}
              onEditCategoryTarget={openCategoryTargetModal}
            />
          )}

          {activeTab === 2 && (
            <PersonalScreen
              getLocalizedText={t}
              counts={currentCounts}
              onCountChange={handleIncrement}
              onResetItem={handleResetItem}
              getTarget={getTarget}
              onSetTarget={openTargetModal}
              searchQuery={personalSearchQuery}
              onSearchChange={setPersonalSearchQuery}
              filteredItems={filteredPersonalItems}
              savedCollections={favouriteCollections}
              readingPositions={readingPositions}
              onOpenCollection={openCategory}
              onRestartCollection={restartCollection}
              savedTotal={personalItemsBySection.total}
              sectionCounts={personalItemsBySection.counts}
              ownedIds={ownedIds}
              onEditItem={openManualModal}
              onDeleteItem={handleDeletePersonalItem}
              onManualAdd={() => openManualModal()}
              onAddSurah={() => {
                setSurahError(null);
                setSurahSearchQuery('');
                setOverlay({ kind: 'surah' });
              }}
              isFavorite={(id) => favorites.includes(id)}
              onFavorite={toggleFavorite}
              // Reading from a collection names the collection, so a repetition
              // set on it rolls the reader on the way a category's does.
              onFocus={(item, list) =>
                openFocus(item, list, `${SECTION_TARGET}${selectedPersonalSectionId}`)
              }
              collectionTarget={categoryTarget(`${SECTION_TARGET}${selectedPersonalSectionId}`)}
              onSetCollectionTarget={() =>
                openCategoryTargetModal(`${SECTION_TARGET}${selectedPersonalSectionId}`)
              }
              language={language}
              isPinned={(id) => pinnedIds.includes(id)}
              onTogglePin={togglePin}
              sections={personalSections}
              selectedSectionId={selectedPersonalSectionId}
              onSelectSection={setSelectedPersonalSectionId}
              onAddSection={() => {
                setIsEditingSection(false);
                setEditingSectionId(null);
                setNewSectionName({ en: '', bn: '' });
                setOverlay({ kind: 'section' });
              }}
              onEditSection={(section) => {
                setIsEditingSection(true);
                setEditingSectionId(section.id);
                // t() returns only the active language; using it for both
                // fields overwrote the other translation on save.
                setNewSectionName({
                  en: localeField(section.name, 'en'),
                  bn: localeField(section.name, 'bn')
                });
                setOverlay({ kind: 'section' });
              }}
              onDeleteSection={handleDeleteSection}
              onMoveToCollection={handleMoveToCollection}
              showTransliteration={showTransliteration}
              showTranslation={showTranslation}
            />
          )}

          {activeTab === 3 && (
            <MoreScreen
              getLocalizedText={t}
              theme={currentTheme}
              onThemeChange={setCurrentTheme}
              language={language}
              onLanguageChange={setLanguage}
              isSoundOn={isSoundEnabled}
              setIsSoundOn={setIsSoundEnabled}
              isHapticOn={isHapticEnabled}
              setIsHapticOn={setIsHapticEnabled}
              autoAdvance={autoAdvance}
              setAutoAdvance={setAutoAdvance}
              routineScope={routineScope}
              setRoutineScope={setRoutineScope}
              keepRecord={keepRecord}
              setKeepRecord={setKeepRecord}
              onShowSetup={() => setNeedsSetup(true)}
              supportEmail={SUPPORT_EMAIL}
              storeUrl={PLAY_STORE_URL}
              arabicFontSize={arabicFontSize}
              setArabicFontSize={setArabicFontSize}
              englishFontSize={englishFontSize}
              setEnglishFontSize={setEnglishFontSize}
              arabicLeading={arabicLeading}
              setArabicLeading={setArabicLeading}
              readingLeading={readingLeading}
              setReadingLeading={setReadingLeading}
              hijriOffset={hijriOffset}
              setHijriOffset={setHijriOffset}
              showTransliteration={showTransliteration}
              setShowTransliteration={setShowTransliteration}
              showTranslation={showTranslation}
              setShowTranslation={setShowTranslation}
              onRateClick={() => setOverlay({ kind: 'rating' })}
              onBackupClick={() => setOverlay({ kind: 'backup' })}
              dayCounts={counts}
              lifetimeCounts={lifetimeCounts}
              itemsById={itemsById}
            />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {overlay?.kind === 'manual' && (
          <motion.div
            key="manual-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`${overlayShell} z-[100]`}
            role="dialog"
            aria-modal="true"
          >
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-card border border-border w-full max-w-md rounded-3xl overflow-hidden shadow-2xl my-8"
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gold-ink flex items-center gap-2">
                      {editingItemId ? <Edit2 size={20} /> : <Plus size={20} />}
                      {editingItemId ? t('Edit Dhikr') : t('Add Custom Dhikr')}
                    </h2>
                    <button
                      onClick={closeOverlay}
                      className="text-text-muted hover:text-text-main"
                      aria-label={t('Close')}
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className={labelClass} htmlFor="manual-title">{t('Title *')}</label>
                      <input
                        id="manual-title"
                        type="text"
                        value={manualDraft.title}
                        onChange={(e) => setManualDraft((prev) => ({ ...prev, title: e.target.value }))}
                        className={inputClass}
                        placeholder={t('e.g., Morning Dua')}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="manual-arabic">{t('Arabic Text')}</label>
                      <textarea
                        id="manual-arabic"
                        value={manualDraft.arabic}
                        onChange={(e) => setManualDraft((prev) => ({ ...prev, arabic: e.target.value }))}
                        lang="ar"
                        dir="rtl"
                        className={`${inputClass} text-lg min-h-[80px] arabic-text`}
                        placeholder={t('Arabic text here...')}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="manual-trn">{t('Transliteration')}</label>
                      <input
                        id="manual-trn"
                        type="text"
                        value={manualDraft.trn}
                        onChange={(e) => setManualDraft((prev) => ({ ...prev, trn: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="manual-meaning">{t('Meaning')}</label>
                      <textarea
                        id="manual-meaning"
                        value={manualDraft.meaning}
                        onChange={(e) => setManualDraft((prev) => ({ ...prev, meaning: e.target.value }))}
                        className={`${inputClass} min-h-[60px]`}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="manual-source">{t('Hadith Book / Source')}</label>
                      <input
                        id="manual-source"
                        type="text"
                        value={manualDraft.source}
                        onChange={(e) => setManualDraft((prev) => ({ ...prev, source: e.target.value }))}
                        className={inputClass}
                        placeholder={t('e.g., Sahih Bukhari')}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="manual-ref">{t('Reference')}</label>
                      <input
                        id="manual-ref"
                        type="text"
                        value={manualDraft.ref}
                        onChange={(e) => setManualDraft((prev) => ({ ...prev, ref: e.target.value }))}
                        className={inputClass}
                        placeholder={t('e.g., 6407')}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="manual-target">{t('Default Target (0 for infinite)')}</label>
                      <input
                        id="manual-target"
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={manualDraft.target}
                        onChange={(e) =>
                          setManualDraft((prev) => ({ ...prev, target: Math.max(0, parseInt(e.target.value, 10) || 0) }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="manual-section">{t('Collection')}</label>
                      <select
                        id="manual-section"
                        value={manualDraft.sectionId}
                        onChange={(e) => setManualDraft((prev) => ({ ...prev, sectionId: e.target.value }))}
                        className={`${inputClass} appearance-none`}
                      >
                        {personalSections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {t(section.name)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleManualSave}
                      disabled={!manualDraft.title.trim()}
                      className="w-full py-4 bg-gold text-on-gold font-bold rounded-2xl shadow-lg hover:bg-gold/90 transition-colors disabled:opacity-50 mt-4"
                    >
                      {editingItemId ? t('Update Dhikr') : t('Add to Collection')}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {overlay?.kind === 'confirm' && (
          <motion.div
            key="confirm-dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`${overlayShell} z-[110]`}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-card border border-border w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 my-8"
              >
                <h3 className="text-xl font-bold text-gold-ink mb-2">{overlay.title}</h3>
                <p className="text-sm text-text-sub mb-6">{overlay.message}</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={closeOverlay}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-text-muted hover:text-text-main transition-colors"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    {t('Confirm')}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Target Modal */}
      <AnimatePresence>
        {overlay?.kind === 'target' && (
          <motion.div
            key="target-dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`${overlayShell} z-[110]`}
            role="dialog"
            aria-modal="true"
          >
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-card border border-border w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 my-8"
              >
                <h3 className="text-xl font-bold text-gold-ink mb-2">{t('Set Target')}</h3>
                <p className="text-sm text-text-sub mb-4">
                  {/* Zero means "count without end" for one du'a, but nothing
                      for a set — a repetition of none is not a reading. */}
                  {t(
                    overlay.itemId.startsWith(CATEGORY_PIN)
                      ? 'How many times each du’a is recited before moving on.'
                      : 'Enter a new target count (0 for infinite tracking):'
                  )}
                </p>

                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  autoFocus
                  value={targetDraft}
                  onChange={(e) => setTargetDraft(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className={`${inputClass} mb-4`}
                />

                {/* Suggestions stay odd (witr). The previous set mixed in 10,
                    34 and 100, which nudged people away from that. */}
                <div className="mb-6 flex flex-wrap gap-2">
                  {TARGET_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setTargetDraft(preset)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                        targetDraft === preset
                          ? 'border-gold bg-gold/10 text-gold-ink'
                          : 'border-border bg-bg text-text-sub hover:border-gold/40'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={closeOverlay}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-text-muted hover:text-text-main transition-colors"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    onClick={handleSaveTarget}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-gold text-on-gold hover:bg-gold/90 transition-colors"
                  >
                    {t('Save')}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Surah Selection Modal */}
      <AnimatePresence>
        {overlay?.kind === 'surah' && (
          <motion.div
            key="surah-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`${overlayShell} z-[100]`}
            role="dialog"
            aria-modal="true"
          >
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-card border border-border w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gold-ink flex items-center gap-2">
                      <BookOpen size={20} />
                      {t('Add Surah')}
                    </h2>
                    <button
                      onClick={closeOverlay}
                      className="text-text-muted hover:text-text-main"
                      aria-label={t('Close')}
                    >
                      <X size={24} />
                    </button>
                  </div>

                  {surahError && (
                    <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold leading-relaxed text-red-400">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>{surahError}</span>
                    </div>
                  )}

                  <div className="mb-4">
                    <input
                      type="text"
                      value={surahSearchQuery}
                      onChange={(e) => setSurahSearchQuery(e.target.value)}
                      placeholder={t('Search Surah...')}
                      className={inputClass}
                    />
                  </div>

                  <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {isFetchingSurah ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <Loader2 className="w-8 h-8 text-gold-ink animate-spin" />
                        <p className="text-sm text-text-muted font-bold uppercase tracking-widest">
                          {t('Fetching Surah...')}
                        </p>
                      </div>
                    ) : (
                      ALL_SURAHS.filter(
                        (s) =>
                          s.en.toLowerCase().includes(surahSearchQuery.toLowerCase()) ||
                          s.bn.includes(surahSearchQuery)
                      ).map((surah) => (
                        <button
                          key={surah.id}
                          onClick={() => handleAddSurah(surah.id.toString())}
                          className="w-full p-4 bg-bg border border-border rounded-2xl flex items-center justify-between hover:border-gold/50 transition-all group"
                        >
                          <div className="text-start">
                            <p className="text-sm font-bold text-text-main group-hover:text-gold-ink transition-colors">
                              {surah.en}
                            </p>
                            <p className="text-xs text-text-muted">{surah.bn}</p>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold-ink text-xs font-bold">
                            {surah.id}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section Modal */}
      <AnimatePresence>
        {overlay?.kind === 'section' && (
          <motion.div
            key="section-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`${overlayShell} z-[110]`}
            role="dialog"
            aria-modal="true"
          >
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-card border border-border w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 my-8"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gold-ink">
                    {isEditingSection
                      ? t('Edit Collection')
                      : t('New Collection')}
                  </h3>
                  <button
                    onClick={closeOverlay}
                    className="text-text-muted hover:text-text-main"
                    aria-label={t('Close')}
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelClass} htmlFor="section-en">
                      {t('English Name')}
                    </label>
                    <input
                      id="section-en"
                      type="text"
                      value={newSectionName.en}
                      onChange={(e) => setNewSectionName((prev) => ({ ...prev, en: e.target.value }))}
                      className={inputClass}
                      placeholder="e.g., Morning Adhkar"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="section-bn">
                      {t('Bengali Name')}
                    </label>
                    <input
                      id="section-bn"
                      type="text"
                      value={newSectionName.bn}
                      onChange={(e) => setNewSectionName((prev) => ({ ...prev, bn: e.target.value }))}
                      className={inputClass}
                      placeholder="যেমন: সকালের জিকির"
                    />
                  </div>

                  <button
                    onClick={handleSaveSection}
                    disabled={!newSectionName.en.trim() && !newSectionName.bn.trim()}
                    className="w-full py-4 bg-gold text-on-gold font-bold rounded-2xl shadow-lg hover:bg-gold/90 transition-colors disabled:opacity-50 mt-4"
                  >
                    {isEditingSection ? t('Update') : t('Create')}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backup & Restore */}
      <AnimatePresence>
        {overlay?.kind === 'backup' && (
          <BackupModal getLocalizedText={t} onClose={closeOverlay} overlayClassName={`${overlayShell} z-[110]`} />
        )}
      </AnimatePresence>

      {/* Rating Modal */}
      <AnimatePresence>
        {overlay?.kind === 'rating' && (
          <motion.div
            key="rating-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] overflow-y-auto bg-bg/95 backdrop-blur-md pt-safe"
            role="dialog"
            aria-modal="true"
          >
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-card border border-border w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-center"
              >
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 rounded-3xl bg-gold/10 flex items-center justify-center text-gold-ink">
                    <Star size={40} fill={ratingValue > 0 ? 'currentColor' : 'none'} />
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-text-main mb-2">
                  {t('Enjoying Tasbeeh?')}
                </h3>
                <p className="text-sm text-text-sub mb-8 leading-relaxed">
                  {t('Your feedback helps us grow and reach more people. How would you rate your experience?')}
                </p>

                <div className="flex justify-center gap-2 mb-10">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => {
                        setRatingValue(star);
                        vibrate(10);
                      }}
                      className="p-1 transition-transform active:scale-90"
                      aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
                      aria-pressed={star <= ratingValue}
                    >
                      <Star
                        size={36}
                        className={star <= ratingValue ? 'text-gold-ink' : 'text-border'}
                        fill={star <= ratingValue ? 'currentColor' : 'none'}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {ratingValue > 0 ? (
                    <button
                      onClick={() => {
                        if (ratingValue < 4) {
                          window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                            `${APP_NAME} — feedback (${ratingValue} stars)`
                          )}`;
                        } else {
                          window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
                        }
                        setRatingValue(0);
                        closeOverlay();
                      }}
                      className="w-full py-4 bg-gold text-on-gold font-bold rounded-2xl shadow-lg hover:bg-gold/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {ratingValue >= 4 && <Star size={18} fill="currentColor" />}
                      {ratingValue < 4
                        ? t('Send Feedback')
                        : t('Rate on Play Store')}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-4 bg-border text-text-muted font-bold rounded-2xl opacity-50 cursor-not-allowed"
                    >
                      {t('Select Stars')}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setRatingValue(0);
                      closeOverlay();
                    }}
                    className="w-full py-3 text-sm font-bold text-text-muted hover:text-text-main transition-colors"
                  >
                    {t('Maybe Later')}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} setActiveTab={selectTab} getLocalizedText={t} />

      <UpdatePrompt getLocalizedText={t} onPendingChange={setUpdatePending} />

      {/* Both bars sit at the same place above the nav, so only one may show.
          An update is transient and more urgent than an install hint, and
          neither belongs on top of the first-run screen. */}
      {!needsSetup && !updatePending && <InstallPrompt getLocalizedText={t} />}

      {needsSetup && (
        <FirstRunSetup
          getLocalizedText={t}
          language={language}
          onLanguageChange={setLanguage}
          theme={currentTheme}
          onThemeChange={setCurrentTheme}
          isSoundOn={isSoundEnabled}
          setIsSoundOn={setIsSoundEnabled}
          isHapticOn={isHapticEnabled}
          setIsHapticOn={setIsHapticEnabled}
          autoAdvance={autoAdvance}
          setAutoAdvance={setAutoAdvance}
          routineScope={routineScope}
          setRoutineScope={setRoutineScope}
          onDone={() => {
            writeString('dhikr-setup-done-v1', '1');
            setNeedsSetup(false);
          }}
        />
      )}

      {/* Focus Mode Overlay */}
      <AnimatePresence>
        {overlay?.kind === 'focus' && focusItem && (
          <FocusModeOverlay
            item={focusItem}
            count={currentCounts[focusItem.id] || 0}
            target={getTarget(focusItem)}
            onIncrement={() => incrementInFocus(focusItem)}
            onReset={() => handleResetItem(focusItem.id)}
            onClose={closeOverlay}
            onPrev={() => moveFocus(-1)}
            onNext={overlay.cycle ? advanceCycle : () => moveFocus(1)}
            onAdvanceTap={overlay.cycle && !repeatingSet ? advanceCycle : undefined}
            hasPrev={overlay.cycle || overlay.index > 0}
            hasNext={overlay.cycle || overlay.index < overlay.ids.length - 1}
            position={{ current: overlay.index + 1, total: overlay.ids.length }}
            getLocalizedText={t}
            language={language}
            showTransliteration={showTransliteration}
            showTranslation={showTranslation}
            isFavorite={favorites.includes(focusItem.id)}
            onToggleFavorite={() => toggleFavorite(focusItem.id)}
            isPinned={pinnedIds.includes(focusItem.id)}
            onTogglePin={() => togglePin(focusItem.id)}
            onShare={() => void handleShare(focusItem)}
            shareStatus={shareStatus}
            reading={{ arabicSize: arabicFontSize, textSize: englishFontSize, leading: readingLeading }}
            onChangeReading={(patch) => {
              if (patch.arabicSize !== undefined) setArabicFontSize(patch.arabicSize);
              if (patch.textSize !== undefined) setEnglishFontSize(patch.textSize);
              if (patch.leading !== undefined) setReadingLeading(patch.leading);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
