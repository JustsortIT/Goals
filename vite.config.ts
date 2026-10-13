// Vite configuration for phaseplay:
// - Integrates pretendKiosk for kiosk emulation in dev server
// - Configures build to output two pages (index list and play page)
// - Allows ngrok tunnel hosting for testing on phones
// - Sets test environment to Node for pure logic tests
import { defineConfig } from 'vitest/config';
import { pretendKiosk } from './tools/pretend-kiosk.mjs';

export default defineConfig({
  // Answers the kiosk's addresses from memory, so the shell runs here as it does in PubPixels.
  plugins: [pretendKiosk()],
  server: {
    // Lets the dev server be reached through an ngrok tunnel, for testing on a phone.
    allowedHosts: ['.ngrok-free.dev'],
  },
  build: {
    // Phaser ships as a single large module; don't warn about it on every build.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // Two pages: the list of games, and the page a game plays on.
      input: { index: 'index.html', play: 'play.html' },
    },
  },
  test: {
    // Unit tests cover pure logic only (no Phaser import), so plain Node is enough.
    environment: 'node',
    include: ['src/**/*.test.ts', 'tools/**/*.test.mjs'],
  },
});
