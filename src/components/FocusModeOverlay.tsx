import React, { useEffect, useRef, useState } from 'react';
import { motion, type PanInfo } from 'motion/react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Share2,
  Heart,
  Pin,
  Check,
  Minus,
  Plus,
  ALargeSmall,
  BookOpen
} from 'lucide-react';
import { DhikrItem, Language, LocalizedText } from '../constants';
import ProgressBar from './ProgressBar';
import { renderText } from '../utils/renderText';
import { isTransliterationHidden, isUserAuthored, readableTransliteration } from '../utils/transliteration';
import { formatDigits, formatNumber } from '../i18n';
import { isAsmaId } from '../data/asmaulHusna';
import { NAME_HIGHLIGHT, NAME_VERSES, VERSE_TRANSLATORS } from '../data/nameVerses.generated';
import useWakeLock from '../hooks/useWakeLock';

interface FocusModeOverlayProps {
  item: DhikrItem;
  count: number;
  target: number;
  onIncrement: () => void;
  onReset: () => void;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  position?: { current: number; total: number };
  getLocalizedText: (text: LocalizedText | string | undefined) => string;
  language: Language;
  /**
   * Replaces tap-to-count on the body. The names have no target, so their
   * reader uses the same gesture to move to the next one instead.
   */
  onAdvanceTap?: () => void;
  showTransliteration?: boolean;
  showTranslation?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onShare?: () => void;
  shareStatus?: string | null;
  /**
   * Reading size, adjustable here rather than only in Settings.
   *
   * These are the same values Settings writes, so a change made with the du'a
   * in front of you is a change everywhere — which is the point. Passed as one
   * object with one setter to keep the six props this would otherwise be.
   */
  reading?: ReadingPrefs;
  onChangeReading?: (patch: Partial<ReadingPrefs>) => void;
}

export interface ReadingPrefs {
  arabicSize: number;
  textSize: number;
  leading: number;
}

/** Bounds shared with the Settings sliders, so neither can escape the other. */
const READING_LIMITS = {
  arabicSize: { min: 20, max: 48, step: 2 },
  textSize: { min: 12, max: 24, step: 1 },
  leading: { min: 1.4, max: 2.4, step: 0.1 }
} as const;

const SHORT_ARABIC_LIMIT = 60;
/** Distance or flick speed needed before a drag counts as a swipe. */
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;
/** How far a finger may travel and still be a tap rather than a scroll. */
const TAP_SLOP = 10;

