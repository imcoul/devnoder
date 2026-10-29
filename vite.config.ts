import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const pyodideVersion = require('pyodide/package.json').version as string;
const MAX_CLOUDFLARE_ASSET_BYTES = 25 * 1024 * 1024;

function compressOversizedWasmAssets(): Plugin {
  return {
    name: 'devnoder-compress-oversized-wasm',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== 'asset') continue;
        const source = Buffer.from(asset.source);
        if (source.byteLength <= MAX_CLOUDFLARE_ASSET_BYTES) continue;
        if (!fileName.endsWith('.wasm')) {
          throw new Error(`Cloudflare Pages asset exceeds 25 MiB: ${fileName} (${source.byteLength} bytes)`);
        }

        const compressed = gzipSync(source, { level: 9 });
        if (compressed.byteLength > MAX_CLOUDFLARE_ASSET_BYTES) {
          throw new Error(`Compressed WASM still exceeds Cloudflare Pages’ 25 MiB limit: ${fileName}`);
        }
        const compressedName = `${fileName}.gz`;
        for (const output of Object.values(bundle)) {
          if (output.type === 'chunk') output.code = output.code.replaceAll(fileName, compressedName);
        }
        this.emitFile({ type: 'asset', fileName: compressedName, source: compressed });
        delete bundle[fileName];
        this.warn(`Compressed ${fileName} (${source.byteLength} bytes) to ${compressedName} (${compressed.byteLength} bytes) for Cloudflare Pages.`);
      }
    },
  };
}

export default defineConfig({
  define: {
    __PYODIDE_VERSION__: JSON.stringify(pyodideVersion),
  },
  plugins: [
    react(),
    compressOversizedWasmAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}', '**/*.wasm.gz'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      manifest: {
        name: 'DevNoder',
        short_name: 'DevNoder',
        description: 'Browser-local developer workspace by Srvel. Edit, preview and back up supported projects.',
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
      '@php-wasm/web-8-5',
      '@php-wasm/web-8-4',
      '@php-wasm/web-8-3',
      '@php-wasm/web-8-2',
      '@php-wasm/web-8-1',
      '@php-wasm/web-8-0',
      '@php-wasm/web-7-4',
      '@php-wasm/universal',
      '@cloudflare/sandbox',
      '@modelcontextprotocol/sdk',
    ],
  },
  ssr: {
    external: [
      '@php-wasm/web',
      '@php-wasm/web-8-5',
      '@php-wasm/web-8-4',
      '@php-wasm/web-8-3',
      '@php-wasm/web-8-2',
      '@php-wasm/web-8-1',
      '@php-wasm/web-8-0',
      '@php-wasm/web-7-4',
      '@php-wasm/universal',
      '@cloudflare/sandbox',
      '@modelcontextprotocol/sdk',
    ],
  },
  build: {
    rollupOptions: {
      external: [
        '@php-wasm/web',
        '@php-wasm/web-8-5',
        '@php-wasm/web-8-4',
        '@php-wasm/web-8-3',
        '@php-wasm/web-8-2',
        '@php-wasm/web-8-1',
        '@php-wasm/web-8-0',
        '@php-wasm/web-7-4',
        '@php-wasm/universal',
        '@cloudflare/sandbox',
        'cloudflare:workers',
        '@modelcontextprotocol/sdk',
      ],
    },
  },
});
