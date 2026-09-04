import { defineConfig } from 'vitest/config';

// Deliberately separate from vite.config.ts: that config wires VitePWA and
// several WASM-specific optimizeDeps/ssr exclusions that exist for the
// browser build and add nothing but startup cost and risk to a Node-based
// test run. Tests need Dexie's `indexedDB` (polyfilled in setupTests.ts) and
// WebCrypto (native in Node 20+) — no DOM emulation required.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setupTests.ts'],
  },
});
