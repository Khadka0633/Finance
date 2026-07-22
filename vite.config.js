import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Firestore's offline cache only covers DATA. Without a service worker
    // precaching the app shell (HTML/JS/CSS), the app itself can't open at
    // all with zero connectivity. This plugin closes that gap.
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'Ledger — Finance Tracker',
        short_name: 'Ledger',
        description: 'Offline-first personal finance tracker',
        theme_color: '#EDEFEA',
        background_color: '#EDEFEA',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
