export type { Language } from './locales';
import type { Language } from './locales';

/**
 * What the app calls itself, in one place.
 *
 * It used to call itself three different things: the manifest and the link
 * preview said "Tasbeeh — Dhikr & Du'a Tracker", the header and the share sheet
 * said "Dhikr Tracker", and the Play listing a third variant — so sharing the
 * app handed someone one name and landed them on another.
 *
 * `APP_NAME` must match the Play Store title, because it is what a recipient
 * sees next to the link. `APP_SHORT_NAME` is for inside the app, where the
 * reader already knows where they are; it is a UI string, so it is translated.
 * It is the home-screen name too, which is why it is "Tasbeeh" and not a
 * shortened form of something else.
 */
export const APP_NAME = "Tasbeeh — Dhikr & Du'a Tracker";
export const APP_SHORT_NAME = 'Tasbeeh';

/**
 * Either a UI string keyed by its English text, or per-language content stored
 * beside the item. Keys come from the language registry, so a new language
 * widens this type without any call site changing.
 */
export type LocalizedText = string | Partial<Record<Language, string>>;

export interface DhikrItem {
  step: number;
  id: string;

  title: LocalizedText;
  arabic: string;

  trn?: LocalizedText;
  meaning?: LocalizedText;
  benefit?: LocalizedText;

  target: number;

  cat?: string[];
  tags?: string[];
  /**
   * Moments this item belongs to — 'morning', 'friday', 'ramadan', 'lastten',
   * 'eid', 'arafah'. Drives the "right now" strip. Separate from `tags`, which
   * are free text feeding search and would make the strip unpredictable.
   */
  when?: string[];
  badge?: LocalizedText | string;
  sectionId?: string;
  source?: string;
  ref?: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  bg: string;
  card: string;
  gold: string;
  border: string;
  text: string;
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'system',
    name: 'System',
    bg: '#0B1410', // Fallback
    card: '#141F19',
    gold: '#D4AF37',
    border: '#243328',
    text: '#E8F0EA'
  },
  {
    id: 'light',
    name: 'Light',
    bg: '#F8F9FA',
    card: '#FFFFFF',
    gold: '#B8860B',
    border: '#E9ECEF',
    text: '#212529'
  },
  {
    id: 'dark',
    name: 'Dark',
    bg: '#121212',
    card: '#1E1E1E',
    gold: '#D4AF37',
    border: '#333333',
    text: '#FFFFFF'
  },
  {
    id: 'midnight',
    name: 'Midnight',
    bg: '#0D1117',
    card: '#161B22',
    gold: '#D4AF37',
    border: '#2A2F36',
    text: '#E6EDF3'
  },
  {
    id: 'emerald',
    name: 'Emerald',
    bg: '#0B1410',
    card: '#141F19',
    gold: '#D4AF37',
    border: '#243328',
    text: '#E8F0EA'
  },
  {
    id: 'royal',
    name: 'Royal',
    bg: '#101320',
    card: '#1A2033',
    gold: '#D4AF37',
    border: '#2B3552',
    text: '#EEF2FF'
  },
  {
    id: 'maroon',
    name: 'Maroon',
    bg: '#160F12',
    card: '#24171C',
    gold: '#D4AF37',
    border: '#3A252D',
    text: '#F7EDEE'
  },
  {
    id: 'sand',
    name: 'Sand',
    bg: '#18140F',
    card: '#241E17',
    gold: '#D4AF37',
    border: '#3A3126',
    text: '#F6F1E8'
  }
];