import React, { useState } from 'react';
import { ArrowLeft, BookOpen, ChevronDown, Clock3, Heart, LayoutGrid, Pin, Play, RotateCcw, Search, Sparkles } from 'lucide-react';
import { DhikrItem, Language, LocalizedText } from '../constants';
import { CATEGORY_META } from '../data/categories';
import SearchBar from '../components/SearchBar';
import CategoryGrid from '../components/CategoryGrid';
import DuaRow from '../components/DuaRow';
import CollectionRow, { type RecentEntry } from '../components/CollectionRow';
import { formatNumber } from '../i18n';

interface DuaScreenProps {
  language: Language;
  getLocalizedText: (text: LocalizedText | string | undefined) => string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  categories: string[];
  categoryCounts: Record<string, number>;
  filteredItems: DhikrItem[];
  totalCount: number;
  favoriteItems: DhikrItem[];
  /** Du'as and whole sets, newest first — the names appear once, not per name. */
  recentEntries: RecentEntry[];
  isFavorite: (id: string) => boolean;
  isPinned: (id: string) => boolean;
  onOpen: (item: DhikrItem, list: DhikrItem[]) => void;
  /** A category is a parent du'a: saved, pinned and read like one. */
  onTogglePinCategory?: (category: string) => void;
  isCategoryPinned?: (category: string) => boolean;
  onToggleFavoriteCategory?: (category: string) => void;
  isCategoryFavorite?: (category: string) => boolean;
  /** Opens the reader over the whole category, resuming where it was left. */
  onReadCategory?: (category: string) => void;
  /** How far through the category the reader has got, 0 when unstarted. */
  categoryPosition?: number;
  /** How many times each du'a in the category is recited before moving on. */
  categoryTarget?: number;
  onEditCategoryTarget?: (category: string) => void;
  /** Starts one set again: its place and today's counters, nothing else. */
  onResetCategory?: (category: string) => void;
  categoryHasProgress?: boolean;
  /** Where each set was left, for "Continue from" on a recent set. */
  readingPositions?: Record<string, number>;
}

const QuickSection: React.FC<{
  icon: React.ReactNode;
  title: LocalizedText;
  items: DhikrItem[];
  language: Language;
  getLocalizedText: (text: LocalizedText | string | undefined) => string;
  isFavorite: (id: string) => boolean;
  isPinned: (id: string) => boolean;
  onOpen: (item: DhikrItem, list: DhikrItem[]) => void;
}> = ({ icon, title, items, language, getLocalizedText, isFavorite, isPinned, onOpen }) => (
  <section className="space-y-2">
    <p className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold-ink">
      {icon}
      {getLocalizedText(title)}
    </p>
    <div className="space-y-2">
      {items.map((item) => (
        <DuaRow
          key={item.id}
          item={item}
          language={language}
          getLocalizedText={getLocalizedText}
          onOpen={() => onOpen(item, items)}
          isFavorite={isFavorite(item.id)}
          isPinned={isPinned(item.id)}
        />
      ))}
    </div>
  </section>
);

/**
 * Browse first, then read.
 *
 * This screen used to render all 71 duas as fully expanded cards: a 53,000px
 * page — about 59 screens — with only 3 of 21 categories reachable without
 * scrolling a strip sideways. Finding a dua and reading one are different jobs,
 * so the list is compact and the reading happens in the full-screen reader.
 */