const FocusModeOverlay: React.FC<FocusModeOverlayProps> = ({
  item,
  count,
  target,
  onIncrement,
  onReset,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  position,
  getLocalizedText,
  language,
  onAdvanceTap,
  showTransliteration = true,
  showTranslation = true,
  isFavorite = false,
  onToggleFavorite,
  isPinned = false,
  onTogglePin,
  onShare,
  shareStatus,
  reading,
  onChangeReading
}) => {
  const [sizePanelOpen, setSizePanelOpen] = useState(false);
  const isDone = target > 0 && count >= target;
  // One gesture, one meaning: whatever the body tap does, the Count button and
  // the keyboard do too.
  //
  // This used to be switched off for any du'a without a numeric goal, to stop
  // counts firing while someone read and scrolled. That cut the wrong way: the
  // screen still shows a running tally and a Count button, so counting plainly
  // is meaningful — refusing the main gesture while displaying its result was
  // the inconsistency. The accident is prevented below instead, at its real
  // cause, which was never "no target" but "a scroll is not a tap".
  const bodyAction = onAdvanceTap ?? onIncrement;
  const progress = target > 0 ? Math.min(Math.round((count / target) * 100), 100) : 0;
  const stop = (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation();
  const isShortArabic = (item.arabic || '').length <= SHORT_ARABIC_LIMIT;
  const transliteration = readableTransliteration(
    getLocalizedText(item.trn),
    language,
    isUserAuthored(item.id)
  );
  // A downloaded surah has a Latin transliteration and no Bengali one; saying
  // so beats leaving a blank where the pronunciation should be.
  const transliterationHidden = isTransliterationHidden(
    getLocalizedText(item.trn),
    language,
    isUserAuthored(item.id)
  );
  const meaning = getLocalizedText(item.meaning);
  const benefit = getLocalizedText(item.benefit);
  const citation = [item.source, item.ref].filter(Boolean).join(', ');
  /*
   * A name is shown with where it is found, in place of the citation box: the
   * verse in which it is said of Allah, with the name picked out, or — for a
   * name cited to the narration — a line saying so rather than a bare number.
   */
  const isName = isAsmaId(item.id);
  const nameVerse = isName && item.source === 'Quran' && item.ref ? NAME_VERSES[item.ref] : undefined;
  const nameSpan = NAME_HIGHLIGHT[item.id];

  // Reciting a long dhikr can easily outlast the screen timeout.
  useWakeLock(true);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      /*
       * Enter and Space belong to whatever has focus.
       *
       * This listener is on `window` and called `preventDefault()` before
       * counting, and Enter on a focused button activates it *through* that
       * default — so a keyboard reader pressing Enter on Save, Share or a size
       * stepper got a count instead of the button. Escape and the arrows stay
       * global: they mean the same thing wherever focus is.
       */
      const onControl =
        event.target instanceof Element &&
        event.target.closest('button, a, input, textarea, select, summary, [contenteditable]');

      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === ' ' || event.key === 'Enter') {
        if (onControl) return;
        event.preventDefault();
        bodyAction();
      } else if (event.key === 'ArrowLeft' && hasPrev) {
        onPrev?.();
      } else if (event.key === 'ArrowRight' && hasNext) {
        onNext?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onIncrement, bodyAction, onPrev, onNext, hasPrev, hasNext]);

  /*
   * A tap counts; a scroll, a swipe and a text selection do not.
   *
   * The distance between press and release separates a tap from a drag, and the
   * selection check covers the one case distance misses — releasing on the spot
   * at the end of a long-press selection. Text stays selectable, because this
   * is the screen built for reading and copying a du'a.
   */
  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  const handleBodyClick = (event: React.MouseEvent) => {
    const from = pressedAt.current;
    pressedAt.current = null;
    if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > TAP_SLOP) return;
    if (window.getSelection()?.toString()) return;
    bodyAction();
  };

  /*
   * Swiping between duas is the primary navigation in comparable apps, and is
   * far more natural on a phone than reaching for the arrows. Dragging left
   * advances, matching the on-screen arrow order.
   */
  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    const wentLeft = offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY;
    const wentRight = offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY;
    if (wentLeft && hasNext) onNext?.();
    else if (wentRight && hasPrev) onPrev?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-bg flex flex-col pt-safe"
      onPointerDown={(event) => { pressedAt.current = { x: event.clientX, y: event.clientY }; }}
      onClick={handleBodyClick}
      role="dialog"
      aria-modal="true"
      aria-label={getLocalizedText('Focus Mode')}
    >
      <div className="border-b border-border p-5 flex items-center justify-between" onClick={stop}>
        <button
          onClick={(e) => { stop(e); onClose(); }}
          className="p-2 hover:bg-card rounded-xl transition-colors text-text-muted"
          aria-label={getLocalizedText('Close focus mode')}
        >
          <X size={24} />
        </button>
        <div className="flex flex-col items-center text-center px-2 min-w-0">
          <span className="text-[10px] font-bold text-gold-ink uppercase tracking-[0.3em] mb-1">
            {getLocalizedText('Focus Mode')}
          </span>
          <h2 className="text-sm font-bold text-text-main truncate max-w-[60vw]">{getLocalizedText(item.title)}</h2>
        </div>
        <div className="w-10 text-end text-[10px] font-bold text-text-muted tabular-nums">
          {position && position.total > 1 ? `${position.current}/${position.total}` : ''}
        </div>
      </div>

      {/* Reading a du'a should let you keep it, use it, or pass it on. */}
      <div className="flex items-center justify-center gap-2 border-b border-border px-5 py-3" onClick={stop}>
        {onToggleFavorite ? (
          <button
            onClick={(e) => { stop(e); onToggleFavorite(); }}
            aria-pressed={isFavorite}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-2xl border px-3 text-[11px] font-bold transition-all ${
              isFavorite ? 'border-gold bg-gold/10 text-gold-ink' : 'border-border bg-card text-text-muted hover:text-gold-ink'
            }`}
          >
            <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />
            {getLocalizedText('Save')}
          </button>
        ) : null}
        {onTogglePin ? (
          <button
            onClick={(e) => { stop(e); onTogglePin(); }}
            aria-pressed={isPinned}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-2xl border px-3 text-[11px] font-bold transition-all ${
              isPinned ? 'border-gold bg-gold/10 text-gold-ink' : 'border-border bg-card text-text-muted hover:text-gold-ink'
            }`}
          >
            <Pin size={14} fill={isPinned ? 'currentColor' : 'none'} />
            {getLocalizedText(
              isPinned ? 'In routine' : 'Add to routine'
            )}
          </button>
        ) : null}
        {onShare ? (
          <button
            onClick={(e) => { stop(e); onShare(); }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-2xl border border-border bg-card px-3 text-[11px] font-bold text-text-muted transition-all hover:text-gold-ink"
          >
            {shareStatus ? <Check size={14} className="text-gold-ink" /> : <Share2 size={14} />}
            {shareStatus || getLocalizedText('Share')}
          </button>
        ) : null}
        {/* Text size belongs where the text is. It was reachable only from
            Settings, four taps away and with the du'a no longer on screen to
            judge it against. */}
        {reading && onChangeReading ? (
          <button
            onClick={(e) => { stop(e); setSizePanelOpen((open) => !open); }}
            aria-expanded={sizePanelOpen}
            aria-label={getLocalizedText('Text size')}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-2xl border px-3 text-[11px] font-bold transition-all ${
              sizePanelOpen ? 'border-gold bg-gold/10 text-gold-ink' : 'border-border bg-card text-text-muted hover:text-gold-ink'
            }`}
          >
            <ALargeSmall size={16} />
          </button>
        ) : null}
      </div>

      {reading && onChangeReading && sizePanelOpen ? (
        <div className="border-b border-border bg-card/60 px-5 py-3 space-y-2" onClick={stop}>
          {([
            ['Arabic', 'arabicSize'],
            ['Translation', 'textSize'],
            ['Line spacing', 'leading']
          ] as const).map(([label, key]) => {
            const { min, max, step } = READING_LIMITS[key];
            const value = reading[key];
            const nudge = (by: number) => {
              // Rounded to the step so repeated taps on a fractional value do
              // not drift to 1.7000000000000002.
              const next = Math.min(max, Math.max(min, Math.round((value + by) / step) * step));
              onChangeReading({ [key]: Number(next.toFixed(2)) });
            };
            return (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-text-sub">{getLocalizedText(label)}</span>
                <span className="flex items-center gap-1">
                  <button
                    onClick={() => nudge(-step)}
                    disabled={value <= min}
                    aria-label={`${getLocalizedText(label)} −`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-bg text-text-main transition-all disabled:opacity-30 hover:border-gold/40"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-12 text-center text-xs font-bold tabular-nums text-gold-ink">
                    {key === 'leading' ? value.toFixed(1) : formatNumber(value, language)}
                  </span>
                  <button
                    onClick={() => nudge(step)}
                    disabled={value >= max}
                    aria-label={`${getLocalizedText(label)} +`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-bg text-text-main transition-all disabled:opacity-30 hover:border-gold/40"
                  >
                    <Plus size={14} />
                  </button>
                </span>
              </div>
            );
          })}
          <p className="pt-1 text-[10px] leading-relaxed text-text-muted">
            {getLocalizedText('This is the same size used everywhere in the app.')}
          </p>
        </div>
      ) : null}

      <motion.div
        className="flex-1 overflow-y-auto px-5 py-10"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        dragDirectionLock
        onDragEnd={handleDragEnd}
      >
        {/*
          This block used to be pointer-events-none, which meant none of the
          text could be selected or copied on the one screen built for reading.
          Taps still bubble up to the container, so tap-to-count is unaffected.
        */}
        <div className="mx-auto max-w-xl w-full space-y-8 select-text">
          {item.arabic ? (
            <div
              lang="ar"
              dir="rtl"
              className={`whitespace-pre-line arabic-text text-text-arabic text-right ${
                isShortArabic ? 'arabic-text--short' : ''
              }`}
              style={{ fontSize: 'calc(var(--arabic-size) * 1.2)' }}
            >
              {renderText(item.arabic)}
            </div>
          ) : null}

          {showTransliteration && !transliteration && transliterationHidden ? (
            <p className="prose-block text-xs text-text-muted">
              {getLocalizedText('A few du’as still have no pronunciation guide in this language.')}
            </p>
          ) : null}

          {showTransliteration && transliteration ? (
            <p
              /* The italic came off: a serif italic at reading length is
                 slower to read, and the colour already separates the
                 pronunciation from the meaning. */
              className="prose-block whitespace-pre-line text-green-ink font-medium"
              style={{ fontSize: 'var(--english-size)', lineHeight: 'var(--reading-leading)' }}
            >
              {renderText(transliteration)}
            </p>
          ) : null}

          {showTranslation && meaning ? (
            <div className="p-6 bg-card rounded-[2rem] border border-border">
              <div
                className="prose-block whitespace-pre-line text-text-main/90"
                style={{ fontSize: 'calc(var(--english-size) * 1.1)', lineHeight: 'var(--reading-leading)' }}
              >
                {renderText(meaning)}
              </div>
            </div>
          ) : null}

          {nameVerse ? (
            <div className="rounded-2xl border border-gold/15 bg-gold/5 p-5 space-y-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-gold-ink uppercase tracking-widest">
                <BookOpen size={11} />
                {getLocalizedText('In the Qur’an')}
              </p>
              <p
                lang="ar"
                dir="rtl"
                className="arabic-text text-text-arabic text-right"
                style={{ fontSize: 'calc(var(--arabic-size) * 0.85)' }}
              >
                {nameVerse.arabic.split(' ').map((word, i) => (
                  <React.Fragment key={i}>
                    {i > 0 ? ' ' : ''}
                    {nameSpan && i >= nameSpan[0] && i <= nameSpan[1] ? (
                      <span className="text-gold-ink font-bold">{word}</span>
                    ) : (
                      word
                    )}
                  </React.Fragment>
                ))}
              </p>
              {showTranslation ? (
                <p
                  className="prose-block text-text-sub"
                  style={{ fontSize: 'calc(var(--english-size) * 0.94)', lineHeight: 'var(--reading-leading)' }}
                >
                  {getLocalizedText(nameVerse.meaning)}
                </p>
              ) : null}
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                {getLocalizedText('Quran')} {formatDigits(item.ref ?? '', language)} ·{' '}
                {getLocalizedText(VERSE_TRANSLATORS)}
              </p>
            </div>
          ) : isName ? (
            <div className="rounded-2xl border border-gold/15 bg-gold/5 p-5">
              <p
                className="prose-block text-text-sub"
                style={{ fontSize: 'calc(var(--english-size) * 0.94)', lineHeight: 'var(--reading-leading)' }}
              >
                {getLocalizedText('This name is from the list narrated by at-Tirmidhi. No single verse is cited for it here.')}
              </p>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-text-muted">{citation}</p>
            </div>
          ) : benefit || citation ? (
            <div className="rounded-2xl border border-gold/15 bg-gold/5 p-5">
              {benefit ? (
                <>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-gold-ink uppercase tracking-widest">
                    <Sparkles size={11} />
                    {getLocalizedText('Benefit')}
                  </p>
                  {/* Was locked to text-sm, ignoring the reading size the user set. */}
                  <div
                    className="prose-block whitespace-pre-line text-text-sub"
                    style={{ fontSize: 'calc(var(--english-size) * 0.94)', lineHeight: 'var(--reading-leading)' }}
                  >
                    {renderText(benefit)}
                  </div>
                </>
              ) : null}
              {citation ? (
                <p
                  className={`text-[10px] font-bold uppercase tracking-widest text-text-muted ${benefit ? 'mt-3' : ''}`}
                >
                  {citation}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </motion.div>

      <div className="p-5 bg-card border-t border-border space-y-6 pb-safe">
        {/* With no goal there is no progress to show, so the tally stays quiet
            rather than dominating a reading screen. */}
        {target > 0 ? (
          <div className="max-w-xl mx-auto space-y-4" onClick={stop}>
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-3">
                <span className={`text-4xl font-bold tabular-nums ${isDone ? 'text-gold-ink' : 'text-text-main'}`}>
                  {formatNumber(count, language)}
                </span>
                <span className="text-lg text-text-muted font-bold">/ {formatNumber(target, language)}</span>
              </div>
              <button
                onClick={(e) => { stop(e); onReset(); }}
                className="p-2 text-text-muted hover:text-gold-ink transition-colors"
                aria-label={getLocalizedText('Reset count')}
              >
                <RotateCcw size={20} />
              </button>
            </div>
            <ProgressBar progress={progress} isDone={isDone} height={12} />
          </div>
        ) : count > 0 ? (
          <div className="max-w-xl mx-auto flex items-center justify-between" onClick={stop}>
            <span className="text-sm font-bold text-text-sub tabular-nums">
              {getLocalizedText('Counted')} {formatNumber(count, language)}
            </span>
            <button
              onClick={(e) => { stop(e); onReset(); }}
              className="p-2 text-text-muted hover:text-gold-ink transition-colors"
              aria-label={getLocalizedText('Reset count')}
            >
              <RotateCcw size={18} />
            </button>
          </div>
        ) : null}
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button
            onClick={(e) => { stop(e); onPrev?.(); }}
            disabled={!hasPrev}
            className="w-16 h-16 bg-bg rounded-3xl border border-border flex items-center justify-center text-text-main active:scale-95 transition-all disabled:opacity-30"
            aria-label={getLocalizedText('Previous dhikr')}
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={(e) => { stop(e); onIncrement(); }}
            className="flex-1 h-16 bg-gold rounded-3xl flex items-center justify-center text-on-gold active:scale-95 transition-all shadow-lg"
          >
            <span className="text-xl font-bold uppercase tracking-[0.18em]">
              {getLocalizedText('Count')}
            </span>
          </button>
          <button
            onClick={(e) => { stop(e); onNext?.(); }}
            disabled={!hasNext}
            className="w-16 h-16 bg-bg rounded-3xl border border-border flex items-center justify-center text-text-main active:scale-95 transition-all disabled:opacity-30"
            aria-label={getLocalizedText('Next dhikr')}
          >
            <ChevronRight size={28} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default FocusModeOverlay;
