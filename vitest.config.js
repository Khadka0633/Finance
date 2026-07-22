import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // firestore.rules.test.js requires the Firebase emulator and the
    // @firebase/rules-unit-testing package (not installed by default) —
    // it's run separately via `firebase emulators:exec`, see README.
    exclude: ['**/node_modules/**', 'firestore.rules.test.js'],
  },
})