const DuaScreen: React.FC<DuaScreenProps> = ({
  language,
  getLocalizedText,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategorySelect,
  categories,
  categoryCounts,
  filteredItems,
  totalCount,
  favoriteItems,
  recentEntries,
  isFavorite,
  isPinned,
  onOpen,
  onTogglePinCategory,
  isCategoryPinned,
  onToggleFavoriteCategory,
  isCategoryFavorite,
  onReadCategory,
  categoryPosition = 0,
  categoryTarget = 1,
  onEditCategoryTarget,
  onResetCategory,
  categoryHasProgress = false,
  readingPositions = {}
}) => {
  const [showAll, setShowAll] = useState(false);

  const hasSearch = searchQuery.trim().length > 0;
  const hasCategory = selectedCategory !== 'All';
  const isListView = hasSearch || hasCategory || showAll;

  const backToBrowse = () => {
    onSearchChange('');
    onCategorySelect('All');
    setShowAll(false);
  };

  const activeMeta = hasCategory ? CATEGORY_META[selectedCategory] : null;
  /** The recent du'as alone, so the reader's arrows walk those and skip sets. */
  const recentItems = recentEntries.slice(0, 4).flatMap((entry) => (entry.kind === 'item' ? [entry.item] : []));
  const resuming = categoryPosition > 0 && categoryPosition < filteredItems.length;
  const noun = activeMeta?.noun ? getLocalizedText(activeMeta.noun) : getLocalizedText('du’as');
  const listTitle = hasSearch
    ? getLocalizedText('Search results')
    : activeMeta
      ? getLocalizedText(activeMeta)
      : getLocalizedText('All supplications');

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-4 pb-8">
      <SearchBar
        value={searchQuery}
        onChange={onSearchChange}
        placeholder={getLocalizedText('Search Duas...')}
      />

      {isListView ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={backToBrowse}
              aria-label={getLocalizedText('Back to categories')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-text-muted transition-all hover:border-gold/40 hover:text-gold-ink"
            >
              <ArrowLeft size={16} />
            </button>
            {/* Wraps rather than truncating: "Morning & Eve…" was cutting the
                name of the set you are reading, to save a line. */}
            <h2 className="min-w-0 flex-1 text-lg font-bold leading-snug text-text-main">
              {activeMeta ? `${activeMeta.icon} ${listTitle}` : listTitle}
            </h2>
            <span className="shrink-0 rounded-full bg-gold/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gold-ink">
              {formatNumber(filteredItems.length, language)}
            </span>
            {/* A category is a parent du'a, so it carries the same two actions
                an individual du'a does: heart saves it, pin puts it on Home.
                Both keep it as one row, never as ninety-nine. */}
            {onToggleFavoriteCategory && hasCategory && !hasSearch ? (
              <button
                onClick={() => onToggleFavoriteCategory(selectedCategory)}
                aria-pressed={isCategoryFavorite?.(selectedCategory) ?? false}
                aria-label={getLocalizedText('Save this collection')}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${
                  isCategoryFavorite?.(selectedCategory)
                    ? 'border-gold bg-gold/15 text-gold-ink'
                    : 'border-border bg-card text-text-muted hover:border-gold/40 hover:text-gold-ink'
                }`}
              >
                <Heart size={15} fill={isCategoryFavorite?.(selectedCategory) ? 'currentColor' : 'none'} />
              </button>
            ) : null}
            {/* Not for the names: Home always carries them, with a button
                of their own, so a pin there would change nothing. */}
            {onTogglePinCategory && hasCategory && !hasSearch && selectedCategory !== 'names' ? (
              <button
                onClick={() => onTogglePinCategory(selectedCategory)}
                aria-pressed={isCategoryPinned?.(selectedCategory) ?? false}
                aria-label={getLocalizedText('Pin this collection')}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${
                  isCategoryPinned?.(selectedCategory)
                    ? 'border-gold bg-gold/15 text-gold-ink'
                    : 'border-border bg-card text-text-muted hover:border-gold/40 hover:text-gold-ink'
                }`}
              >
                <Pin size={15} fill={isCategoryPinned?.(selectedCategory) ? 'currentColor' : 'none'} />
              </button>
            ) : null}
          </div>

          {/* The benefit and the source of a set belong to the set. Printing
              them under each of ninety-nine members said nothing, ninety-nine
              times. Suppressed while searching, where the heading is results. */}
          {activeMeta?.intro && !hasSearch ? (
            <div className="rounded-2xl border border-gold/15 bg-gold/5 p-4">
              <p
                className="text-text-sub"
                style={{ fontSize: 'calc(var(--english-size) * 0.94)', lineHeight: 'var(--reading-leading)' }}
              >
                {getLocalizedText(activeMeta.intro.description)}
              </p>
              {/* Closed by default. The virtue of a set is worth reading once,
                  not five lines of it on every visit before you reach the
                  du'as. `key` closes it again on the next category, so there
                  is no open state to keep in step; `<details>` brings its own
                  keyboard and screen-reader behaviour. */}
              {activeMeta.intro.benefit ? (
                <details key={selectedCategory} className="group mt-3">
                  <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gold-ink">
                    <Sparkles size={11} />
                    {getLocalizedText('Benefit')}
                    <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
                  </summary>
                  <p
                    className="mt-1 text-text-sub"
                    style={{ fontSize: 'calc(var(--english-size) * 0.94)', lineHeight: 'var(--reading-leading)' }}
                  >
                    {getLocalizedText(activeMeta.intro.benefit)}
                  </p>
                </details>
              ) : null}
              {activeMeta.intro.source ? (
                <p className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                  <BookOpen size={10} />
                  {[activeMeta.intro.source, activeMeta.intro.ref].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* One number on the parent instead of the same edit ninety-nine
              times. 1 is "read each once", which is what a set means by
              default, so the row states it rather than hiding at zero. */}
          {/* One saved du'a recited seven times is a repetition too. This
              asked for two, which hid the control from anyone who had one. */}
          {onEditCategoryTarget && hasCategory && !hasSearch && filteredItems.length > 0 ? (
            <button
              onClick={() => onEditCategoryTarget(selectedCategory)}
              className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-border bg-card px-4 text-start transition-all hover:border-gold/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-text-main">
                  {getLocalizedText('Recite each')}
                </span>
                <span className="mt-0.5 block text-xs text-text-sub">
                  {getLocalizedText('Then move on to the next one.')}
                </span>
              </span>
              <span className="ms-3 shrink-0 rounded-full bg-gold/10 px-3 py-1 text-xs font-bold text-gold-ink">
                ×{formatNumber(categoryTarget, language)}
              </span>
            </button>
          ) : null}

          {/* Reading the set straight through, from the parent rather than only
              from a pinned row. Resumes where it was left. */}
          {onReadCategory && hasCategory && !hasSearch && filteredItems.length > 1 ? (
            <div className="flex items-stretch gap-2">
              <button
                onClick={() => onReadCategory(selectedCategory)}
                className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-gold px-5 text-sm font-bold text-on-gold transition-all hover:opacity-90 active:scale-[0.99]"
              >
                <Play size={15} fill="currentColor" />
                {resuming
                  ? `${getLocalizedText('Read through')} · ${getLocalizedText('continue from')} ${formatNumber(categoryPosition + 1, language)}`
                  : `${getLocalizedText('Read through')} · ${formatNumber(filteredItems.length, language)} ${noun}`}
              </button>
              {/* This set only. Reset All in the header clears the whole day,
                  which is not what someone starting the names again means. */}
              {onResetCategory && categoryHasProgress ? (
                <button
                  onClick={() => onResetCategory(selectedCategory)}
                  aria-label={`${getLocalizedText('Reset')} ${listTitle}`}
                  title={`${getLocalizedText('Reset')} ${listTitle}`}
                  className="flex min-h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-text-muted transition-all hover:border-gold/40 hover:text-gold-ink"
                >
                  <RotateCcw size={16} />
                </button>
              ) : null}
            </div>
          ) : null}

          {filteredItems.length > 0 ? (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <DuaRow
                  key={item.id}
                  item={item}
                  language={language}
                  getLocalizedText={getLocalizedText}
                  onOpen={() => onOpen(item, filteredItems)}
                  isFavorite={isFavorite(item.id)}
                  isPinned={isPinned(item.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
              <Sparkles size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-bold uppercase tracking-widest">
                {getLocalizedText('No results found')}
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {favoriteItems.length > 0 ? (
            <QuickSection
              icon={<Heart size={11} fill="currentColor" />}
              title={'Favourites'}
              items={favoriteItems.slice(0, 4)}
              language={language}
              getLocalizedText={getLocalizedText}
              isFavorite={isFavorite}
              isPinned={isPinned}
              onOpen={onOpen}
            />
          ) : null}

          {/* A set read through shows as one row that picks up at the last
              one read, rather than as the four names most recently opened. */}
          {recentEntries.length > 0 ? (
            <section className="space-y-2">
              <p className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold-ink">
                <Clock3 size={11} />
                {getLocalizedText('Recently read')}
              </p>
              <div className="space-y-2">
                {recentEntries.slice(0, 4).map((entry) =>
                  entry.kind === 'collection' ? (
                    <CollectionRow
                      key={entry.collection.key}
                      collection={entry.collection}
                      position={readingPositions[entry.collection.key] ?? 0}
                      language={language}
                      getLocalizedText={getLocalizedText}
                      onOpen={(key) => (onReadCategory ? onReadCategory(key) : onCategorySelect(key))}
                      onRestart={onResetCategory}
                    />
                  ) : (
                    <DuaRow
                      key={entry.item.id}
                      item={entry.item}
                      language={language}
                      getLocalizedText={getLocalizedText}
                      onOpen={() => onOpen(entry.item, recentItems)}
                      isFavorite={isFavorite(entry.item.id)}
                      isPinned={isPinned(entry.item.id)}
                    />
                  )
                )}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <p className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold-ink">
              <LayoutGrid size={11} />
              {getLocalizedText('Browse by category')}
            </p>
            <CategoryGrid
              categories={categories}
              counts={categoryCounts}
              onSelect={onCategorySelect}
              getLocalizedText={getLocalizedText}
              language={language}
            />
          </section>

          <button
            onClick={() => setShowAll(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-4 py-3.5 text-sm font-bold text-text-sub transition-all hover:border-gold/40 hover:text-gold-ink"
          >
            <Search size={15} />
            {getLocalizedText('See all')} ({formatNumber(totalCount, language)})
          </button>
        </>
      )}
    </div>
  );
};

export default DuaScreen;
