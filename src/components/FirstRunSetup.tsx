import React, { useState } from 'react';
import { Check, Volume2, Vibrate, Palette, SkipForward } from 'lucide-react';
import { Language, LocalizedText, THEMES } from '../constants';
import { LANGUAGES, LANGUAGE_CODES } from '../locales';
import { ROUTINE_SCOPES, ROUTINE_SCOPE_LABELS, type RoutineScope } from '../data/categories';

interface FirstRunSetupProps {
  getLocalizedText: (text: LocalizedText | string | undefined) => string;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  isSoundOn: boolean;
  setIsSoundOn: (on: boolean) => void;
  isHapticOn: boolean;
  setIsHapticOn: (on: boolean) => void;
  autoAdvance: boolean;
  routineScope: RoutineScope;
  setRoutineScope: (scope: RoutineScope) => void;
  setAutoAdvance: (on: boolean) => void;
  onDone: () => void;
}

/** Only the choices worth making before the first count. */
const THEME_CHOICES = ['system', 'light', 'emerald', 'midnight'];

/**
 * One screen, shown once, on a device that has never opened the app.
 *
 * Language comes first so everything under it is readable in the language just
 * chosen — the picker re-renders the rest of the screen live. Everything is
 * optional: Skip is always visible and simply keeps the defaults, and every
 * choice here stays changeable in Settings afterwards.
 *
 * Nothing is asked that the app does not need. No name, no location, no
 * account — there is nowhere to send any of it.
 */
const FirstRunSetup: React.FC<FirstRunSetupProps> = ({
  getLocalizedText,
  language,
  onLanguageChange,
  theme,
  onThemeChange,
  isSoundOn,
  setIsSoundOn,
  isHapticOn,
  setIsHapticOn,
  autoAdvance,
  routineScope,
  setRoutineScope,
  setAutoAdvance,
  onDone
}) => {
  const [busy, setBusy] = useState(false);
  const finish = () => {
    if (busy) return;
    setBusy(true);
    onDone();
  };

  const row = 'rounded-2xl border border-border bg-bg/50 p-4';
  const chip = (active: boolean) =>
    `flex min-h-11 items-center justify-center rounded-xl px-4 text-xs font-bold transition-all border ${
      active ? 'bg-gold border-gold text-on-gold' : 'border-border bg-bg/40 text-text-sub hover:border-gold/40'
    }`;

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-bg pt-safe">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-5 py-10">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-ink">
            {getLocalizedText('Welcome')}
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight text-text-main">
            {getLocalizedText('Set up in a few taps')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-text-sub">
            {getLocalizedText('You can change any of this later in Settings.')}
          </p>

          <div className="mt-6 space-y-3">
            {/* First, so the rest of this screen is readable in the language
                the person actually reads. */}
            <div className={row}>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-text-sub">
                {getLocalizedText('Language')}
              </p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_CODES.map((code) => (
                  <button
                    key={code}
                    lang={LANGUAGES[code].code}
                    onClick={() => onLanguageChange(code)}
                    aria-pressed={language === code}
                    className={chip(language === code)}
                  >
                    {LANGUAGES[code].nativeLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className={row}>
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-text-sub">
                <Palette size={11} />
                {getLocalizedText('Appearance')}
              </p>
              <div className="flex flex-wrap gap-2">
                {THEME_CHOICES.map((id) => {
                  const preset = THEMES.find((t) => t.id === id);
                  if (!preset) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => onThemeChange(id)}
                      aria-pressed={theme === id}
                      className={chip(theme === id)}
                    >
                      {getLocalizedText(preset.name)}
                    </button>
                  );
                })}
              </div>
            </div>


            {/* One question that shapes the home screen: what the routine
                covers, which is also what Play reads through. Core and
                Protection together by default — they are one sitting. */}
            <div className={`${row} w-full`}>
              <p className="mb-2 text-sm font-bold text-text-main">
                {getLocalizedText('What should your home screen carry?')}
              </p>
              <div className="flex flex-wrap gap-2">
                {ROUTINE_SCOPES.map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setRoutineScope(scope)}
                    aria-pressed={routineScope === scope}
                    className={chip(routineScope === scope)}
                  >
                    {getLocalizedText(ROUTINE_SCOPE_LABELS[scope].label)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                {getLocalizedText(ROUTINE_SCOPE_LABELS[routineScope].note)}
              </p>
            </div>

            <button onClick={() => setIsSoundOn(!isSoundOn)} className={`${row} flex w-full items-center gap-3 text-start`}>
              <Volume2 size={16} className="shrink-0 text-gold-ink" />
              <span className="min-w-0 flex-1 text-sm font-bold text-text-main">{getLocalizedText('Sound')}</span>
              <span className={chip(isSoundOn)}>{getLocalizedText(isSoundOn ? 'On' : 'Off')}</span>
            </button>

            <button onClick={() => setIsHapticOn(!isHapticOn)} className={`${row} flex w-full items-center gap-3 text-start`}>
              <Vibrate size={16} className="shrink-0 text-gold-ink" />
              <span className="min-w-0 flex-1 text-sm font-bold text-text-main">{getLocalizedText('Haptic')}</span>
              <span className={chip(isHapticOn)}>{getLocalizedText(isHapticOn ? 'On' : 'Off')}</span>
            </button>
            {/* Off by default, and offered here rather than buried: whether a
                routine plays through is a choice about how you read, which is
                what this screen is for. */}
            <button onClick={() => setAutoAdvance(!autoAdvance)} className={`${row} flex w-full items-center gap-3 text-start`}>
              <SkipForward size={16} className="shrink-0 text-gold-ink" />
              <span className="min-w-0 flex-1 text-sm font-bold text-text-main">
                {getLocalizedText('Continue to the next')}
              </span>
              <span className={chip(autoAdvance)}>{getLocalizedText(autoAdvance ? 'On' : 'Off')}</span>
            </button>
          </div>

          <button
            onClick={finish}
            className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold text-sm font-bold text-on-gold transition-all active:scale-[0.99]"
          >
            <Check size={16} />
            {getLocalizedText('Start')}
          </button>
          <button
            onClick={finish}
            className="mt-2 min-h-11 w-full text-xs font-bold text-text-muted transition-colors hover:text-text-sub"
          >
            {getLocalizedText('Skip')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirstRunSetup;
