import React from 'react';
import { HandHelping, Quote, Sparkle, ChevronRight, Play, RotateCcw } from 'lucide-react';
import { DhikrItem, Language, LocalizedText } from '../constants';
import { ASMA_DATA } from '../data/asmaulHusna';
import { CATEGORY_META } from '../data/categories';
import DhikrCard from '../components/DhikrCard';
import { getHadithOfTheDay } from '../data/hadiths';
import { getReflectionOfTheDay } from '../data/reflections';
import { HIJRI_NOTE, SLOT_META, type Slot } from '../data/rightNow';
import CollectionRow, { type Collection } from '../components/CollectionRow';
import { formatNumber } from '../i18n';

interface AdhkarScreenProps {
  getLocalizedText: (text: LocalizedText | string | undefined) => string;
  counts: Record<string, number>;
  onCountChange: (id: string, target: number) => void;
  onResetItem: (id: string) => void;
  /**
   * The target an item is counted to, resolved centrally.
   *
   * The cards used to read `customTargets[id] ?? item.target` themselves, which
   * meant a repetition set on a category or a collection reached the reader and
   * not the card — the same du'a showing two different goals on two screens.
   */
  getTarget: (item: DhikrItem) => number;
  onSetTarget: (item: DhikrItem) => void;
  routineItems: { core: DhikrItem[]; optional: DhikrItem[]; protection: DhikrItem[] };
  /** Reads the whole routine through, starting at the first unfinished du'a. */
  onPlayRoutine?: () => void;
  routineTotal?: number;
  routineDone?: number;
  onResetRoutine: () => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  language: Language;
  onFocus: (item: DhikrItem, list: DhikrItem[]) => void;
  pinnedIds: string[];
  onTogglePin: (id: string) => void;
  allDhikrItems: DhikrItem[];
  sections?: { id: string; name: LocalizedText }[];
  onMoveToCollection?: (itemId: string, sectionId: string) => void;
  showTransliteration?: boolean;
  showTranslation?: boolean;
  /** Takes the user to the Du'a tab, where the pin control actually lives. */
  onBrowseDuas?: () => void;
  /** Today, as a local date key — drives the hadith and the reflection. */
  currentDate: string;
  /** What fits this moment: time of day, weekday, or a date in the year. */
  rightNowItems: DhikrItem[];
  rightNowSlot: Slot;
  onOpenItem: (item: DhikrItem, list: DhikrItem[]) => void;
  /** Categories pinned as a whole — one row each, not one row per member. */
  pinnedCollections?: Collection[];
  readingPositions?: Record<string, number>;
  onOpenCollection?: (key: string) => void;
  onRestartCollection?: (key: string) => void;
  /** The ninety-nine names, read through from Home like the routine. */
  names?: NamesPlayback;
}

export interface NamesPlayback {
  /** Where the reader got to, 0 when unstarted. */
  position: number;
  total: number;
  /** Full rounds completed since the last reset today. */
  rounds: number;
  /** Anything to reset: a place, a counter or a round. */
  hasProgress: boolean;
  onPlay: () => void;
  onReset: () => void;
}

const SectionHeader = ({
  title,
  subtitle,
  count,
  getLocalizedText
}: {
  title: LocalizedText;
  subtitle?: LocalizedText;
  count?: React.ReactNode;
  getLocalizedText: (text: LocalizedText | string | undefined) => string;
}) => (
  <div className="mb-3 px-1">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold text-text-main">{getLocalizedText(title)}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-relaxed text-text-sub">{getLocalizedText(subtitle)}</p> : null}
      </div>
      {count !== undefined && count !== null ? (
        <div className="shrink-0 rounded-full bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-ink">
          {count}
        </div>
      ) : null}
    </div>
  </div>
);

