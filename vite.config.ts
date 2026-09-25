import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { version } from './package.json';

// GitHub Pages serves the app from /<repo-name>/, not the domain root, so every
// asset URL and the service-worker scope need that prefix. Set through an env
// var by the deploy workflow, leaving local dev and preview at the root.
const base = process.env.VITE_BASE ?? '/';

// Absolute origin for the social preview tags in index.html. Crawlers do not
// resolve relative paths or the Vite base, so og:image has to be fully
// qualified. Overridable for a custom domain later.
const siteUrl = process.env.VITE_SITE_URL ?? 'https://mokaramhossain.github.io/Tasbeeh/';

export default defineConfig({
  base,
  // The version was previously typed into the About screen by hand, and into a
  // translation key alongside it, so a release meant editing three files.
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    {
      // Vite only substitutes %VAR% in index.html from loaded .env files, so a
      // computed default would ship as a literal placeholder and every social
      // preview would break. Substituted here instead.
      name: 'site-url',
      transformIndexHtml: (html: string) => html.replaceAll('%VITE_SITE_URL%', siteUrl)
    },
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt', not 'autoUpdate': a new build waits instead of swapping
      // itself in, so the app can offer the reload rather than pulling the page
      // out from under someone who is mid-count. src/components/UpdatePrompt.tsx
      // does the offering.
      registerType: 'prompt',
      // The registration lives in UpdatePrompt via virtual:pwa-register/react;
      // letting the plugin inject its own script as well would register twice.
      injectRegister: null,
      // No includeAssets: globPatterns below already covers the icons and the
      // manifest, and listing them twice precached every one of them twice.
      manifest: {
        name: "Tasbeeh — Dhikr & Du'a Tracker",
        short_name: 'Tasbeeh',
        description: "Simple and lightweight Dhikr and Du'a tracker for daily remembrance.",
        theme_color: '#0B1410',
        background_color: '#0B1410',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        categories: ['lifestyle', 'productivity'],
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            // Android adaptive icons crop to a circle; without a maskable entry
            // the launcher icon gets its corners cut off.
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Workbox's default glob does not include fonts, so bundling them would
        // otherwise still leave a cold offline start with no Arabic typeface.
        // Only woff2 is precached — every browser that runs a service worker
        // supports it, and the woff fallbacks would just double the payload.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
        // The social preview is fetched by link crawlers, never rendered by the
        // app, so precaching it would cost every user a quarter of a megabyte
        // of offline storage for nothing.
        globIgnores: ['**/share-card.png'],
        // The privacy policy is a real static page, so the SPA navigation
        // fallback must not swallow it and serve index.html instead.
        navigateFallbackDenylist: [/^\/.*privacy\.html$/],
        // Fonts are bundled and therefore precached with the rest of the build;
        // only the Quran API needs a runtime rule now.
        runtimeCaching: [
          {
            // Downloaded surahs are stored in localStorage anyway, but caching
            // the API response makes a repeat add work offline.
            urlPattern: /^https:\/\/api\.alquran\.cloud\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'quran-api',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Splits the ~540 kB single bundle so the dhikr/dua text data and the
        // animation library are not part of the initial parse.
        manualChunks: {
          vendor: ['react', 'react-dom', 'motion'],
          icons: ['lucide-react']
        }
      }
    }
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
