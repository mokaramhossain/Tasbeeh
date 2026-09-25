import React from 'react';
import { ChevronRight, Heart, Pin } from 'lucide-react';
import { DhikrItem, Language, LocalizedText } from '../constants';
import { isAsmaId } from '../data/asmaulHusna';
import { formatNumber } from '../i18n';

interface DuaRowProps {
  item: DhikrItem;
  language: Language;
  getLocalizedText: (text: LocalizedText | string | undefined) => string;
  onOpen: () => void;
  isFavorite?: boolean;
  isPinned?: boolean;
}

/**
 * A one-tap-to-open list row.
 *
 * The Du'a tab used to render all 71 duas as fully expanded cards — a 53,000px
 * page, roughly 59 screens of scrolling to reach the last one. Reading a chosen
 * dua and finding one among seventy are different jobs; this is the second.
 */
const DuaRow: React.FC<DuaRowProps> = ({
  item,
  language,
  getLocalizedText,
  onOpen,
  isFavorite,
  isPinned
}) => {
  const meaning = getLocalizedText(item.meaning);
  /*
   * A name's row leads with its place in the sequence, which is what someone
   * working through them wants, and then where the name is found — each name
   * cites its own verse, or the narration that lists it.
   */
  const ordinal = isAsmaId(item.id) ? Number(item.id.slice('asma_'.length)) : null;
  const source = [item.source, item.ref].filter(Boolean).join(' · ');
  const citation = ordinal
    ? [`${formatNumber(ordinal, language)} / ${formatNumber(99, language)}`, source].filter(Boolean).join('  ·  ')
    : source;

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-start transition-all hover:border-gold/45 active:scale-[0.995]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold leading-tight text-text-main">
            {getLocalizedText(item.title)}
          </h3>
          {isFavorite ? <Heart size={12} className="shrink-0 text-gold-ink" fill="currentColor" /> : null}
          {isPinned ? <Pin size={12} className="shrink-0 text-gold-ink" fill="currentColor" /> : null}
        </div>
        {meaning ? <p className="mt-0.5 truncate text-xs leading-relaxed text-text-sub">{meaning}</p> : null}
        {citation ? (
          <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.18em] text-text-muted">{citation}</p>
        ) : null}
      </div>
      <ChevronRight size={18} className="shrink-0 text-text-muted" />
    </button>
  );
};

export default DuaRow;