const AdhkarScreen: React.FC<AdhkarScreenProps> = ({
  getLocalizedText,
  counts,
  onCountChange,
  getTarget,
  onSetTarget,
  onResetItem,
  routineItems,
  onPlayRoutine,
  routineTotal = 0,
  routineDone = 0,
  onResetRoutine,
  favorites,
  toggleFavorite,
  language,
  onFocus,
  pinnedIds,
  onTogglePin,
  allDhikrItems,
  sections,
  onMoveToCollection,
  showTransliteration,
  showTranslation,
  onBrowseDuas,
  currentDate,
  rightNowItems,
  rightNowSlot,
  onOpenItem,
  pinnedCollections = [],
  readingPositions,
  onOpenCollection,
  onRestartCollection,
  names
}) => {
  const pinnedItems = (allDhikrItems || []).filter((item) => (pinnedIds || []).includes(item.id));

  // The list is threaded through so Focus Mode's next/previous arrows can walk
  // the same section the user opened it from.
  const renderCard = (list: DhikrItem[]) => (item: DhikrItem) => (
    <DhikrCard
      key={item.id}
      item={item}
      count={counts[item.id] || 0}
      onIncrement={() => onCountChange(item.id, getTarget(item))}
      targetOverride={getTarget(item)}
      onEditTarget={() => onSetTarget(item)}
      onReset={() => onResetItem(item.id)}
      getLocalizedText={getLocalizedText}
      isFavorite={favorites.includes(item.id)}
      onToggleFavorite={() => toggleFavorite(item.id)}
      onFocus={() => onFocus(item, list)}
      isPinned={pinnedIds.includes(item.id)}
      onTogglePin={() => onTogglePin(item.id)}
      language={language}
      showTransliteration={showTransliteration}
      showTranslation={showTranslation}
      sections={sections}
      onMoveToCollection={onMoveToCollection ? (sectionId) => onMoveToCollection(item.id, sectionId) : undefined}
    />
  );

  const hadith = getHadithOfTheDay(currentDate);
  const reflection = getReflectionOfTheDay(currentDate);

  const core = routineItems?.core || [];
  const optional = routineItems?.optional || [];
  const protection = routineItems?.protection || [];

  const slotMeta = SLOT_META[rightNowSlot];

  return (
    <div className="w-full space-y-7 pt-3 pb-8">
      {/* What fits this moment, before the routine — the reason to open the app
          at all. Curated ids, so it stays a nudge rather than a second
          catalogue. */}
      {rightNowItems.length > 0 ? (
        <section>
          <p className="mb-3 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.22em] text-gold-ink">
            <span aria-hidden="true">{slotMeta.icon}</span>
            {getLocalizedText(slotMeta.label)}
          </p>
          {/* Title only: the strip sits above the routine, and a title such
              as "Upon Waking Up" already says what the du'a is. The meaning is
              one tap away, in the reader. */}
          <div className="space-y-2">
            {rightNowItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenItem(item, rightNowItems)}
                className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 text-start transition-all hover:border-gold/45 active:scale-[0.995]"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-text-main">
                  {getLocalizedText(item.title)}
                </span>
                <ChevronRight size={16} className="shrink-0 text-text-muted" />
              </button>
            ))}
          </div>
          {/* Umm al-Qura is calculated; local sighting can differ by a day. The
              app offers the du'a and lets the reader judge the date. */}
          {slotMeta.occasion ? (
            <p className="mt-2 px-1 text-[10px] leading-relaxed text-text-muted">
              {getLocalizedText(HIJRI_NOTE)}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* The sections are the map; this is the doing. Core and Protection are
          one sitting after salah — istighfar, the tasbih, then Ayatul Kursi and
          the Quls — and until now the app offered them only as cards to tap in
          whatever order you noticed them. */}
      {onPlayRoutine && routineTotal > 0 ? (
        <button
          onClick={onPlayRoutine}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold px-5 text-sm font-bold text-on-gold transition-all hover:opacity-90 active:scale-[0.99]"
        >
          <Play size={16} fill="currentColor" />
          {routineDone > 0 && routineDone < routineTotal
            ? `${getLocalizedText('Continue')} · ${formatNumber(routineDone, language)} / ${formatNumber(routineTotal, language)}`
            : `${getLocalizedText('Play the routine')} · ${formatNumber(routineTotal, language)}`}
        </button>
      ) : null}

      {/* The names are a routine of their own — read most days, and ninety-nine
          long, so rarely in one sitting. One button, resuming at the last name
          read, with its own reset beside it: starting the names again should
          not mean resetting the after-salah round, or the whole day. */}
      {names ? (
        <div className="-mt-4 flex items-stretch gap-2">
          <button
            onClick={names.onPlay}
            className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-gold/40 bg-card px-4 text-start transition-all hover:border-gold active:scale-[0.99]"
          >
            <Play size={16} fill="currentColor" className="shrink-0 text-gold-ink" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-text-main">
                {getLocalizedText(CATEGORY_META.names)}
              </span>
              <span className="mt-0.5 block truncate text-xs text-text-sub">
                {names.position > 0
                  ? `${getLocalizedText('Continue from')} ${formatNumber(names.position + 1, language)} · ${getLocalizedText(ASMA_DATA[names.position]?.title)}`
                  : `${formatNumber(names.total, language)} ${getLocalizedText(CATEGORY_META.names.noun)}`}
                {names.rounds > 0
                  ? ` · ${getLocalizedText('Rounds today')} ${formatNumber(names.rounds, language)}`
                  : ''}
              </span>
            </span>
            {names.position > 0 ? (
              <span className="shrink-0 text-[10px] font-bold tabular-nums text-gold-ink">
                {formatNumber(names.position + 1, language)}/{formatNumber(names.total, language)}
              </span>
            ) : null}
          </button>
          {names.hasProgress ? (
            <button
              onClick={names.onReset}
              aria-label={`${getLocalizedText('Reset')} ${getLocalizedText(CATEGORY_META.names)}`}
              title={`${getLocalizedText('Reset')} ${getLocalizedText(CATEGORY_META.names)}`}
              className="flex min-h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-text-muted transition-all hover:border-gold/40 hover:text-gold-ink"
            >
              <RotateCcw size={18} />
            </button>
          ) : null}
        </div>
      ) : null}

      <section>
        <SectionHeader
          title={'Core Adhkar'}
          subtitle={'Your main after-salah routine'}
          count={formatNumber(core.length, language)}
          getLocalizedText={getLocalizedText}
        />
        <div className="space-y-4">{core.map(renderCard(core))}</div>
      </section>

      {/* Was computed in App but never rendered, so any optional adhkar added to
          the routine simply never appeared. */}
      {optional.length > 0 ? (
        <section>
          <SectionHeader
            title={'Optional Adhkar'}
            subtitle={'Extra remembrance when you have time'}
            count={formatNumber(optional.length, language)}
            getLocalizedText={getLocalizedText}
          />
          <div className="space-y-4">{optional.map(renderCard(optional))}</div>
        </section>
      ) : null}

      {/* Empty when the routine is set to the core alone, and an empty section
          is a heading over nothing. The same four texts stay in the Du'a tab. */}
      {protection.length > 0 ? (
        <section>
          <SectionHeader
            title={'Protection'}
            subtitle={'Dua for Protection: The Power of Ayatul Kursi and the 3 Quls'}
            count={formatNumber(protection.length, language)}
            getLocalizedText={getLocalizedText}
          />
          <div className="space-y-4">{protection.map(renderCard(protection))}</div>
        </section>
      ) : null}

      <section>
        <SectionHeader
          title={'Pinned by You'}
          subtitle={'Quick access to selected items'}
          count={formatNumber(pinnedItems.length + pinnedCollections.length, language)}
          getLocalizedText={getLocalizedText}
        />
        {/* A pinned collection is one row, not one row per member — the
            ninety-nine names as a single thing — and it opens the reader where
            it was left. Sits above the individual cards because it is the
            shortest item in the section, not because it outranks them. */}
        {pinnedCollections.length > 0 ? (
          <div className={`space-y-2 ${pinnedItems.length > 0 ? 'mb-4' : ''}`}>
            {pinnedCollections.map((collection) => (
              <CollectionRow
                key={collection.key}
                collection={collection}
                position={readingPositions?.[collection.key] ?? 0}
                language={language}
                getLocalizedText={getLocalizedText}
                onOpen={(key) => onOpenCollection?.(key)}
                onRestart={(key) => onRestartCollection?.(key)}
              />
            ))}
          </div>
        ) : null}
        {pinnedItems.length > 0 ? (
          <div className="space-y-4">{pinnedItems.map(renderCard(pinnedItems))}</div>
        ) : pinnedCollections.length > 0 ? null : (
          /* Telling someone to pin something, without saying where the pin
             lives or offering a way to get there, is a dead end. */
          <div className="rounded-2xl border border-dashed border-border bg-bg/40 px-4 py-5">
            <p className="text-sm leading-relaxed text-text-sub">
              {getLocalizedText('Pin a dhikr or surah to see it here.')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              {getLocalizedText('Open any du\'a and tap the pin to keep it on this screen.')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {onBrowseDuas ? (
                <button
                  onClick={onBrowseDuas}
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-bold text-gold-ink transition-all hover:border-gold/40"
                >
                  <HandHelping size={15} />
                  {getLocalizedText('Browse du\'as')}
                </button>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <div className="pt-1">
        <button
          onClick={onResetRoutine}
          className="w-full rounded-2xl bg-gold px-5 py-4 text-sm font-bold text-on-gold transition-all hover:opacity-90 active:scale-[0.99]"
        >
          {getLocalizedText('Reset for New Salah')}
        </button>
      </div>

      {/* The day closes here. Both were buried in Settings, where a page nobody
          reads twice made a daily hadith pointless and a single fixed
          reflection went unnoticed. */}
      <section className="space-y-3 pt-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-gold-ink">
            <Quote size={11} />
            {getLocalizedText('Hadith of the day')}
          </p>
          <p className="text-sm italic leading-relaxed text-text-main">{getLocalizedText(hadith.text)}</p>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
            {hadith.source}
            {hadith.ref ? ` · ${hadith.ref}` : ''}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-gold-ink">
            <Sparkle size={11} />
            {getLocalizedText('Reflection')}
          </p>
          <p className="text-sm leading-relaxed text-text-main">{getLocalizedText(reflection)}</p>
        </div>
      </section>
    </div>
  );
};

export default AdhkarScreen;
