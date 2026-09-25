import { THEMES } from './constants';

export interface Palette {
  bg: string;
  /**
   * Gold used as *text* on this theme's surfaces. The brand gold is a mid-tone,
   * so on a white card it only reaches 3.25:1 — under the 4.5:1 needed for
   * body text. Dark themes can use the brand gold directly.
   */
  goldInk: string;
  /**
   * Text and icons sitting *on* a gold fill. `text-bg` was used for this, which
   * works on a dark theme and puts near-white on goldenrod at 3.09:1 on a light
   * one.
   */
  onGold: string;
  card: string;
  cardLight: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  textArabic: string;
  greenPrimary: string;
  greenLight: string;
  /**
   * Green used as *text* — the transliteration, which is a paragraph, not a
   * label. Same problem as `goldInk`: the light theme's green is a mid-tone at
   * 2.3:1 on its near-white background. Empty means the theme's greenLight
   * already reads fine, which is true on every dark one.
   */
  greenInk: string;
}

export const LIGHT_PALETTE: Palette = {
  bg: '#F8F9FA',
  goldInk: '#8C6508',
  onGold: '#241900',
  card: '#FFFFFF',
  cardLight: '#F1F3F5',
  border: '#E9ECEF',
  text: '#212529',
  textSub: '#495057',
  textMuted: '#6C757D',
  textArabic: '#182018',
  greenPrimary: '#2F855A',
  greenLight: '#48BB78',
  greenInk: '#276749'
};

export const DARK_PALETTES: Record<string, Palette> = {
  dark: { goldInk: '', onGold: '#121212', bg: '#121212', card: '#1E1E1E', cardLight: '#252525', border: '#333333', text: '#FFFFFF', textSub: '#A0A0A0', textMuted: '#8A8A8A', textArabic: '#F8F2E0', greenPrimary: '#388E3C', greenLight: '#4CAF50', greenInk: '' },
  emerald: { goldInk: '', onGold: '#0B1410', bg: '#0B1410', card: '#141F19', cardLight: '#1A2822', border: '#243328', text: '#E8F0EA', textSub: '#A7B5AE', textMuted: '#7B8D85', textArabic: '#F8F2E0', greenPrimary: '#356F2D', greenLight: '#58A55C', greenInk: '' },
  midnight: { goldInk: '', onGold: '#0D1117', bg: '#0D1117', card: '#161B22', cardLight: '#1D2430', border: '#2A2F36', text: '#E6EDF3', textSub: '#A8B3C1', textMuted: '#7F8B99', textArabic: '#F6F8FB', greenPrimary: '#2F7A66', greenLight: '#66BFA6', greenInk: '' },
  royal: { goldInk: '', onGold: '#101320', bg: '#101320', card: '#1A2033', cardLight: '#242C45', border: '#2B3552', text: '#EEF2FF', textSub: '#B5BED6', textMuted: '#8892AB', textArabic: '#F8F9FF', greenPrimary: '#3F5DAA', greenLight: '#7FA1FF', greenInk: '' },
  maroon: { goldInk: '', onGold: '#160F12', bg: '#160F12', card: '#24171C', cardLight: '#2F1E24', border: '#3A252D', text: '#F7EDEE', textSub: '#CDB6BA', textMuted: '#A0868C', textArabic: '#FFF5F5', greenPrimary: '#8A3D4A', greenLight: '#D47A88', greenInk: '' },
  sand: { goldInk: '', onGold: '#18140F', bg: '#18140F', card: '#241E17', cardLight: '#30271F', border: '#3A3126', text: '#F6F1E8', textSub: '#D0C2AE', textMuted: '#A99679', textArabic: '#FFF8ED', greenPrimary: '#7A6541', greenLight: '#C9A96B', greenInk: '' }
};

export const prefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Turns the stored theme id (which may be "system") into a concrete theme id. */
export const resolveThemeId = (themeId: string): string =>
  themeId === 'system' ? (prefersDark() ? 'dark' : 'light') : themeId;

export const getPalette = (resolvedThemeId: string): Palette =>
  DARK_PALETTES[resolvedThemeId] ?? LIGHT_PALETTE;

export const isDarkTheme = (resolvedThemeId: string): boolean => resolvedThemeId !== 'light';

interface ApplyThemeOptions {
  arabicFontSize: number;
  englishFontSize: number;
  arabicLeading: number;
  readingLeading: number;
}

/**
 * Writes the resolved palette to CSS custom properties on <html>. This is the
 * single place theme colours are applied — the "system" media-query listener
 * calls straight back into it rather than keeping its own copy of the palettes.
 */
export const applyTheme = (
  themeId: string,
  { arabicFontSize, englishFontSize, arabicLeading, readingLeading }: ApplyThemeOptions
): boolean => {
  if (typeof document === 'undefined') return false;

  const resolved = resolveThemeId(themeId);
  const palette = getPalette(resolved);
  const dark = isDarkTheme(resolved);
  const theme = THEMES.find((t) => t.id === resolved) ?? THEMES[0];
  const root = document.documentElement;

  root.style.setProperty('--bg', palette.bg);
  root.style.setProperty('--card', palette.card);
  root.style.setProperty('--card-light', palette.cardLight);
  root.style.setProperty('--gold', theme.gold);
  // Empty means "the brand gold reads fine here" — true on every dark theme.
  root.style.setProperty('--gold-ink', palette.goldInk || theme.gold);
  root.style.setProperty('--on-gold', palette.onGold);
  root.style.setProperty('--gold-dim', dark ? `${theme.gold}55` : `${theme.gold}33`);
  root.style.setProperty('--border', palette.border);
  root.style.setProperty('--text-main', palette.text);
  root.style.setProperty('--text-sub', palette.textSub);
  root.style.setProperty('--text-muted', palette.textMuted);
  root.style.setProperty('--text-arabic', palette.textArabic);
  root.style.setProperty('--green-primary', palette.greenPrimary);
  root.style.setProperty('--green-light', palette.greenLight);
  root.style.setProperty('--green-ink', palette.greenInk || palette.greenLight);
  root.style.setProperty('--arabic-size', `${arabicFontSize}px`);
  root.style.setProperty('--english-size', `${englishFontSize}px`);
  root.style.setProperty('--arabic-leading', String(arabicLeading));
  // Translations, transliterations and benefits were all locked to Tailwind's
  // `leading-relaxed` (1.625), which is a sensible default for a paragraph and
  // too tight for a du'a someone is reading aloud.
  root.style.setProperty('--reading-leading', String(readingLeading));
  root.style.colorScheme = dark ? 'dark' : 'light';
  // iOS prints the status bar in white over an installed app, whatever the
  // theme, so the strip behind it stays dark on the light theme.
  root.style.setProperty('--status-bar', dark ? palette.card : '#0B1410');

  // Keep the browser/OS chrome (status bar, address bar) in sync with the theme.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', palette.bg);

  return dark;
};
