import React from 'react';
import { Palette, HeartHandshake, Share2, Star, ShieldCheck, ChevronRight } from 'lucide-react';
import { APP_NAME, DhikrItem, Language, LocalizedText } from '../constants';
import { LANGUAGES, LANGUAGE_CODES, languageInfo } from '../locales';
import { hijriLabelParts } from '../data/rightNow';
import { formatDigits } from '../i18n';
import RecordPanel from '../components/RecordPanel';
import { ROUTINE_SCOPES, ROUTINE_SCOPE_LABELS, type RoutineScope } from '../data/categories';

interface MoreScreenProps {
  getLocalizedText: (text: LocalizedText | string | undefined) => string;
  theme: string;
  onThemeChange: (theme: string) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  isSoundOn: boolean;
  setIsSoundOn: (on: boolean) => void;
  isHapticOn: boolean;
  setIsHapticOn: (on: boolean) => void;
  autoAdvance: boolean;
  setAutoAdvance: (on: boolean) => void;
  /** What the routine covers: Home's sections, and what Play reads through. */
  routineScope: RoutineScope;
  setRoutineScope: (scope: RoutineScope) => void;
  /** Whether a history is kept at all. Off hides the Record entirely. */
  keepRecord: boolean;
  setKeepRecord: (on: boolean) => void;
  /** Reopens the first-run screen, which otherwise can never be seen again. */
  onShowSetup?: () => void;
  supportEmail: string;
  storeUrl: string;
  arabicFontSize: number;
  setArabicFontSize: (size: number) => void;
  englishFontSize: number;
  setEnglishFontSize: (size: number) => void;
  arabicLeading: number;
  setArabicLeading: (value: number) => void;
  /** Line spacing for translations, transliterations and benefits. */
  readingLeading: number;
  setReadingLeading: (value: number) => void;
  showTransliteration: boolean;
  setShowTransliteration: (on: boolean) => void;
  showTranslation: boolean;
  setShowTranslation: (on: boolean) => void;
  hijriOffset: number;
  setHijriOffset: (days: number) => void;
  onRateClick: () => void;
  onBackupClick: () => void;
  dayCounts: Record<string, Record<string, number>>;
  lifetimeCounts: Record<string, number>;
  itemsById: Map<string, DhikrItem>;
}

