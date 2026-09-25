<div align="center">

<img src="public/icon.svg" width="96" height="96" alt="Tasbeeh icon" />

# Tasbeeh — Dhikr & Du'a Tracker

**Build a consistent daily dhikr habit.**<br />
The after-salah routine, Asma ul Husna and du'as for every moment, in one calm app.

Private · Works offline · Free forever · English & বাংলা

### [Open the app →](https://mokaramhossain.github.io/Tasbeeh/)

<img src="docs/screenshots/1-home.png" width="30%" alt="Home: Play the routine and Asma ul Husna, one tap each" />&nbsp;
<img src="docs/screenshots/2-reader.png" width="30%" alt="Al-Malik with Qur'an 59:23, the name highlighted in the verse" />&nbsp;
<img src="docs/screenshots/4-names.png" width="30%" alt="The ninety-nine names, each with its citation" />

</div>

---

## What it does

### 🕌 The after-salah routine
- The core adhkar, then Ayatul Kursi and the three Quls, with a target on each.
- **Play the routine** reads it through in order and starts at the first du'a you have not finished.
- **Reset for New Salah** starts the next round. What you recited stays in your record.

### 💠 Asma ul Husna
- All ninety-nine names in Arabic, with the meaning and a pronunciation guide in English and Bangla.
- **Each name shows where it is found.** 70 names show the verse they are said in, the Arabic with the name picked out and a translation beside it. The other 29, which the Qur'an has only as a verb or not at all, cite the narration that lists them (at-Tirmidhi 3507).
- One button on Home resumes at the last name you read, counts your rounds for the day, and has its own reset.

### 🤲 Du'as for every moment
- 71 du'as and 6 occasion du'as across 23 categories, each with its source.
- Search across titles, meanings, pronunciation and the Arabic itself.
- Home suggests what fits right now: morning, evening, Friday, Ramadan, the last ten nights, Eid and the Day of Arafah. Hijri dates are calculated, and you can correct them by a day to match your local moon sighting.

### 📖 Reading and your own collection
- A focus mode for reading without distraction: swipe between du'as, adjust the text size, and tap to count.
- Save favourites into your own collections, write your own du'as, or add any of the 114 surahs.
- A hadith of the day and a short reflection.

### 📅 Your record
- A calendar of the days you remembered Allah, your all-time count and what you recite most.
- No streaks to break. You can switch the record off entirely.

### 🔒 Private by design
- Everything stays on your phone. No account, no analytics, no tracking, no ads.
- Works fully offline once installed, fonts included.
- Back up and restore your data as a single file.

## Install it on your phone

It installs from the browser, with no app store needed:

| iPhone (Safari) | Android (Chrome) |
| --- | --- |
| Open the app link, tap **Share**, then **Add to Home Screen**. | Open the app link, tap **⋮**, then **Install app** or **Add to Home screen**. |

Open it once from the home screen while online, and it works offline from then on.

## Sources and content standards

This app is used for worship, so a mistake in its content is worse than a bug in its code.

