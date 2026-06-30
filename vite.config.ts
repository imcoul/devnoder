import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      manifest: {
        name: 'DevNoder',
        short_name: 'DevNoder',
        description: 'Mobile-first offline IDE by Srvel',
        theme_color: '#0D1F1E',
        background_color: '#0D1F1E',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  assetsInclude: [/\.dat$/, /\.wasm$/, /\.so$/, /\.la$/],
  optimizeDeps: {
    exclude: [
      '@mlc-ai/web-llm',
      '@php-wasm/web',
      '@php-wasm/web-8-4',
      '@php-wasm/web-8-3',
      '@php-wasm/web-8-2',
      '@php-wasm/web-8-1',
      '@php-wasm/web-8-0',
      '@php-wasm/web-7-4',
    ],
  },
  ssr: {
    external: [
      '@php-wasm/web',
      '@php-wasm/web-7-4',
    ],
  },
});