const MoreScreen: React.FC<MoreScreenProps> = ({
  getLocalizedText,
  theme,
  onThemeChange,
  language,
  onLanguageChange,
  isSoundOn,
  setIsSoundOn,
  isHapticOn,
  setIsHapticOn,
  autoAdvance,
  setAutoAdvance,
  routineScope,
  setRoutineScope,
  keepRecord,
  setKeepRecord,
  onShowSetup,
  supportEmail,
  storeUrl,
  arabicFontSize,
  setArabicFontSize,
  englishFontSize,
  setEnglishFontSize,
  arabicLeading,
  setArabicLeading,
  readingLeading,
  setReadingLeading,
  showTransliteration,
  setShowTransliteration,
  showTranslation,
  setShowTranslation,
  hijriOffset,
  setHijriOffset,
  onRateClick,
  onBackupClick,
  dayCounts,
  lifetimeCounts,
  itemsById
}) => {
  const hasFullTransliteration = languageInfo(language).hasTransliteration;
  // Composed here rather than by Intl: WebKit prints the month name and era of
  // a Hijri date from the Gregorian tables ("February 27, 1448 BC" on iOS).
  const hijriToday = hijriLabelParts(new Date(), hijriOffset);
  const sectionClass = 'bg-card rounded-3xl border border-border overflow-hidden shadow-xl';
  const cardClass = 'bg-bg/50 rounded-2xl border border-border';

  // The off state used to use the border colour, which in the Light theme left
  // a white knob on a near-white track — the toggle looked empty.
  const renderToggle = (enabled: boolean, onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      // The switch is 24px tall; the padding gives it a 44px hit area without
      // changing how it looks.
      className="relative -my-2.5 flex h-11 w-12 items-center"
    >
      <span
        className={`relative block h-6 w-12 rounded-full transition-all ${enabled ? 'bg-gold' : 'bg-text-muted/50'}`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${enabled ? 'end-1' : 'start-1'}`}
        />
      </span>
    </button>
  );

  const appearancePresets = [
    { id: 'system', label: 'System', swatch: '#333333' },
    { id: 'light', label: 'Light', swatch: '#F8F9FA' },
    { id: 'dark', label: 'Dark', swatch: '#121212' },
    { id: 'midnight', label: 'Midnight', swatch: '#0D1117' },
    { id: 'emerald', label: 'Emerald', swatch: '#0B1410' },
    { id: 'royal', label: 'Royal', swatch: '#101320' },
    { id: 'maroon', label: 'Maroon', swatch: '#160F12' },
    { id: 'sand', label: 'Sand', swatch: '#18140F' }
  ];

  const handleShare = async () => {
    const shareText = getLocalizedText('If this app benefits you, please share it with family and friends.');
    try {
      if (navigator.share) {
        // The full store name, not the short in-app one: this title sits beside
        // the link in someone else's chat, and it has to match what they land on.
        await navigator.share({ title: APP_NAME, text: shareText, url: storeUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(storeUrl);
        alert(getLocalizedText('App link copied.'));
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 px-2 sm:px-4 pt-6 pb-12">
      <div className={sectionClass}>
        <div className="p-6 md:p-8">
          <p className="text-[10px] font-bold text-gold-ink uppercase tracking-[0.25em] mb-2">
            {getLocalizedText('Welcome')}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-text-main leading-tight">
            {getLocalizedText('Stay consistent with remembrance')}
          </h2>
          <p className="text-sm text-text-sub mt-3 max-w-2xl leading-relaxed">
            {getLocalizedText('Shape the app around a calm daily worship routine.')}
          </p>
          {/* The hadith and the reflection moved to Home: they belong to the
              day, not to a settings screen, and this one was already the
              longest page in the app. */}
        </div>
      </div>

      <div className={sectionClass}>
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-2xl flex items-center justify-center text-gold-ink">
            <Palette size={20} />
          </div>
          <h2 className="text-lg font-bold text-text-main">{getLocalizedText('Appearance & App')}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-text-sub uppercase tracking-[0.22em] mb-3">
              {getLocalizedText('Appearance')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {appearancePresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onThemeChange(preset.id)}
                  aria-pressed={theme === preset.id}
                  className={`rounded-2xl border p-3 flex items-center gap-3 ${
                    theme === preset.id ? 'border-gold bg-gold/10' : 'border-border bg-bg/50'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full border border-border/40" style={{ backgroundColor: preset.swatch }} />
                  <span className="text-xs font-bold text-text-main">{getLocalizedText(preset.label)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`${cardClass} p-4 flex items-center justify-between`}>
            <span className="text-sm font-bold text-text-main">{getLocalizedText('Language')}</span>
            {/* Driven by the registry, so a new locale file appears here
                without this markup being touched. */}
            <div className="flex rounded-xl bg-bg/80 p-1">
              {LANGUAGE_CODES.map((code) => (
                <button
                  key={code}
                  onClick={() => onLanguageChange(code)}
                  aria-pressed={language === code}
                  lang={LANGUAGES[code].code}
                  className={`flex min-h-11 items-center rounded-lg px-4 text-[11px] font-bold ${
                    language === code ? 'bg-gold text-on-gold' : 'text-text-sub'
                  }`}
                >
                  {LANGUAGES[code].nativeLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Moon sighting differs by country, and often by a day from any
              calculated calendar. Rather than guess where someone is — which
              would cost privacy and still be a guess — show what the app
              currently believes and let them correct it. */}
          <div className={`${cardClass} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-text-main">
                  {getLocalizedText('Islamic date')}
                </span>
                <span className="mt-0.5 block text-xs text-text-sub">
                  {hijriToday
                    ? `${formatDigits(String(hijriToday.day), language)} ${getLocalizedText(hijriToday.month)} ${formatDigits(String(hijriToday.year), language)} ${getLocalizedText(hijriToday.era)}`
                    : getLocalizedText('This device cannot calculate the Hijri date.')}
                </span>
              </span>
              <div className="flex shrink-0 gap-1">
                {[-1, 0, 1].map((delta) => (
                  <button
                    key={delta}
                    onClick={() => setHijriOffset(delta)}
                    aria-pressed={hijriOffset === delta}
                    className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl border text-xs font-bold ${
                      hijriOffset === delta
                        ? 'border-gold bg-gold text-on-gold'
                        : 'border-border bg-bg/40 text-text-sub'
                    }`}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              {getLocalizedText('If your local date differs, adjust it here. Nothing is sent anywhere.')}
            </p>
          </div>

          <div className={`${cardClass} p-4 flex items-center justify-between`}>
            <span className="text-sm font-bold text-text-main">{getLocalizedText('Sound')}</span>
            {renderToggle(isSoundOn, () => setIsSoundOn(!isSoundOn), getLocalizedText('Sound'))}
          </div>
          <div className={`${cardClass} p-4 flex items-center justify-between`}>
            <span className="text-sm font-bold text-text-main">{getLocalizedText('Haptic')}</span>
            {renderToggle(isHapticOn, () => setIsHapticOn(!isHapticOn), getLocalizedText('Haptic'))}
          </div>
          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-text-main">
                {getLocalizedText('Continue to the next')}
              </span>
              {renderToggle(
                autoAdvance,
                () => setAutoAdvance(!autoAdvance),
                getLocalizedText('Continue to the next')
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              {getLocalizedText(
                'In the reader, move on to the next du’a once you finish the count — so a routine plays through instead of stopping after each one.'
              )}
            </p>
          </div>

          {/* The same question the welcome screen asks, so it can be changed
              once the app has been used for a while. */}
          <div className={`${cardClass} p-4`}>
            <p className="mb-2 text-sm font-bold text-text-main">
              {getLocalizedText('What should your home screen carry?')}
            </p>
            <div className="flex flex-wrap gap-2">
              {ROUTINE_SCOPES.map((scope) => (
                <button
                  key={scope}
                  onClick={() => setRoutineScope(scope)}
                  aria-pressed={routineScope === scope}
                  className={`flex min-h-11 items-center rounded-xl border px-3 text-xs font-bold transition-all ${
                    routineScope === scope
                      ? 'border-gold bg-gold text-on-gold'
                      : 'border-border bg-bg/40 text-text-sub hover:border-gold/40'
                  }`}
                >
                  {getLocalizedText(ROUTINE_SCOPE_LABELS[scope].label)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              {getLocalizedText(ROUTINE_SCOPE_LABELS[routineScope].note)}
            </p>
          </div>

          {/* This switch lives here rather than inside the Record, which it
              hides: a control that disappears along with the thing it controls
              leaves no way back. */}
          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-text-main">
                {getLocalizedText('Keep a record')}
              </span>
              {renderToggle(
                keepRecord,
                () => setKeepRecord(!keepRecord),
                getLocalizedText('Keep a record')
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              {getLocalizedText(
                'Off means nothing new is stored. Today’s counters still work, and what was already recorded stays on this device.'
              )}
            </p>
          </div>

          {/* The setup screen is gated on a profile having no stored keys, so
              once the app has been used it can never be opened again — not even
              to look at. This opens it on purpose without weakening that gate. */}
          {onShowSetup ? (
            <button
              onClick={onShowSetup}
              className={`${cardClass} flex min-h-14 w-full items-center justify-between p-4 text-start transition-all hover:border-gold/40`}
            >
              <span className="text-sm font-bold text-text-main">
                {getLocalizedText('Show the setup screen')}
              </span>
              <ChevronRight size={16} className="shrink-0 text-text-muted" />
            </button>
          ) : null}

          <div className="pt-4 space-y-6">
            <p className="text-[10px] font-bold text-text-sub uppercase tracking-[0.22em] mb-3">
              {getLocalizedText('Reading')}
            </p>

            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text-main">
                  {getLocalizedText('Show transliteration')}
                </span>
                {renderToggle(
                  showTransliteration,
                  () => setShowTransliteration(!showTransliteration),
                  getLocalizedText('Show transliteration')
                )}
              </div>
              {/* Most transliterations exist only in Latin script, so the toggle
                  looks broken in Bangla unless we say why. */}
              {!hasFullTransliteration ? (
                <p className="mt-2 text-xs leading-relaxed text-text-muted">
                  {getLocalizedText('A few du’as still have no pronunciation guide in this language.')}
                </p>
              ) : null}
            </div>
            <div className={`${cardClass} p-4 flex items-center justify-between`}>
              <span className="text-sm font-bold text-text-main">
                {getLocalizedText('Show translation')}
              </span>
              {renderToggle(
                showTranslation,
                () => setShowTranslation(!showTranslation),
                getLocalizedText('Show translation')
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="arabic-size" className="text-sm font-bold text-text-main">
                    {getLocalizedText('Arabic Font Size')}
                  </label>
                  <span className="text-xs font-mono text-gold-ink">{arabicFontSize}px</span>
                </div>
                <input
                  id="arabic-size"
                  type="range"
                  min="20"
                  max="48"
                  value={arabicFontSize}
                  onChange={(e) => setArabicFontSize(parseInt(e.target.value, 10))}
                  className="range-slider"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="english-size" className="text-sm font-bold text-text-main">
                    {getLocalizedText('English/Bengali Font Size')}
                  </label>
                  <span className="text-xs font-mono text-gold-ink">{englishFontSize}px</span>
                </div>
                <input
                  id="english-size"
                  type="range"
                  min="12"
                  max="24"
                  value={englishFontSize}
                  onChange={(e) => setEnglishFontSize(parseInt(e.target.value, 10))}
                  className="range-slider"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="arabic-leading" className="text-sm font-bold text-text-main">
                    {getLocalizedText('Arabic Line Spacing')}
                  </label>
                  <span className="text-xs font-mono text-gold-ink">{arabicLeading.toFixed(1)}</span>
                </div>
                <input
                  id="arabic-leading"
                  type="range"
                  min="1.6"
                  max="3"
                  step="0.1"
                  value={arabicLeading}
                  onChange={(e) => setArabicLeading(parseFloat(e.target.value))}
                  className="range-slider"
                />
              </div>

              {/* The translation had no spacing control at all — it was locked
                  to 1.625, which reads tight for a du'a said aloud. */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="reading-leading" className="text-sm font-bold text-text-main">
                    {getLocalizedText('Text Line Spacing')}
                  </label>
                  <span className="text-xs font-mono text-gold-ink">{readingLeading.toFixed(1)}</span>
                </div>
                <input
                  id="reading-leading"
                  type="range"
                  min="1.4"
                  max="2.4"
                  step="0.1"
                  value={readingLeading}
                  onChange={(e) => setReadingLeading(parseFloat(e.target.value))}
                  className="range-slider"
                />
              </div>
            </div>

            <div className="p-4 bg-bg/50 rounded-2xl border border-border/50 space-y-3">
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">
                {getLocalizedText('Preview')}
              </p>
              <p
                lang="ar"
                dir="rtl"
                className="arabic-text arabic-text--short text-right text-text-arabic"
                style={{ fontSize: `${arabicFontSize}px`, lineHeight: arabicLeading }}
              >
                سُبْحَانَ اللَّهِ وَبِحَمْدِهِ
              </p>
              {/* The preview has to obey the spacing slider too, or it stops
                  being a preview. */}
              <p className="text-text-main" style={{ fontSize: `${englishFontSize}px`, lineHeight: readingLeading }}>
                {getLocalizedText('Glory be to Allah and praise is to Him.')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {keepRecord ? (
        <RecordPanel
          getLocalizedText={getLocalizedText}
          language={language}
          dayCounts={dayCounts}
          lifetimeCounts={lifetimeCounts}
          itemsById={itemsById}
        />
      ) : null}

      <div className={sectionClass}>
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-2xl flex items-center justify-center text-gold-ink">
            <ShieldCheck size={20} />
          </div>
          <h2 className="text-lg font-bold text-text-main">{getLocalizedText('Your Data')}</h2>
        </div>
        <div className="p-6">
          <p className="text-sm leading-relaxed text-text-sub mb-4">
            {getLocalizedText('Everything is stored on this device only. Keep a backup so a reinstall or a new phone does not lose your history.')}
          </p>
          <button
            onClick={onBackupClick}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-bg px-4 py-3.5 text-sm font-bold text-text-main transition-all hover:border-gold/40 hover:text-gold-ink"
          >
            <ShieldCheck size={16} />
            {getLocalizedText('Backup & Restore')}
          </button>
        </div>
      </div>

      <div className={sectionClass}>
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-2xl flex items-center justify-center text-gold-ink">
            <HeartHandshake size={20} />
          </div>
          <h2 className="text-lg font-bold text-text-main">
            {getLocalizedText('About the App & Support')}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className={`${cardClass} p-4 space-y-4`}>
            <p className="text-sm leading-relaxed text-text-main">
              {getLocalizedText('This app was built with a single, heartfelt purpose: to make the remembrance of Allah a seamless and beautiful part of your daily life. While we strive to organize adhkar accurately using trusted sources, please verify detailed religious matters with authentic source books and trusted scholars when needed.')}
            </p>
            <p className="text-sm leading-relaxed text-text-main">
              <span className="font-bold text-gold-ink">{getLocalizedText('Sources:')}</span>{' '}
              {getLocalizedText('Verses under the names: Arabic from Tanzil; English, Sahih International; Bangla, Dr. Abu Bakr Muhammad Zakaria (King Fahd Complex).')}
            </p>
            <p className="text-sm leading-relaxed text-text-main">
              <span className="font-bold text-gold-ink">{getLocalizedText('Your Privacy:')}</span>{' '}
              {getLocalizedText('All your dhikr counts and settings are stored locally on your own device. We do not track or store your personal worship data on our servers.')}
            </p>
            <p className="text-sm leading-relaxed text-text-main">
              <span className="font-bold text-gold-ink">{getLocalizedText('A Humble Request:')}</span>{' '}
              {getLocalizedText('If you find peace and benefit in this app, we humbly request you to keep us at Qubeq, along with everyone who contributed their time and sincere advice, in your precious Duas.')}
            </p>
            <p className="text-sm leading-relaxed text-text-main">
              <span className="font-bold text-gold-ink">{getLocalizedText('Sadaqah Jariyah:')}</span>{' '}
              {getLocalizedText('If you love this app, please share it with family and friends. The Prophet ﷺ said: "Whoever guides someone to goodness will have a reward like one who did it."')}
            </p>
            <p className="text-sm leading-relaxed text-text-main">
              <span className="font-bold text-gold-ink">{getLocalizedText('Contact Us:')}</span>{' '}
              {getLocalizedText('For questions, feature suggestions, or to report any errors, please reach out at:')}{' '}
              <a href={`mailto:${supportEmail}`} className="font-bold text-gold-ink underline underline-offset-2">
                {supportEmail}
              </a>
            </p>
            <p className="text-sm leading-relaxed text-text-main">
              <a
                href={`${import.meta.env.BASE_URL}privacy.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-gold-ink underline underline-offset-2"
              >
                {getLocalizedText('Privacy Policy')}
              </a>
              {' · '}
              <span className="text-text-muted">
                {getLocalizedText('Free software, GPL-3.0')}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleShare}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-bold text-text-main transition-all hover:border-gold/40 hover:text-gold-ink"
              >
                <Share2 size={16} />
                {getLocalizedText('Share App')}
              </button>
              <button
                onClick={onRateClick}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-bold text-text-main transition-all hover:border-gold/40 hover:text-gold-ink"
              >
                <Star size={16} />
                {getLocalizedText('Rate Us 5 Stars')}
              </button>
            </div>
            <p className="text-xs text-text-muted">{getLocalizedText('Version')} {formatDigits(__APP_VERSION__, language)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoreScreen;