- **No virtue claim without a citation**, and no citation upgraded to one that merely seems to fit.
- **Translations have a named source or a native speaker's review.** Machine translation of religious text is not accepted, and pronunciation guides are never generated.
- **The verses under the names:** Arabic from [Tanzil](https://tanzil.net); English, Sahih International; Bangla, Dr. Abu Bakr Muhammad Zakaria (King Fahd Complex). The only changes are removing the bismillah that the dataset attaches to verse 1, and Zakaria's footnote markers, since the footnotes are not included. `npm run data:verify-names` checks every cited verse against the Qur'an text.

The full rules are in [CONTRIBUTING.md](CONTRIBUTING.md). If you find a mistake, please [open an issue](https://github.com/mokaramhossain/Tasbeeh/issues).

## Contributing

Corrections to content, translations (a new language is one file) and code are all welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## Licence

Free software under [GPL-3.0-or-later](LICENSE). Anyone may use and change it, and any distributed version must stay open source.

---

## For developers

Built with React, Vite and Tailwind as an installable, offline-first web app. All data lives in the browser.

### Run locally

Requires Node.js 22 (see `.node-version`) and npm.

```bash
npm install
npm run dev      # http://localhost:3000, also reachable from other devices on your network
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 3000, reachable from other devices on the network |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Type-check the project (`tsc --noEmit`, strict mode) |
| `npm test` | Content tests: ids, citations, verse data, backup coverage |
| `npm run i18n:report` | Translation coverage: missing UI keys and content fields |
| `npm run data:names` | Regenerate `src/data/asmaulHusna.ts` from `scripts/names.mjs` |
| `npm run data:name-verses` | Regenerate the verses under the names |
| `npm run data:verify-names` | Check each cited verse contains its name |
| `npm run shots` | Regenerate the screenshots from the real app |
| `npm run clean` | Remove `dist/` |

### Deploying

Pushing to `main` (or running **Deploy to GitHub Pages** from the Actions tab on `main`) builds the app with `.github/workflows/deploy.yml` and publishes it to <https://mokaramhossain.github.io/Tasbeeh/>. Only `main` may deploy; the `github-pages` environment rejects other branches.

Pages serves from `/<repo-name>/`, so the workflow builds with `VITE_BASE=/<repo-name>/`. The same source serves from a domain root when `VITE_BASE` is unset.

### Testing on a phone

- **The deployed build** is needed to test installing and offline use. Add it to the home screen, open it once, then turn on airplane mode and reopen it.
- **The dev server over Wi-Fi** (`http://<your-computer's-ip>:3000`) is fine for layout and touch checks, but cannot test install or offline: service workers only run in a secure context, and a plain `http://` LAN address is not one.

### Project layout

```
src/
  App.tsx            App shell, state, overlays
  i18n.ts            Translate helper and number formatting
  locales/           Language registry (index.ts) and one file per language
  theme.ts           Theme palettes and CSS variable application
  components/        Presentational components
  screens/           Home, Du'a, Saved and More tabs
  data/              Adhkar, du'as, names and their verses, categories, hadiths
  hooks/             Back-button history, wake lock
  utils/             Storage, dates, search, counts, backup
scripts/             Data builds, verification, screenshots
tests/               Content tests
```

### Technical notes

- **Storage.** User data is stored under `dhikr-*` keys. `src/utils/backup.ts` lists every key included in a backup, and a test fails if a stored key is missing from it. Reads are validated and fall back to defaults, so a corrupt entry cannot break the app, and an error boundary offers a recovery screen. Day counts are pruned to the last 400 days.
- **Updates.** The service worker runs in `prompt` mode: a new build installs and waits, and a **Reload** bar offers it. Reloading is never automatic, because someone may be mid-recitation with a count on screen. An open app re-checks hourly.
- **Offline.** The Scheherazade New and Lora fonts are bundled and precached, so the Arabic renders correctly on a first offline start. Screenshots and the share image are excluded from the offline cache.
- **Languages.** Each language is one entry in `src/locales/index.ts` (tag, label, direction, numerals, font stack) and one strings file keyed by the English text, so a missing translation falls back to readable English. Item content stays beside each item in `src/data`. Transliteration is only shown when it is written in the reader's own script.
- **Hijri dates are calculated, never asserted.** `Intl` with the `islamic-umalqura` calendar gives the date with no library and no location. Local moon sighting often differs by a day, so the app names a period ("the last ten nights") rather than claiming a date, and Settings carries the reader's own correction.
- **No reminders on the web.** Scheduled local notifications are not available to web apps (the Notification Triggers API was abandoned), and web push would need a server, which would contradict an offline app where nothing leaves the device. Reminders belong in a native Android build.
- **Version.** The version shown in About comes from `package.json` at build time.
- **Android.** The Play Store listing uses the application id `com.moizit.dhikrtracker`. An application id can never change once published, so a separate new Play Store app would need a new id.
