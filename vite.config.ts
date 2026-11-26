import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Sub-path the app is served from. GitHub Pages project sites live under
// /<repo>/, so the deploy workflow sets BASE_PATH=/freecellin/.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Freecellin',
        short_name: 'Freecellin',
        description: 'Freecellin – classic FreeCell solitaire with Microsoft numbered deals. Plays offline.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#f6f1e7',
        background_color: '#f6f1e7',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything the game needs, including sound effects and music.
        globPatterns: ['**/*.{js,css,html,svg,png,wav,mp3,webmanifest}'],
        // The background music (audio3.mp3, ~5.7 MB) exceeds Workbox's 2 MB default.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/tests/**/*.test.ts'],
  },
});
