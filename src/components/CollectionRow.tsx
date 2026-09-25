import React from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { DhikrItem, Language, LocalizedText } from '../constants';
import { CategoryIntro } from '../data/categories';
import { formatNumber } from '../i18n';

export interface Collection {
  key: string;
  meta: {
    en: string;
    bn: string;
    icon: string;
    noun?: { en: string; bn: string };
    intro?: CategoryIntro;
  };
  items: DhikrItem[];
}

/** One line of "Recently read": a single du'a, or a set read through. */
export type RecentEntry = { kind: 'item'; item: DhikrItem } | { kind: 'collection'; collection: Collection };

interface CollectionRowProps {
  collection: Collection;
  /** Where the reader last got to, 0 when unstarted. */
  position?: number;
  language: Language;
  getLocalizedText: (text: LocalizedText | string | undefined) => string;
  onOpen: (key: string) => void;
  onRestart?: (key: string) => void;
}

/**
 * A saved or pinned category, as one row.
 *
 * A category is a parent du'a: it carries the benefit and the source, and its
 * du'as are its children. Saving the parent saves the family, so this is one
 * row whether it holds six occasion du'as or all ninety-nine names — the
 * alternative put ninety-nine cards on a screen meant to be glanced at.
 *
 * Tapping it opens the parent's page rather than the reader. "Start again"
 * shows only once there is a position to clear, where it is one tap from the
 * thing it resets.
 */
const CollectionRow: React.FC<CollectionRowProps> = ({
  collection: { key, meta, items },
  position = 0,
  language,
  getLocalizedText,
  onOpen,
  onRestart
}) => {
  const resuming = position > 0 && position < items.length;
  const noun = meta.noun ? getLocalizedText(meta.noun) : getLocalizedText('du’as');

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        onClick={() => onOpen(key)}
        className="flex w-full items-center gap-3 px-4 py-3 text-start transition-all hover:border-gold/45 active:scale-[0.995]"
      >
        <span aria-hidden="true" className="text-lg">
          {meta.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-text-main">{getLocalizedText(meta)}</span>
          <span className="mt-0.5 block truncate text-xs text-text-sub">
            {resuming
              ? `${getLocalizedText('Continue from')} ${formatNumber(position + 1, language)} · ${getLocalizedText(items[position].title)}`
              : `${formatNumber(items.length, language)} ${noun}`}
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-text-muted" />
      </button>
      {resuming && onRestart ? (
        <button
          onClick={() => onRestart(key)}
          className="flex min-h-11 w-full items-center gap-1.5 border-t border-border px-4 text-xs font-bold text-text-muted transition-colors hover:text-gold-ink"
        >
          <RotateCcw size={12} />
          {getLocalizedText('Start again')}
        </button>
      ) : null}
    </div>
  );
};

export default CollectionRow;
